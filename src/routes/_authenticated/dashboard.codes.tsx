import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { generateCodes, listCodes } from "@/lib/admin.functions";
import { AdminShell, money } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/codes")({
  head: () => ({
    meta: [
      { title: "Redeem Codes — Shop Bot Admin" },
      { name: "description", content: "Bulk generate gift codes with a balance value and track which ones were redeemed." },
      { property: "og:title", content: "Redeem Codes — Shop Bot Admin" },
      { property: "og:description", content: "Gift code generation for your Telegram shop bot wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CodesPage,
});

function CodesPage() {
  const qc = useQueryClient();
  const [count, setCount] = useState(10);
  const [amount, setAmount] = useState(1);
  const fetchCodes = useServerFn(listCodes);
  const gen = useServerFn(generateCodes);
  const { data } = useQuery({ queryKey: ["codes"], queryFn: () => fetchCodes() });

  async function generate() {
    try {
      const r = await gen({ data: { count: Number(count), amount: Number(amount) } });
      qc.invalidateQueries({ queryKey: ["codes"] });
      toast.success(`${r.codes.length} codes generated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminShell title="Redeem Codes">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Generate codes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>How many</Label>
            <Input type="number" className="w-28" value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Amount ($)</Label>
            <Input
              type="number"
              step="0.01"
              className="w-28"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <Button onClick={generate}>Generate</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Code</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Used by</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="py-2 font-mono">{c.code}</td>
                  <td>{money(c.amount)}</td>
                  <td>
                    <Badge variant={c.used_by ? "secondary" : "default"}>{c.used_by ? "used" : "unused"}</Badge>
                  </td>
                  <td>{c.used_by ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
