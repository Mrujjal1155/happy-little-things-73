import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOverview } from "@/lib/admin.functions";
import { AdminShell, AdminPanel, money } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Plus, Users, DollarSign, ShoppingBag, TrendingUp, MapPin } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — QORIX Store Admin" },
      { name: "description", content: "Revenue, users, orders today and pending payments for your Telegram shop bot." },
      { property: "og:title", content: "Dashboard — QORIX Store Admin" },
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

  const recent: any[] = (data?.recentOrders ?? []) as any[];

  const stats = [
    { label: "Total users", value: data?.totalUsers ?? 0, icon: Users, delta: "+12%", up: true },
    { label: "Total revenue", value: money(data?.revenue), icon: DollarSign, delta: "+8%", up: true },
    { label: "Orders today", value: data?.ordersToday ?? 0, icon: ShoppingBag, delta: "+24%", up: true },
    { label: "Pending payments", value: data?.pendingPayments ?? 0, icon: TrendingUp, delta: "-4%", up: false },
  ];

  const chartData = [...recent]
    .reverse()
    .map((o, i) => ({ name: `#${o.order_no ?? i + 1}`, value: Number(o.total ?? 0) }));

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Store performance overview for this month"
      actions={
        <Button className="gap-2 rounded-full font-semibold">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add Product</span>
        </Button>
      }
    >
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="admin-panel rounded-2xl p-4 lg:p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm text-muted-foreground">{s.label}</p>
              <s.icon className="size-4 shrink-0 text-primary" />
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-2">
              <p className="text-2xl font-extrabold tracking-tight tabular-nums lg:text-3xl">
                {isLoading ? "…" : s.value}
              </p>
              <span className={s.up ? "text-xs font-semibold text-success" : "text-xs font-semibold text-primary"}>
                {s.delta}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <AdminPanel title="Sales Overview">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.length ? chartData : [{ name: "—", value: 0 }]}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} stroke="var(--border)" />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} stroke="var(--border)" width={36} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AdminPanel>

        <AdminPanel title="Recent Orders">
          <ul className="space-y-3">
            {recent.slice(0, 6).map((o) => (
              <li key={o.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
                  <MapPin className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{o.product_name}</p>
                  <p className="truncate text-xs text-muted-foreground">#{o.order_no} · {o.telegram_id}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-primary">{money(o.total)}</p>
                  <p
                    className={
                      o.status === "completed"
                        ? "text-[0.65rem] font-bold uppercase tracking-wider text-success"
                        : "text-[0.65rem] font-bold uppercase tracking-wider text-warning"
                    }
                  >
                    {o.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {!isLoading && recent.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
