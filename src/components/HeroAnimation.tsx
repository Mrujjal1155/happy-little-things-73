import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { priceTag } from "@/components/StoreShell";
import type { StoreProduct } from "@/components/ProductCard";
import {
  Bot,
  CreditCard,
  Globe,
  KeyRound,
  MessageCircle,
  Package,
  ShoppingBag,
  Zap,
} from "lucide-react";

export type HeroItem = {
  id?: string;
  name: string;
  image_url?: string | null;
  accent?: string | null;
};

function matchProducts(name: string, products: StoreProduct[]) {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 2);
  const scored = products
    .map((p) => {
      const hay = `${p.name} ${p.description ?? ""}`.toLowerCase();
      const score = words.reduce((s, w) => (hay.includes(w) ? s + 1 : s), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map((x) => x.p);
}

const ACCENTS: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  primary: "bg-primary/15 text-primary",
};

/* fixed scatter positions so every card lives in its own space */
const SPOTS = [
  "left-0 top-2",
  "right-0 top-16",
  "left-2 bottom-16",
  "right-2 bottom-0",
  "left-1/2 top-0 -translate-x-1/2",
  "left-1/2 bottom-1/2 -translate-x-1/2",
];

const FALLBACK: HeroItem[] = [
  { name: "ChatGPT Plus", accent: "emerald" },
  { name: "Midjourney", accent: "amber" },
  { name: "Netflix Premium", accent: "rose" },
  { name: "VPN Pro", accent: "sky" },
];

export function HeroAnimation({
  items,
  products = [],
}: {
  items?: HeroItem[];
  products?: StoreProduct[];
}) {
  const cards = (items && items.length > 0 ? items : FALLBACK).slice(0, 6);
  const [active, setActive] = useState<HeroItem | null>(null);
  const matches = active ? matchProducts(active.name, products) : [];


  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-background to-secondary/40 p-6 sm:p-10">
      <span className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />
      <span className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-success/10 blur-[80px]" />

      <div className="relative z-10 grid items-center gap-10 lg:grid-cols-2">
        {/* left: copy */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Instant digital delivery
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Buy AI tools & subscriptions.
            <span className="block text-primary">Delivered in seconds.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Order from our website or Telegram bot. Pay with Binance Pay or USDT. Receive your account, key or activation
            code automatically — no waiting.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm font-medium">
            <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-success">
              <KeyRound className="h-4 w-4" /> Auto delivery
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-primary">
              <CreditCard className="h-4 w-4" /> Crypto payment
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">
              <Bot className="h-4 w-4" /> Telegram bot
            </span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7 shadow-lg shadow-primary/30">
              <Link to="/store">
                <ShoppingBag className="h-4 w-4" /> Browse Products
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7 glass-panel">
              <Link to="/track">
                <MessageCircle className="h-4 w-4" /> Track Order
              </Link>
            </Button>
          </div>
        </div>

        {/* right: independently floating product cards */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="relative h-72 sm:h-80">
            {cards.map((item, i) => (
              <div
                key={item.id ?? item.name}
                className={`absolute ${SPOTS[i % SPOTS.length]} hero-float-${i % 6} flex w-40 items-center gap-2.5 rounded-xl border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur transition-transform hover:scale-[1.06]`}
                style={{ animationDelay: `${i * 0.7}s` }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    loading="lazy"
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ACCENTS[item.accent ?? "primary"] ?? ACCENTS["primary"]}`}
                  >
                    <Package className="h-5 w-5" />
                  </span>
                )}
                <span className="truncate text-xs font-semibold">{item.name}</span>
              </div>
            ))}

            {/* center hub */}
            <div className="hero-hub absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-primary/20 bg-card shadow-2xl shadow-primary/20">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground">
                <ShoppingBag className="h-8 w-8" />
              </div>
            </div>
          </div>

          {/* order flow beam */}
          <div className="hero-flow mt-4 flex items-center justify-center gap-3">
            <div className="hero-node flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-md">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="relative h-1.5 w-14 overflow-hidden rounded-full bg-muted">
              <span className="hero-beam absolute inset-y-0 left-0 w-8 rounded-full bg-primary" />
            </div>
            <div className="hero-node flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-md">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="relative h-1.5 w-14 overflow-hidden rounded-full bg-muted">
              <span
                className="hero-beam absolute inset-y-0 left-0 w-8 rounded-full bg-success"
                style={{ animationDelay: "0.6s" }}
              />
            </div>
            <div className="hero-node flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-md">
              <KeyRound className="h-5 w-5 text-success" />
            </div>
          </div>

          {/* delivery notification */}
          <div className="hero-delivery mx-auto mt-6 flex max-w-xs items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/10 text-success">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold">Order #2849 delivered</p>
              <p className="truncate text-[11px] text-muted-foreground">Your ChatGPT Plus key: gpt-xxxxxxxx</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
