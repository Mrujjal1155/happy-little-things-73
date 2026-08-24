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
    <div className="admin-theme flex min-h-screen">
      {/* Vertical rail — nav sits beside the content, not above it */}
      <aside className="sticky top-0 hidden h-screen w-[15rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-lg font-black text-primary-foreground">
            Q
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">QORIX</p>
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto py-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/admin" }}
              className="flex items-center gap-3 px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "admin-rail-active text-sidebar-accent-foreground" }}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex flex-col">
                <span className="font-medium">{item.label}</span>
                <span className="text-[0.65rem] uppercase tracking-wider opacity-60">{item.hint}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile rail */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-1 overflow-x-auto border-t border-sidebar-border bg-sidebar px-2 py-1.5 lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/admin" }}
            className="flex min-w-16 flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[0.6rem] text-muted-foreground"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="min-w-0 flex-1 admin-grid-bg">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-5 lg:px-8">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-primary">Admin</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          </div>
          <span className="ml-auto hidden items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-success" /> Systems online
          </span>
          <Button variant="outline" size="sm" className="lg:hidden" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="px-5 pb-24 pt-6 lg:px-8 lg:pb-10">{children}</main>
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
