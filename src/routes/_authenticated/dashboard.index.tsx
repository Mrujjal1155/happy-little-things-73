import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOverview } from "@/lib/admin.functions";
import { AdminShell, money } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard/")({
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
    { label: "Total users", value: data?.totalUsers ?? 0 },
    { label: "Revenue", value: money(data?.revenue) },
    { label: "Orders today", value: data?.ordersToday ?? 0 },
    { label: "Pending payments", value: data?.pendingPayments ?? 0 },
  ];

  return (
    <AdminShell title="Overview">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{isLoading ? "…" : s.value}</CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
