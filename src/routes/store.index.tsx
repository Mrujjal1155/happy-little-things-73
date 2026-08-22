import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { listStorefront } from "@/lib/shop.functions";
import { StoreShell } from "@/components/StoreShell";
import { ProductCard, type StoreProduct } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/store/")({
  head: () => ({
    meta: [
      { title: "All Products — QORIX Store" },
      { name: "description", content: "Browse AI tools, creative apps, VPN, streaming and productivity subscriptions with instant delivery." },
      { property: "og:title", content: "All Products — QORIX Store" },
      { property: "og:description", content: "Premium digital subscriptions at the best price, delivered instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const fetchStore = useServerFn(listStorefront);
  const { data, isLoading } = useQuery({ queryKey: ["storefront"], queryFn: () => fetchStore() });
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  const categories = data?.categories ?? [];
  const products = ((data?.products ?? []) as StoreProduct[]).filter((p: any) => {
    if (cat !== "all" && p.category_id !== cat) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <StoreShell>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All products</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Same catalogue as our Telegram bot — pay with Binance Pay or USDT.
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-full pl-9"
              placeholder="Search products…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <CatPill active={cat === "all"} onClick={() => setCat("all")} label="All" emoji="🗂️" />
          {categories.map((c: any) => (
            <CatPill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.name} emoji={c.emoji} />
          ))}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="text-xl font-bold tracking-tight">
            {cat === "all" ? "Featured Products" : categories.find((c: any) => c.id === cat)?.name}
          </h2>
          <span className="h-px flex-1 bg-border" />
          <span className="text-sm text-muted-foreground">{products.length} items</span>
        </div>

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading catalogue…</p>
        ) : products.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">No products found.</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </StoreShell>
  );
}

function CatPill({
  active,
  onClick,
  label,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji?: string | null;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      <span className="mr-1">{emoji ?? "📁"}</span>
      {label}
    </button>
  );
}
