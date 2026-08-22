import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import { listStorefront } from "@/lib/shop.functions";
import { StoreShell } from "@/components/StoreShell";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ProductCard, type StoreProduct } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import logo from "@/assets/qorix-logo.png";

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
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 55% at 50% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-20 text-center">
          <img src={logo} alt="QORIX Store" className="mx-auto h-20 w-20 rounded-2xl object-cover" />
          <h1 className="mt-8 text-5xl font-extrabold tracking-tight text-primary sm:text-7xl">QORIX Store</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            AI Tools, VPN, Creative Apps &amp; more — at the best price
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7 shadow-lg shadow-primary/25">
              <Link to="/store">
                <ShoppingBag className="h-4 w-4" /> Browse Products
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/track">
                <MessageCircle className="h-4 w-4" /> Track Order
              </Link>
            </Button>
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
