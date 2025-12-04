"use server";

import { cookies } from "next/headers";
import { hashPwd, wsRequest } from "@/app/actions/util";


/**
 * Called when the user attempts to submit an emoji. The ID of that emoji is passed.
 */
export async function submitEmoji(id: number) {
    const { uid } = await validateUser();

    await wsRequest({
        op: "emoji.insert",
        uid: uid,
        emoji: id
    });
}

/**
 * Called when the user attempts to update their password.
 */
export async function updatePwd(newPwd: string) {
    const { uid } = await validateUser();

    const pwh = await hashPwd(newPwd);

    const result = await wsRequest<boolean>({
        op: "user.mod",
        uid: uid,
        pwh
    });

    if (!result) {
        throw "密码更新失败";
    }
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

async function validateUser(): Promise<{ uid: string, token: string }> {
    const cookieStore = await cookies();
    const uid = cookieStore.get("uid")?.value;
    const token = cookieStore.get("token")?.value;

    if (!uid || !token) {
        throw "用户未登录";
    }

    const tokenValid = await wsRequest<boolean>({
        op: "user.validate",
        uid: uid,
        token: token
    });

    if (!tokenValid) {
        throw "登录状态失效";
    }

    return { uid, token: token! };
}