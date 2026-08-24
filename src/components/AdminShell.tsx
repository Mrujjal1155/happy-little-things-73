import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bell,
  BarChart3,
  Boxes,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Radio,
  ReceiptText,
  Search,
  Settings,
  Ticket,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/products", label: "Products", icon: Boxes },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/codes", label: "Codes", icon: Ticket },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/webhook", label: "Webhook", icon: Radio },
] as const;

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="admin-theme flex min-h-screen">
      {/* Fixed vertical sidebar — identical on every device */}
      <aside className="flex w-[4.25rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:w-[16rem]">
        <div className="flex items-center gap-3 px-3 py-5 lg:px-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground">
            Q
          </span>
          <p className="hidden truncate text-xl font-extrabold tracking-tight lg:block">
            QORIX<span className="text-muted-foreground">STORE</span>
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 pt-3 lg:px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/admin" }}
              title={item.label}
              className="flex items-center justify-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:justify-start"
              activeProps={{
                className: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              }}
            >
              <item.icon className="size-5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-sidebar-border px-2 py-4 lg:px-3">
          <button
            onClick={signOut}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:justify-start"
          >
            <LogOut className="size-5 shrink-0" />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-sidebar/60 px-4 py-3 lg:px-6">
          <label className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              placeholder="Search…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex shrink-0 items-center gap-2">
            <button className="relative grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground">
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
            </button>
            {actions}
          </div>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 px-4 pt-6 lg:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight lg:text-3xl">{title}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {subtitle ?? "Portfolio performance overview for this month"}
            </p>
          </div>
          <span className="hidden shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-success" /> Systems online
          </span>
        </div>

        <main className="min-w-0 px-4 pb-10 pt-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

export function money(n: unknown) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

/** Shared panel wrapper so every admin page has the same crimson-on-carbon surface. */
export function AdminPanel({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("admin-panel rounded-2xl", className)}>
      {(title || action) && (
        <div className="flex items-center gap-3 border-b border-border/70 px-5 py-3.5">
          {title && <h2 className="text-base font-bold tracking-tight">{title}</h2>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
