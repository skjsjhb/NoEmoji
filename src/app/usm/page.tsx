import { Card, Flex, Heading, Table } from "@radix-ui/themes";
import { cookies } from "next/headers";
import { getAllUsers, getUserInfo } from "@/app/actions/account";
import { notFound } from "next/navigation";

export default async function UsmPage() {
    const cookieStore = await cookies();
    const uid = cookieStore.get("uid")?.value;
    const userInfo = await getUserInfo();

    if (!uid) return notFound();

    if (!userInfo.super) return notFound();

    const users = await getAllUsers();

    return <Card>
        <Flex p="4" direction="column" gap="3">
            <Heading style={{ width: "100%", textAlign: "center" }} mb="4">所有用户</Heading>
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeaderCell>UID</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>名称</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>电子邮件</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>电话</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>身份</Table.ColumnHeaderCell>
                    </Table.Row>
                </Table.Header>

                <Table.Body>
                    {
                        users.map(
                            u => <Table.Row key={u.uid}>
                                <Table.Cell>{u.uid}</Table.Cell>
                                <Table.Cell>{u.name}</Table.Cell>
                                <Table.Cell>{u.email}</Table.Cell>
                                <Table.Cell>{u.tel}</Table.Cell>
                                <Table.Cell>{u.super ? "管理员" : "普通用户"}</Table.Cell>
                            </Table.Row>
                        )
                    }
                </Table.Body>
            </Table.Root>
        </Flex>
    </Card>;
}