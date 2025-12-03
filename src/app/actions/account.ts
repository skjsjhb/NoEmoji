"use server";

import { wsRequest } from "./emoji";
import { cookies } from "next/headers";
import crypto from "crypto";
import jwt from "jsonwebtoken";

export function hashPwd(pwd: string) {
    return crypto.createHash("sha256").update(pwd).digest("hex");
}

/**
 * Called when the user tries to log in.
 */
export async function login(uid: string, pwd: string) {
    const user = await wsRequest<UserInfo>({
        op: "user.query",
        uid
    });

    if (!user) throw new Error("用户不存在")

    const pwh = hashPwd(pwd);
    if (pwh !== user.pwh) throw new Error("密码错误");

    const token = jwt.sign(
        { uid: user.uid},
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: "2h"} 
    );

    const cookieStore = await cookies();
    cookieStore.set("uid", user.uid, { httpOnly: true, path: "/"});
    cookieStore.set("token", token, { httpOnly: true, path: "/", sameSite: "lax"});

    return true;
}

/**
 * Called when the user tries to register.
 */
export async function register(ui: Omit<UserInfo, "uid" | "super">, user: string, pwd: string) {
    const pwh = hashPwd(pwd);

    const res = await wsRequest({
        op: "user.mod",
        uid: "",    //后端创建
        name: ui.name,
        tel: ui.tel,
        email: ui.email,
        super: false,
        pwh: pwh
    })

    if (!res) throw new Error("注册失败");

    return true;
}

/**
 * Called when the browser needs to load user info.
 */
// 前端暂时没有实现
// export async function getUserInfo(): Promise<UserInfo> {
//     const cookieStore = await cookies();
//     const uid = cookieStore.get("uid")?.value;

//     if (!uid) throw new Error("未登录");
    
//     const user = await wsRequest<UserInfo>({
//         op: "user.query",
//         uid
//     });

//     return user;
// }

// /**
//  * Called when the browser needs information about all users.
//  */
// export async function getAllUsers(): Promise<UserInfo[]> {
//     return await wsRequest<UserInfo[]>({
//         op: "user.query"
//     });
// }

// /**
//  * Called when the user info needs to be updated.
//  */
// export async function updateUser(ui: UserInfo) {
//     const cookieStore = await cookies();
//     const uid = cookieStore.get("uid")?.value;
//     const token = cookieStore.get("token")?.value;

//     if (!uid) throw new Error("未登录");

//     const valid = await wsRequest<boolean>({
//         op: "user.validate",
//         uid,
//         token
//     });

//     if (!valid) throw new Error("Token 无效");

//     const payload: any = {
//         op: "user.mod",
//         uid: ui.uid,
//         name: ui.name,
//         email: ui.email,
//         tel: ui.tel,
//         super: ui.super
//     };

//     const ok = await wsRequest(payload);
//     if (!ok) throw new Error("更新失败");

//     return true;
// }

export interface UserInfo {
    uid: string;
    name: string;
    tel: string;
    email: string;
    super: boolean;
    pwh: string
}

// export interface LoginUser {
//     uid: string;
//     name: string;
//     tel: string;
//     email: string;
//     super: boolean;
//     pwh: string; // 仅登录时需要
// }