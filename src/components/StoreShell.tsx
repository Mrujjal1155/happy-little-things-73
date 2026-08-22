import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logo from "@/assets/qorix-logo.png";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/store", label: "Store" },
  { to: "/track", label: "Track order" },
] as const;

export function StoreShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 0%, color-mix(in oklab, var(--primary) 30%, transparent), transparent 70%), radial-gradient(50% 50% at 85% 10%, color-mix(in oklab, var(--chart-4) 26%, transparent), transparent 70%)",
        }}
      />
      <header className="relative z-10 border-b border-border/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="QORIX Store logo" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-lg font-semibold tracking-tight">
              QORIX <span className="text-primary">STORE</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="relative z-10">{children}</main>
      <footer className="relative z-10 border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} QORIX Store — digital goods, delivered instantly.
      </footer>
    </div>
  );
}

export function priceTag(n: unknown) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}
