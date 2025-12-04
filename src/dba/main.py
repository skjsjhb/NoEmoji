import json
import time
import tomllib
from datetime import datetime

import jwt
import mysql.connector
import redis
from websockets.sync.server import serve, ServerConnection

with open("runtime.toml", "rb") as f:
    runtime_cfg = tomllib.load(f)

with open(runtime_cfg["jwt"]["private"], "r") as f:
    JWT_PVT_KEY = f.read()

with open(runtime_cfg["jwt"]["public"], "r") as f:
    JWT_PUB_KEY = f.read()

db = mysql.connector.connect(**dict(
    database="noemoji",
    autocommit=True,
    **runtime_cfg["db"]["mysql"]
))

rds = redis.Redis(**dict(
    db=0,
    decode_responses=True,
    **runtime_cfg["db"]["redis"]
))


def create_tables():
    cur = db.cursor()
    cur.execute("""
                CREATE TABLE IF NOT EXISTS users
                (
                    uid             VARCHAR(64) PRIMARY KEY NOT NULL,
                    pwh             VARCHAR(512)            NOT NULL,
                    name            VARCHAR(64)             NOT NULL,
                    tel             VARCHAR(32),
                    email           VARCHAR(128),
                    pwd_update_time DATETIME                NOT NULL,
                    super           BOOLEAN DEFAULT FALSE
                );
                """)
    cur.execute("""
                CREATE TABLE IF NOT EXISTS emojis
                (
                    id    BIGINT AUTO_INCREMENT PRIMARY KEY NOT NULL,
                    uid   VARCHAR(64)                       NOT NULL,
                    emoji INT                               NOT NULL,
                    time  BIGINT                            NOT NULL,
                    INDEX (uid),
                    FOREIGN KEY (uid) REFERENCES users (uid)
                );
                """)
    cur.close()


def now_ts() -> int:
    return int(time.time())


def jwt_encode(uid: str) -> str:
    now = datetime.now().timestamp() * 1000
    exp = now + 7 * 24 * 60 * 60 * 1000
    return jwt.encode(
        {"uid": uid, "exp": exp, "time": now},
        JWT_PVT_KEY,
        algorithm="EdDSA",
    )


def jwt_decode(token: str):
    try:
        payload = jwt.decode(token, JWT_PUB_KEY, algorithms=["EdDSA"])
        if rds.exists("invalid:" + token):
            return None
        now = datetime.now().timestamp() * 1000
        if now >= payload["exp"]:
            return None

        uid = payload["uid"]

        cur = db.cursor(dictionary=True)
        cur.execute("""
                    SELECT pwd_update_time
                    FROM users
                    WHERE uid = %s
                    """, (uid,))
        res = cur.fetchone()

        if not res:
            return None

        update_time: datetime = res["pwd_update_time"]
        if payload["time"] <= update_time.timestamp() * 1000:
            return None

        return payload
    except Exception:
        return None


# ---------- 业务 ----------
def do_user_mod(req: dict) -> bool:
    uid = req["uid"]
    pwh = req["pwh"]
    name = req["name"]
    tel = req["tel"]
    email = req["email"]
    super_ = req["super"] or False

    cur = db.cursor(dictionary=True)
    cur.execute("SELECT pwh FROM users WHERE uid=%s", (uid,))
    old = cur.fetchone()

    if old:  # 更新
        new_pwh: str = pwh or old["pwh"]
        sql = """
              UPDATE users
              SET pwh=%s,
                  name=%s,
                  tel=%s,
                  email=%s,
                  super=%s,
                  pwd_update_time=%s
              WHERE uid = %s
              """
        now_time = datetime.now()
        cur.execute(sql, (new_pwh, name, tel, email, super_, now_time, uid))
    else:  # 插入
        if pwh is None or name is None:
            raise ValueError("pwh and name required for new user")
        cur.execute(
            "INSERT INTO users(uid,pwh,name,tel,email,pwd_update_time,super) VALUES(%s,%s,%s,%s,%s,%s,%s)",
            (uid, pwh, name, tel, email, datetime.now(), super_),
        )
    cur.close()
    return True


def do_user_query(req: dict):
    uid = req.get("uid")
    cur = db.cursor(dictionary=True)
    if uid:
        cur.execute("SELECT uid,pwh,name,tel,email,super FROM users WHERE uid=%s", (uid,))
        row = cur.fetchone()
        cur.close()
        if row is not None:
            row["super"] = bool(row["super"])
        return row
    else:
        cur.execute("SELECT uid,pwh,name,tel,email,super FROM users")
        rows = cur.fetchall()
        cur.close()
        for row in rows:
            row["super"] = bool(row["super"])
        return rows


def do_user_validate(req: dict):
    uid = req["uid"]
    token = req["token"]
    if not uid or not token:
        return False
    payload = jwt_decode(token)
    return payload is not None and payload["uid"] == uid


def do_user_rmtoken(req: dict):
    token = req["token"]
    payload = jwt_decode(token)
    if payload:
        exp_ts = int(payload["exp"])
        ttl = exp_ts - now_ts()
        if ttl > 0:
            rds.setex("invalid:" + token, ttl, 1)


def do_emoji_insert(req: dict):
    uid = req["uid"]
    emoji = req["emoji"]
    cur = db.cursor()
    cur.execute("SELECT 1 FROM users WHERE uid=%s", (uid,))
    if cur.fetchone():
        cur.execute(
            "INSERT INTO emojis(uid,emoji,time) VALUES(%s,%s,%s)",
            (uid, emoji, now_ts()),
        )
    cur.close()
    return True


def do_emoji_query(req: dict):
    uid = req.get("uid")
    cur = db.cursor(dictionary=True)
    if uid:
        cur.execute("SELECT emoji,time FROM emojis WHERE uid=%s ORDER BY time", (uid,))
    else:
        cur.execute("SELECT emoji,time,uid FROM emojis ORDER BY time")
    rows = cur.fetchall()
    cur.close()
    return rows


def do_user_mktoken(req: dict):
    uid = req["uid"]
    return jwt_encode(uid)


# ---------- 路由 ----------
OP_HANDLERS = {
    "user.mod": do_user_mod,
    "user.mktoken": do_user_mktoken,
    "user.query": do_user_query,
    "user.validate": do_user_validate,
    "user.rmtoken": do_user_rmtoken,
    "emoji.insert": do_emoji_insert,
    "emoji.query": do_emoji_query,
}


def ws_handler(ws: ServerConnection):
    for message in ws:
        try:
            req = json.loads(message)
            op = req["op"]
            if op not in OP_HANDLERS:
                continue
            res = OP_HANDLERS[op](req)
            ws.send(json.dumps(res))
        except Exception as e:
            ws.send(str(e))


def main():
    create_tables()
    with serve(ws_handler, "localhost", 8765) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
