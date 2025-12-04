"use client";

import { Button, Card, Flex, Heading, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { raiseError } from "@/app/toast";
import { register } from "@/app/actions/account";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const [username, setUsername] = useState("");
    const [pwd, setPwd] = useState("");
    const [email, setEmail] = useState("");
    const [tel, setTel] = useState("");
    const [displayName, setDisplayName] = useState("");
    const router = useRouter();

    async function onSubmit() {
        try {
            await register({
                uid: username,
                email: email,
                tel: tel,
                name: displayName
            }, pwd);
            toast.success("注册成功");
            router.push("/login");
        } catch (e) {
            raiseError(e);
        }
    }

    return <Card>
        <Flex direction="column" gap="3" minWidth="20em" p="3">
            <Heading style={{ width: "100%", textAlign: "center" }} mb="4">欢迎加入 NoEmoji</Heading>
            <TextField.Root
                size="3"
                value={username}
                onChange={v => setUsername(v.target.value)}
                placeholder="用户名"
                type="text"
            />
            <TextField.Root
                size="3"
                value={pwd}
                onChange={v => setPwd(v.target.value)}
                placeholder="密码"
                type="password"
            />

            <hr/>

            <TextField.Root
                size="3"
                value={displayName}
                onChange={v => setDisplayName(v.target.value)}
                placeholder="显示名称"
                type="text"
            />

            <TextField.Root
                size="3"
                value={email}
                onChange={v => setEmail(v.target.value)}
                placeholder="电子邮件"
                type="email"
            />

            <TextField.Root
                size="3"
                value={tel}
                onChange={v => setTel(v.target.value)}
                placeholder="电话"
                type="tel"
            />


            <Button onClick={onSubmit} disabled={!username || !pwd || !email || !tel || !displayName}
                    size="3">注册</Button>
        </Flex>
    </Card>;
}