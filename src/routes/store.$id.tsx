import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getStoreProduct, getStorePayInfo, placeWebsiteOrder } from "@/lib/shop.functions";
import { CategoryIcon } from "@/components/CategoryIcon";
import { StoreShell, priceTag } from "@/components/StoreShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/store/$id")({
  head: () => ({
    meta: [
      { title: "Checkout — QORIX Store" },
      { name: "description", content: "Review the product, pay with Binance Pay or USDT and submit your transaction ID to complete the order." },
      { property: "og:title", content: "Checkout — QORIX Store" },
      { property: "og:description", content: "Secure crypto checkout for digital products." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductPage,
});

const METHODS = [
  { id: "binance", label: "Binance Pay", key: "binance_pay_id" },
  { id: "usdt_bep20", label: "USDT · BEP-20", key: "usdt_bep20_address" },
  { id: "usdt_trc20", label: "USDT · TRC-20", key: "usdt_trc20_address" },
] as const;

function ProductPage() {
  const { id } = Route.useParams();
  const fetchProduct = useServerFn(getStoreProduct);
  const fetchPay = useServerFn(getStorePayInfo);
  const submit = useServerFn(placeWebsiteOrder);

  const { data: product } = useQuery({ queryKey: ["store-product", id], queryFn: () => fetchProduct({ data: { id } }) });
  const { data: pay } = useQuery({ queryKey: ["store-pay"], queryFn: () => fetchPay() });

  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<string>("binance");
  const [txid, setTxid] = useState("");
  const [placed, setPlaced] = useState<number | null>(null);

  const total = Number(product?.price ?? 0) * qty;
  const address = pay?.[METHODS.find((m) => m.id === method)!.key] ?? "";

  const mut = useMutation({
    mutationFn: () =>
      submit({ data: { product_id: id, quantity: qty, customer_name: name, customer_email: email, payment_method: method, txid } }),
    onSuccess: (r) => {
      setPlaced(r.order_no);
      toast.success(`Order #${r.order_no} placed`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copy(v: string) {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  }

  if (placed) {
    return (
      <StoreShell>
        <section className="mx-auto max-w-xl px-4 py-24 text-center">
          <div className="text-5xl">🎉</div>
          <h1 className="mt-4 text-3xl font-semibold">Order #{placed} received</h1>
          <p className="mt-3 text-muted-foreground">
            We are verifying your payment. Delivery is sent to <strong>{email}</strong> and shown on the tracking page.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild>
              <Link to="/track">Track my order</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/store">Keep shopping</Link>
            </Button>
          </div>
        </section>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 lg:grid-cols-[1fr_420px]">
        <Card className="bg-card/70">
          <CardContent className="space-y-4 pt-6">
            <div className="overflow-hidden rounded-xl border border-border bg-secondary/50">
              {product?.image_url ? (
                <img src={product.image_url} alt={product.name} className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-primary">
                  <CategoryIcon name={product?.name} className="h-20 w-20" />
                </div>
              )}
            </div>
            <div className="flex items-start justify-between">
              <span className="text-sm text-muted-foreground">
                {product?.delivery_time || (product?.delivery_type === "auto" ? "Instant delivery" : "Manual delivery")}
              </span>
              {product && (
                <Badge variant={product.delivery_type === "auto" ? "default" : "secondary"}>
                  {product.delivery_type === "auto" ? "Instant delivery" : "Manual delivery"}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{product?.name ?? "Loading…"}</h1>
            <p className="whitespace-pre-wrap text-muted-foreground">{product?.description}</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-semibold text-primary">{priceTag(product?.price)}</span>
              {product?.old_price ? (
                <span className="text-muted-foreground line-through">{priceTag(product.old_price)}</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle>Checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div className="space-y-1">
              <Label>Your name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-1">
              <Label>Email (delivery + tracking)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" />
            </div>

            <div className="space-y-2">
              <Label>Payment method</Label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <Button key={m.id} size="sm" variant={method === m.id ? "default" : "outline"} onClick={() => setMethod(m.id)}>
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Amount</span>
                <button className="font-semibold text-primary" onClick={() => copy(total.toFixed(2))}>
                  {total.toFixed(2)} USDT ⧉
                </button>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Send to</span>
                <button
                  className="block w-full break-all rounded bg-background p-2 text-left font-mono text-xs"
                  onClick={() => address && copy(address)}
                >
                  {address || "Not configured yet — contact support"}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Transaction ID</Label>
              <Input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Paste TXID / Binance order id" />
            </div>

            <Button className="w-full" disabled={!product || mut.isPending} onClick={() => mut.mutate()}>
              {mut.isPending ? "Placing order…" : `Place order · ${priceTag(total)}`}
            </Button>
          </CardContent>
        </Card>
      </section>
    </StoreShell>
  );
}
