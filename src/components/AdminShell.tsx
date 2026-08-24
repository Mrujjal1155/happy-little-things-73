import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Boxes,
  CreditCard,
  LogOut,
  Radio,
  ReceiptText,
  Settings,
  Ticket,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/admin", label: "Analytics", hint: "Live overview", icon: BarChart3 },
  { to: "/admin/products", label: "Products", hint: "Catalog & stock", icon: Boxes },
  { to: "/admin/orders", label: "Orders", hint: "Fulfilment", icon: ReceiptText },
  { to: "/admin/payments", label: "Payments", hint: "Deposits", icon: CreditCard },
  { to: "/admin/users", label: "Users", hint: "Customers", icon: Users },
  { to: "/admin/codes", label: "Codes", hint: "Redeem & coupons", icon: Ticket },
  { to: "/admin/settings", label: "Settings", hint: "Bot config", icon: Settings },
  { to: "/admin/webhook", label: "Webhook", hint: "Telegram link", icon: Radio },
] as const;

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="admin-theme min-h-screen admin-grid-bg">
      {/* Horizontal top nav — same layout on every device */}
      <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 lg:gap-4 lg:px-8">
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-lg font-black text-primary-foreground">
              Q
            </span>
            <div className="hidden min-w-0 leading-tight md:block">
              <p className="truncate text-sm font-semibold tracking-tight">QORIX</p>
              <p className="truncate text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">Console</p>
            </div>
          </div>

          <nav className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/admin" }}
                className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={signOut}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 px-5 py-5 lg:px-8">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-primary">Admin</p>
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          </div>
          <span className="hidden shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-success" /> Systems online
          </span>
        </div>
        <main className="px-5 pb-10 pt-6 lg:px-8">{children}</main>
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
    <section className={cn("admin-panel rounded-xl", className)}>
      {(title || action) && (
        <div className="flex items-center gap-3 border-b border-border/70 px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">{title}</h2>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
