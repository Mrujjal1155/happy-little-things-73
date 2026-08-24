import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOverview } from "@/lib/admin.functions";
import { AdminShell, money } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Overview — Shop Bot Admin" },
      { name: "description", content: "Revenue, users, orders today and pending payments for your Telegram shop bot." },
      { property: "og:title", content: "Overview — Shop Bot Admin" },
      { property: "og:description", content: "Live stats for your Telegram digital product shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const fetchOverview = useServerFn(getOverview);
  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: () => fetchOverview() });

  const stats = [
    { label: "Total users", value: data?.totalUsers ?? 0, tag: "Audience" },
    { label: "Revenue", value: money(data?.revenue), tag: "Lifetime" },
    { label: "Orders today", value: data?.ordersToday ?? 0, tag: "Today" },
    { label: "Pending payments", value: data?.pendingPayments ?? 0, tag: "Action needed" },
  ];

  return (
    <AdminShell title="Analytics">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className="admin-panel relative overflow-hidden rounded-xl p-5">
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary to-transparent" />
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-primary">{s.tag}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {isLoading ? "…" : s.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            <span className="pointer-events-none absolute -right-6 -bottom-8 text-7xl font-black text-primary/10">
              0{i + 1}
            </span>
          </div>
        ))}
      </div>

      <Card className="admin-panel mt-6 border-0 bg-transparent">
        <CardHeader className="border-b border-border/70">
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.16em]">Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-5">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">#</th>
                <th>User</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentOrders ?? []).map((o: any) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="py-2">{o.order_no}</td>
                  <td>{o.telegram_id}</td>
                  <td>{o.product_name}</td>
                  <td>{o.quantity}</td>
                  <td>{money(o.total)}</td>
                  <td>
                    <Badge variant={o.status === "completed" ? "default" : "secondary"}>{o.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && (data?.recentOrders ?? []).length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">No orders yet.</p>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
