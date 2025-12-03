"use server";

import { cookies } from "next/headers";
import { hashPwd } from "./account";
import { UserInfo } from "./account";

export async function wsRequest<T = any>(payload:object): Promise<T> {
    const ws = new WebSocket("ws://localhost:8765");
    return new Promise((resolve, reject) => {
        ws.onopen = () => ws.send(JSON.stringify(payload));
        ws.onmessage = (e) => {
            try {
                resolve(JSON.parse(e.data) as T);
            } catch {
                resolve(e.data as T);
            } finally {
                ws.close();
            }
        };
        ws.onerror = (e) => reject(e);
    });
}

/**
 * Called when the user attempts to submit an emoji. The ID of that emoji is passed.
 */
export async function submitEmoji(id: number) {
    // Reference implementation of getting user credentials
    const cookieStore = await cookies();
    const uid = cookieStore.get("uid")?.value;
    const token = cookieStore.get("token")?.value;

    // TODO: Verify JWT
    if (!uid) {
        throw new Error("用户未登录");
    }

    const tokenValid = await wsRequest<boolean>({
        op: "user.validate",
        uid: uid,
        token: token
    });

    if (!tokenValid) {
        throw new Error("Token无效或已过期");
    }

    // TODO: Validate user and send emoji data
    await wsRequest({
        op: "emoji.insert",
        uid: uid,
        emoji: id
    });

    return true;
    
}

/**
 * Called when the user attempts to update their password.
 */
export async function updatePwd(newPwd: string) {
    const cookieStore = await cookies();
    const uid = cookieStore.get("uid")?.value;
    const token = cookieStore.get("token")?.value;

    if (!uid) {
        throw new Error("用户未登录");
    }

    const tokenValid = await wsRequest<boolean>({
        op: "user.validate",
        uid: uid,
        token: token
    });

    if (!tokenValid) {
        throw new Error("Token无效或已过期");
    }
    
    const hashedPassword = hashPwd(newPwd);

    const result = await wsRequest<boolean>({
        op: "user.mod",
        uid: uid,
        pwh: hashedPassword
    });

    if (!result) {
        throw new Error("密码更新失败");
    }

    await wsRequest({
        op: "user.rmtoken",
        token: token
    });

    return true;
}


/**
 * Called when the user attempts to log out.
 */
export async function logout() {
    const cookieStore = await cookies();
    const uid = cookieStore.get("uid")?.value;
    const token = cookieStore.get("token")?.value;

    if (uid && token) {
        try {
            // 注销token
            await wsRequest({
                op: "user.rmtoken",
                token: token
            });
        } catch (error) {
            console.error("登出时服务器通信失败:", error);
        }
    }

    cookieStore.delete("uid");
    cookieStore.delete("token");

    return true;
}
