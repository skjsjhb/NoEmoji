import ClientEmojiPanel from "@/app/client-emoji-panel";
import { cookies } from "next/headers";
import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import { EMOJIS } from "@/app/emojis";
import { notFound, redirect } from "next/navigation";
import { getUserInfo } from "./actions/account";
import { wsRequest } from "./actions/emoji";

export default async function Home() {
    const cookieStore = await cookies();
    const uid = cookieStore.get("uid")?.value;
    const token = cookieStore.get("token")?.value;
    if (!uid) return redirect("/login");

    const userInfo = await getUserInfo();
    const isSuper = userInfo.super; // DONE

    const tokenValid = await wsRequest({
            op: "user.validate",
            uid: uid,
            token: token
        });

    if (!tokenValid) {
            throw new Error("Token无效或已过期");
        }

    // TODO: Fetches emoji history for the user
    async function getEmojiHistory(): Promise<{ id: number, date: Date }[]> {
        const emojiResponse = await wsRequest<
            { emoji: number; time: number }[]
        >({
            op: "emoji.query",
            uid: uid
        });

        return (emojiResponse ?? []).map((e) => ({
            id: e.emoji,
            date: new Date(e.time),
        })).sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    // TODO: Fetches all emoji records (only for super user)
    async function getGlobalEmojiHistory(): Promise<{ id: number, date: Date , uid: string}[]> {
        if (!isSuper) return [];

        const emojiResponse = await wsRequest<
            { emoji: number; time: number; uid: string}[]
        >({
            op: "emoji.query"
        });

        if (!emojiResponse) {
            return [];
        }

        return (emojiResponse ?? []).map((e) => ({
            id: e.emoji,
            date: new Date(e.time),
            uid: e.uid,
        })).sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    const emojiHistory = await getEmojiHistory();
    const emojiCount = new Map<number, number>();

    if (isSuper) {
        const emojis = await getGlobalEmojiHistory();
        for (const em of emojis) {
            const pre = emojiCount.get(em.id) ?? 0;
            emojiCount.set(em.id, pre + 1);
        }
    }

    return <Card>
        <Flex gap="8" p="8" align="center">
            <ClientEmojiPanel/>
            <div style={{ borderLeft: "1px solid gray", alignSelf: "stretch" }}></div>
            <Flex gap="5" direction="column" align="center" maxHeight="20em">
                <Heading>历史表情</Heading>
                {
                    emojiHistory.length === 0 ?
                        <Text color="gray">暂无表情</Text> :
                        <Flex px="5" gap="2" direction="column" minHeight="0" overflowY="auto">
                            {
                                emojiHistory.map(({ id, date }, i) =>
                                    <Flex key={i} align="center" gap="5">
                                        <Text size="4">{EMOJIS[id]}</Text>
                                        <Text size="2" color="gray">{date.toLocaleString()}</Text>
                                    </Flex>
                                )
                            }
                        </Flex>
                }
            </Flex>
            <div style={{ borderLeft: "1px solid gray", alignSelf: "stretch" }}></div>
            {
                isSuper &&
                <Flex gap="5" direction="column" align="center" maxHeight="20em">
                    <Heading>表情统计</Heading>
                    {
                        emojiCount.size === 0 ?
                            <Text color="gray">暂无表情</Text> :
                            <Flex px="5" gap="2" direction="column" minHeight="0" overflowY="auto">
                                {
                                    emojiCount.entries().map(([id, count]) =>
                                        <Flex key={id} align="center" gap="5">
                                            <Text size="4">{EMOJIS[id]}</Text>
                                            <Text size="2" color="gray">{count}</Text>
                                        </Flex>
                                    )
                                }
                            </Flex>
                    }
                </Flex>
            }
        </Flex>
    </Card>;
}
