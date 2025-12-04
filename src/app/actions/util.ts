import crypto from "crypto";

export function hashPwd(pwd: string): Promise<string> {
    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const salt = crypto.randomBytes(16);
    crypto.scrypt(pwd, salt, 32, (err, key) => {
        if (err) reject(err);
        else resolve(salt.toString("hex") + ":" + key.toString("hex"));
    });

    return promise;
}

export function checkPwd(pwd: string, pwh: string): Promise<boolean> {
    const { promise, resolve, reject } = Promise.withResolvers<boolean>();
    const [st, key] = pwh.split(":");
    const salt = Buffer.from(st, "hex");
    const expKey = Buffer.from(key, "hex");
    crypto.scrypt(pwd, salt, 32, (err, key) => {
        if (err) reject(err);
        else resolve(crypto.timingSafeEqual(key, expKey));
    });

    return promise;
}

export async function wsRequest<T = any>(payload: unknown): Promise<T> {
    const ws = new WebSocket(process.env.NOEMOJI_WS_URL!);
    const { promise, resolve, reject } = Promise.withResolvers<T>();

    ws.onopen = () => ws.send(JSON.stringify(payload));
    ws.onmessage = (ev) => {
        try {
            resolve(JSON.parse(ev.data) as T);
        } catch {
            reject(ev.data);
        } finally {
            ws.close();
        }
    };
    ws.onerror = (e) => {
        reject(e);
    };

    return promise;
}