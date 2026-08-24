import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Bot,
  CreditCard,
  Globe,
  KeyRound,
  MessageCircle,
  Monitor,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react";

const TOOLS = [
  { name: "ChatGPT Plus", icon: Sparkles, color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { name: "Midjourney", icon: Zap, color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { name: "Netflix", icon: Monitor, color: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  { name: "VPN Pro", icon: Globe, color: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
];

export function HeroAnimation() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-background to-secondary/40 p-6 sm:p-10">
      {/* ambient orbs */}
      <span className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />
      <span className="pointer-events-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-success/10 blur-[80px]" />

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
            Order from our website or Telegram bot. Pay with Binance Pay or USDT. Receive your account, key or activation code automatically — no waiting.
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

        {/* right: animated flow */}
        <div className="relative mx-auto w-full max-w-md">
          {/* floating product cards */}
          <div className="hero-orbit absolute inset-0">
            {TOOLS.map((t, i) => {
              const Icon = t.icon;
              const delay = i * 1.5;
              const angle = i * 90;
              return (
                <div
                  key={t.name}
                  className="hero-card absolute left-1/2 top-1/2 flex w-36 items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-lg"
                  style={{
                    animationDelay: `${delay}s`,
                    transform: `rotate(${angle}deg) translateX(110px) rotate(-${angle}deg) translate(-50%, -50%)`,
                  }}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${t.color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold">{t.name}</span>
                </div>
              );
            })}
          </div>

          {/* center hub */}
          <div className="hero-hub mx-auto grid h-28 w-28 place-items-center rounded-full border-4 border-primary/20 bg-card shadow-2xl shadow-primary/20">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground">
              <ShoppingBag className="h-9 w-9" />
            </div>
          </div>

          {/* order flow beam */}
          <div className="hero-flow mt-8 flex items-center justify-center gap-3">
            <div className="hero-node flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-md">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span className="hero-beam absolute inset-y-0 left-0 w-8 rounded-full bg-primary" />
            </div>
            <div className="hero-node flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-md">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span className="hero-beam absolute inset-y-0 left-0 w-8 rounded-full bg-success" style={{ animationDelay: "0.6s" }} />
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
