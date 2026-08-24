import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, MessageCircle, ShieldCheck, ShoppingBag, Sparkles, Zap } from "lucide-react";
import { listStorefront } from "@/lib/shop.functions";
import { StoreShell } from "@/components/StoreShell";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ProductCard, type StoreProduct } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { HeroAnimation } from "@/components/HeroAnimation";
import logo from "@/assets/qorix-logo.png";
import hero3d from "@/assets/hero-3d.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QORIX Store — AI Tools, VPN & Creative Apps at the Best Price" },
      {
        name: "description",
        content:
          "Premium digital subscriptions — AI tools, VPN, creative and productivity apps — delivered instantly on the web or through our Telegram bot.",
      },
      { property: "og:title", content: "QORIX Store — Premium Digital Subscriptions" },
      { property: "og:description", content: "AI Tools, VPN, Creative Apps & more — at the best price, delivered instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const fetchStore = useServerFn(listStorefront);
  const { data } = useQuery({ queryKey: ["storefront"], queryFn: () => fetchStore() });

  const categories = data?.categories ?? [];
  const products = (data?.products ?? []) as StoreProduct[];
  const countFor = (id: string) => products.filter((p: any) => p.category_id === id).length;

  return (
    <StoreShell>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <img
          src={hero3d}
          alt=""
          aria-hidden
          width={1920}
          height={1088}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70 dark:opacity-90"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(65% 60% at 50% 10%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 70%), linear-gradient(to bottom, color-mix(in oklab, var(--background) 45%, transparent), var(--background))",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-24 text-center tilt-in">
          <div className="float-3d mx-auto w-fit">
            <img
              src={logo}
              alt="QORIX Store"
              className="h-24 w-24 rounded-3xl object-cover shadow-2xl shadow-primary/40 ring-1 ring-primary/30"
            />
          </div>
          <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Instant digital delivery
          </p>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            <span className="bg-gradient-to-b from-foreground to-primary bg-clip-text text-transparent">QORIX Store</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            AI Tools, VPN, Creative Apps &amp; more — at the best price, delivered in seconds.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
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
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3">
            {[
              { icon: Zap, label: "Instant Delivery" },
              { icon: ShieldCheck, label: "Secure Crypto Pay" },
              { icon: Headphones, label: "24/7 Support" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="glass-panel rounded-2xl px-3 py-4">
                <Icon className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-xs font-medium sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c: any) => (
              <Link
                key={c.id}
                to="/store"
                className="group rounded-2xl border border-border bg-card px-4 py-6 text-center transition-all hover:-translate-y-1 hover:border-primary/60 hover:card-glow"
              >
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <CategoryIcon name={c.name} />
                </span>
                <h2 className="mt-3 text-sm font-semibold group-hover:text-primary">{c.name}</h2>
                <p className="text-xs text-muted-foreground">{countFor(c.id)} products</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      {products.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-20">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Featured Products</h2>
            <span className="h-px flex-1 bg-border" />
            <Link to="/store" className="text-sm text-primary hover:underline">
              View All →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </StoreShell>
  );
}
