"use server";

import { checkPwd, hashPwd, wsRequest } from "@/app/actions/util";
import { cookies } from "next/headers";

/**
 * Called when the user tries to log in.
 */
export async function login(uid: string, pwd: string) {
    const user = await wsRequest<UserInfo>({
        op: "user.query",
        uid
    });


    if (!user) throw "用户不存在";

    if (!await checkPwd(pwd, user.pwh)) throw "密码错误";

    const token: string = await wsRequest({
        op: "user.mktoken",
        uid
    });

    const cookieStore = await cookies();
    cookieStore.set("uid", user.uid, { httpOnly: true, path: "/" });
    cookieStore.set("token", token, { httpOnly: true, path: "/", sameSite: "lax" });

    return true;
}

/**
 * Called when the user tries to register.
 */
export async function register(ui: Omit<UserInfo, "super" | "pwh">, pwd: string) {
    const pwh = await hashPwd(pwd);


    const res = await wsRequest({
        op: "user.mod",
        super: false,
        pwh,
        ...ui
    });

    if (!res) throw "注册失败";

    return true;
}

/**
 * Called when the browser needs to load user info.
 */
export async function getUserInfo(): Promise<UserInfo> {
    const cookieStore = await cookies();
    const uid = cookieStore.get("uid")?.value;

    if (!uid) throw "未登录";

    return await wsRequest<UserInfo>({
        op: "user.query",
        uid
    });
}

/**
 * Called when the browser needs information about all users.
 */
export async function getAllUsers(): Promise<UserInfo[]> {
    return await wsRequest<UserInfo[]>({
        op: "user.query"
    });
}

/**
 * Called when the user info needs to be updated.
 */
// export async function updateUser(ui: UserInfo) {
//     const cookieStore = await cookies();
//     const uid = cookieStore.get("uid")?.value;
//     const token = cookieStore.get("token")?.value;
//
//     if (!uid) throw "未登录";
//
//     const valid = await wsRequest<boolean>({
//         op: "user.validate",
//         uid,
//         token
//     });
//
//     if (!valid) throw "Token 无效";
//
//     const payload = {
//         op: "user.mod",
//         ...ui
//     };
//
//     const ok = await wsRequest(payload);
//     if (!ok) throw "更新失败";
//
//     return true;
// }

export interface UserInfo {
    uid: string;
    name: string;
    tel: string;
    email: string;
    super: boolean;
    pwh: string;
}