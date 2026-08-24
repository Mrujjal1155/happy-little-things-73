import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LayoutDashboard, LogOut, Package, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoreShell } from "@/components/StoreShell";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/account/orders", label: "My orders", icon: Package, exact: false },
  { to: "/account/profile", label: "Profile", icon: UserRound, exact: false },
] as const;

export function AccountShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </div>

        <nav className="mt-6 flex flex-wrap gap-1 rounded-2xl border border-border/70 bg-card/60 p-1.5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6">{children}</div>
      </div>
    </StoreShell>
  );
}

export function statusTone(status: string) {
  if (status === "completed") return "text-success";
  if (status === "cancelled" || status === "rejected") return "text-destructive";
  return "text-primary";
}
