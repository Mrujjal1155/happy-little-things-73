import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const NAV = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/products", label: "Products & Stock" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/payments", label: "Payments" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/codes", label: "Redeem Codes" },
  { to: "/admin/settings", label: "Settings" },
  { to: "/admin/webhook", label: "Webhook" },

] as const;

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-sidebar">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-lg font-semibold tracking-tight text-primary">Shop Bot Admin</span>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/admin" }}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                activeProps={{ className: "bg-sidebar-accent text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button variant="outline" size="sm" className="ml-auto" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function money(n: unknown) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}
