import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listStorefront } from "@/lib/shop.functions";
import { StoreShell, priceTag } from "@/components/StoreShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "Store — QORIX Digital Goods" },
      { name: "description", content: "Browse premium digital products with instant automatic delivery or fast manual fulfilment." },
      { property: "og:title", content: "Store — QORIX Digital Goods" },
      { property: "og:description", content: "Premium digital products, instant delivery, secure crypto checkout." },
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
  const products = (data?.products ?? []).filter((p: any) => {
    if (cat !== "all" && p.category_id !== cat) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <StoreShell>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">The store</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Same catalogue as our Telegram bot — pay with Binance Pay or USDT and receive your product.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={cat === "all" ? "default" : "outline"} onClick={() => setCat("all")}>
            All
          </Button>
          {categories.map((c: any) => (
            <Button key={c.id} size="sm" variant={cat === c.id ? "default" : "outline"} onClick={() => setCat(c.id)}>
              {c.emoji} {c.name}
            </Button>
          ))}
          <Input
            className="ml-auto w-full max-w-xs"
            placeholder="Search products…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading catalogue…</p>
        ) : products.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">No products found.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p: any) => (
              <Card
                key={p.id}
                className="group relative overflow-hidden border-border/70 bg-card/70 transition-all hover:-translate-y-1 hover:border-primary/60"
              >
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-3xl">{p.emoji ?? "📦"}</span>
                    <Badge variant={p.delivery_type === "auto" ? "default" : "secondary"}>
                      {p.delivery_type === "auto" ? "Instant" : "Manual"}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-medium leading-tight">{p.name}</h2>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.description || "Digital product"}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-semibold text-primary">{priceTag(p.price)}</span>
                    {p.old_price ? (
                      <span className="text-sm text-muted-foreground line-through">{priceTag(p.old_price)}</span>
                    ) : null}
                  </div>
                  <Button asChild className="w-full">
                    <Link to="/store/$id" params={{ id: p.id }}>
                      Buy now
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </StoreShell>
  );
}
