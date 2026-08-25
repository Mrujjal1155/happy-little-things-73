import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adjustBalance, broadcastMessage, listBotUsers, messageUser, setBanned } from "@/lib/admin.functions";
import { AdminShell, money } from "@/components/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — Shop Bot Admin" },
      { name: "description", content: "Search Telegram bot users, adjust wallet balance, message them or ban abusers." },
      { property: "og:title", content: "Users — Shop Bot Admin" },
      { property: "og:description", content: "Customer management for your Telegram digital shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const fetchUsers = useServerFn(listBotUsers);
  const adjust = useServerFn(adjustBalance);
  const ban = useServerFn(setBanned);
  const dm = useServerFn(messageUser);
  const broadcast = useServerFn(broadcastMessage);
  const [bcText, setBcText] = useState("");
  const [bcImage, setBcImage] = useState("");
  const [bcBusy, setBcBusy] = useState(false);

  async function sendBroadcast() {
    setBcBusy(true);
    try {
      const r: any = await broadcast({ data: { text: bcText, image_url: bcImage } });
      if (r.sent === 0) toast.error(`Broadcast failed (0/${r.total}). ${r.error ?? ""}`);
      else toast.success(`Broadcast sent to ${r.sent}/${r.total} users`);
      setBcText("");
      setBcImage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Broadcast failed");
    } finally {
      setBcBusy(false);
    }
  }

  const { data } = useQuery({ queryKey: ["botUsers", search], queryFn: () => fetchUsers({ data: { search } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["botUsers"] });

  async function run(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      refresh();
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminShell title="Users">
      <div className="mb-4 flex max-w-sm gap-2">
        <Input placeholder="Search username or telegram id" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Telegram ID</th>
                <th>Username</th>
                <th>Balance</th>
                <th>Spent</th>
                <th>Tier</th>
                <th>Refs</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((u: any) => (
                <tr key={u.telegram_id} className="border-t border-border">
                  <td className="py-2">{u.telegram_id}</td>
                  <td>{u.username ? `@${u.username}` : (u.first_name ?? "—")}</td>
                  <td>{money(u.balance)}</td>
                  <td>{money(u.total_spent)}</td>
                  <td>{u.membership}</td>
                  <td>{u.referral_count}</td>
                  <td>
                    <Badge variant={u.is_banned ? "destructive" : "secondary"}>
                      {u.is_banned ? "banned" : "active"}
                    </Badge>
                  </td>
                  <td className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const v = window.prompt("Amount to add (negative to deduct)");
                        if (!v) return;
                        run(
                          () => adjust({ data: { telegram_id: Number(u.telegram_id), amount: Number(v) } }),
                          "Balance updated",
                        );
                      }}
                    >
                      Balance
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const t = window.prompt("Message to send");
                        if (!t) return;
                        run(() => dm({ data: { telegram_id: Number(u.telegram_id), text: t } }), "Message sent");
                      }}
                    >
                      Message
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(
                          () => ban({ data: { telegram_id: Number(u.telegram_id), banned: !u.is_banned } }),
                          u.is_banned ? "Unbanned" : "Banned",
                        )
                      }
                    >
                      {u.is_banned ? "Unban" : "Ban"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data ?? []).length === 0 && <p className="py-4 text-sm text-muted-foreground">No users found.</p>}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
