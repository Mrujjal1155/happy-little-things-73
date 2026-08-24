import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Clock,
  Headphones,
  LayoutGrid,
  LogIn,
  MessageCircle,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import logo from "@/assets/qorix-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme";
import { CategoryIcon } from "@/components/CategoryIcon";

const CATEGORY_LINKS = ["AI Tools", "Creative", "Productivity", "VPN", "Streaming", "Social"];

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);
  return signedIn;
}

export function StoreShell({ children }: { children: ReactNode }) {
  const signedIn = useSignedIn();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src={logo} alt="QORIX Store logo" className="h-9 w-9 rounded-xl object-cover" />
            <span className="hidden text-sm font-bold leading-tight tracking-tight sm:block">
              QORIX
              <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">store</span>
            </span>
          </Link>

          <Link
            to="/store"
            className="hidden min-w-0 items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 md:flex md:w-56"
          >
            <Search className="h-4 w-4" />
            Search products…
          </Link>

          <Link
            to="/store"
            search={{ c: "Social" }}
            className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 lg:inline-flex"
          >
            <CategoryIcon name="Social" className="h-4 w-4" /> Social
          </Link>

          <Link
            to="/store"
            search={{}}
            className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 lg:inline-flex"
          >
            <LayoutGrid className="h-4 w-4" /> Categories
          </Link>

          <nav className="hidden items-center gap-0.5 xl:flex">
            {CATEGORY_LINKS.slice(0, 4).map((c) => (
              <Link
                key={c}
                to="/store"
                search={{ c }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <CategoryIcon name={c} className="h-4 w-4" /> {c}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <ThemeToggle />
            {signedIn ? (
              <Link
                to="/account"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">My Account</span>
              </Link>
            ) : (
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Log in</span>
              </Link>
            )}
            <Link
              to="/track"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              <PackageSearch className="h-4 w-4" />
              <span className="hidden sm:inline">Track Order</span>
            </Link>
            <Link
              to="/store"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Open the store"
            >
              <ShoppingCart className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/70 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-base font-bold">
              QORIX <span className="text-primary">STORE</span>
            </span>
          </div>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Your one-stop shop for premium digital products, subscriptions and social services — on the web and inside
            Telegram.
          </p>
          <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> 100% Secure Payment
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Fast Delivery
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Headphones className="h-4 w-4 text-primary" /> 24/7 Support
            </span>
          </div>

          <div className="mt-10 grid gap-8 text-sm sm:grid-cols-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">Category</h2>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                {CATEGORY_LINKS.map((c) => (
                  <li key={c}>
                    <Link to="/store" search={{ c }} className="transition-colors hover:text-primary">
                      {c}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">Quick links</h2>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li>
                  <Link to="/store" className="transition-colors hover:text-primary">
                    All products
                  </Link>
                </li>
                <li>
                  <Link to="/track" className="transition-colors hover:text-primary">
                    Track order
                  </Link>
                </li>
                <li>
                  <Link to="/account" className="transition-colors hover:text-primary">
                    My account
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">Contact</h2>
              <p className="mt-3 inline-flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="h-4 w-4 text-success" /> Telegram support 24/7
              </p>
            </div>
          </div>

          <div className="mt-10 border-t border-border/70 pt-5 text-xs text-muted-foreground">
            © {new Date().getFullYear()} <span className="font-medium text-primary">QORIX Store</span>. All rights
            reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export function priceTag(n: unknown) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}
