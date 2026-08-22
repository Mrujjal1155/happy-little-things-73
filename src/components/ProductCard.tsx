import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, ShoppingCart, Star, Zap } from "lucide-react";
import { priceTag } from "@/components/StoreShell";
import { Button } from "@/components/ui/button";

export type StoreProduct = {
  id: string;
  name: string;
  emoji?: string | null;
  description?: string | null;
  price: number;
  old_price?: number | null;
  image_url?: string | null;
  delivery_time?: string | null;
  badge?: string | null;
  delivery_type: string;
  stock?: number;
};

export function discountPct(p: StoreProduct) {
  const old = Number(p.old_price ?? 0);
  if (!old || old <= Number(p.price)) return 0;
  return Math.round(((old - Number(p.price)) / old) * 100);
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const off = discountPct(product);
  const inStock = product.delivery_type === "manual" ? true : (product.stock ?? 0) > 0;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:card-glow">
      <Link
        to="/store/$id"
        params={{ id: product.id }}
        className="relative block aspect-square overflow-hidden bg-secondary/60"
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-chart-4/15 text-6xl">
            {product.emoji ?? "📦"}
          </span>
        )}
        {off > 0 && (
          <span className="absolute left-3 top-3 rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground shadow">
            {off}% OFF
          </span>
        )}
        {product.badge && (
          <span className="absolute right-3 top-3 rounded-md bg-warning px-2 py-0.5 text-[11px] font-bold text-warning-foreground">
            {product.badge}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="text-sm font-semibold leading-snug">{product.name}</h3>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-warning text-warning" />
          ))}
          <span className="ml-1">(4.5k)</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={`inline-flex items-center gap-1 ${inStock ? "text-success" : "text-destructive"}`}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {product.delivery_type === "manual" ? "On order" : `${product.stock ?? 0} left`}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {product.delivery_time || (product.delivery_type === "auto" ? "Instant" : "Manual")}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">{priceTag(product.price)}</span>
          {product.old_price ? (
            <span className="text-xs text-muted-foreground line-through">{priceTag(product.old_price)}</span>
          ) : null}
          {off > 0 && (
            <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">
              -{off}%
            </span>
          )}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <Button asChild size="sm" variant="outline" className="rounded-lg">
            <Link to="/store/$id" params={{ id: product.id }}>
              <ShoppingCart className="h-4 w-4" /> Details
            </Link>
          </Button>
          <Button asChild size="sm" className="rounded-lg">
            <Link to="/store/$id" params={{ id: product.id }}>
              <Zap className="h-4 w-4" /> Buy
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
