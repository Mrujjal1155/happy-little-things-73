import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  PartyPopper,
  ShieldCheck,
  ShoppingCart,
  Star,
  Zap,
} from "lucide-react";
import { getStoreProduct, getStorePayInfo, placeWebsiteOrder } from "@/lib/shop.functions";
import { CategoryIcon } from "@/components/CategoryIcon";
import { StoreShell, priceTag } from "@/components/StoreShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/store/$id")({
  head: () => ({
    meta: [
      { title: "Product — QORIX Store" },
      {
        name: "description",
        content: "Review the product, pay with Binance Pay or USDT and submit your transaction ID to complete the order.",
      },
      { property: "og:title", content: "Product — QORIX Store" },
      { property: "og:description", content: "Secure crypto checkout for premium digital products." },
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
  const [checkout, setCheckout] = useState(false);

  const total = Number(product?.price ?? 0) * qty;
  const address = pay?.[METHODS.find((m) => m.id === method)!.key] ?? "";
  const stock = Number((product as any)?.stock ?? 0);
  const auto = product?.delivery_type === "auto";
  const oldPrice = Number(product?.old_price ?? 0);
  const off = oldPrice > Number(product?.price ?? 0) ? Math.round(((oldPrice - Number(product?.price)) / oldPrice) * 100) : 0;
  const included = (product?.description ?? "")
    .split("\n")
    .map((l: string) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);

  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: { product_id: id, quantity: qty, customer_name: name, customer_email: email, payment_method: method, txid },
      }),
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
          <PartyPopper className="mx-auto h-12 w-12 text-primary" />
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
      <section className="mx-auto max-w-6xl px-4 py-8">
        <Link
          to="/store"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Products
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* Gallery */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary/40">
            {off > 0 && (
              <span className="absolute left-4 top-4 z-10 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow">
                {off}% OFF
              </span>
            )}
            {product?.image_url ? (
              <img src={product.image_url} alt={product.name} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-primary">
                <CategoryIcon name={product?.name} className="h-28 w-28" />
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-destructive">
              <Eye className="h-4 w-4" /> 21 people are watching this now
            </p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{product?.name ?? "Loading…"}</h1>

            <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-warning text-warning" />
              ))}
              <span className="ml-1">(5/5)</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-5 text-sm">
              <span className={`inline-flex items-center gap-1.5 ${auto && stock === 0 ? "text-destructive" : "text-success"}`}>
                <CheckCircle2 className="h-4 w-4" />
                {auto ? `${stock} in stock` : "Made to order"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {product?.delivery_time || (auto ? "Instant Delivery" : "Manual Delivery")}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-primary">{priceTag(product?.price)}</span>
              {oldPrice ? <span className="text-lg text-muted-foreground line-through">{priceTag(oldPrice)}</span> : null}
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-xl text-center"
                  aria-label="Quantity"
                />
                <Button variant="secondary" size="lg" className="flex-1 rounded-xl" onClick={() => setCheckout(true)}>
                  <ShoppingCart className="h-4 w-4" /> Add to Cart
                </Button>
                <Button size="lg" className="flex-1 rounded-xl" onClick={() => setCheckout(true)}>
                  <Zap className="h-4 w-4" /> Buy Now
                </Button>
              </div>
              <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-success" /> Secure Payment
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-success" /> {auto ? "Instant Delivery" : "Fast Delivery"}
                </span>
              </div>
            </div>

            {included.length > 0 && (
              <div className="mt-7">
                <h2 className="text-base font-bold">What&apos;s Included</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {included.map((line: string) => (
                    <li key={line} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Detailed description */}
        {product?.description && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight">Detailed Description</h2>
            <div className="mt-4 rounded-2xl border border-border bg-card p-6">
              <p className="flex items-center justify-center gap-2 text-lg font-bold">
                <CategoryIcon name={product.name} className="h-5 w-5 text-primary" />
                {product.name}
              </p>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </div>
          </div>
        )}

        {/* Checkout */}
        {checkout && (
          <Card id="checkout" className="mt-12 overflow-hidden glass-panel tilt-in">
            <CardHeader className="border-b border-border/60 bg-primary/5">
              <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" /> Secure Crypto Checkout
                </span>
                <span className="text-primary">{priceTag(total)}</span>
              </CardTitle>
              <div className="mt-4 flex items-center gap-2">
                {["Details", "Pay", "Confirm"].map((s, i) => {
                  const active = step >= i + 1;
                  return (
                    <div key={s} className="flex flex-1 items-center gap-2">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                      {i < 2 && <span className={`h-px flex-1 ${step > i + 1 ? "bg-primary" : "bg-border"}`} />}
                    </div>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {step === 1 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Your name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
                  </div>
                  <div className="space-y-1">
                    <Label>Email (delivery + tracking)</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Payment method</Label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {METHODS.map((m) => {
                        const on = method === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setMethod(m.id)}
                            className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
                              on ? "border-primary bg-primary/10 card-glow" : "border-border bg-card"
                            }`}
                          >
                            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                              <m.icon className="h-4 w-4" />
                            </span>
                            <p className="mt-3 text-sm font-semibold">{m.label}</p>
                            <p className="text-xs text-muted-foreground">{m.hint}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    className="md:col-span-2"
                    disabled={!name.trim() || !email.trim()}
                    onClick={() => setStep(2)}
                  >
                    Continue to payment <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Exact amount</p>
                    <button
                      className="mt-1 inline-flex items-center gap-2 text-3xl font-extrabold text-primary"
                      onClick={() => copy(total.toFixed(2))}
                    >
                      {total.toFixed(2)} USDT <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Send to · {METHODS.find((m) => m.id === method)!.label}
                    </p>
                    <button
                      className="mt-2 block w-full break-all rounded-xl bg-muted/60 p-3 text-left font-mono text-xs hover:bg-muted"
                      onClick={() => address && copy(address)}
                    >
                      {address || "Not configured yet — contact support"}
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">Tap to copy. Send the exact amount, then continue.</p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button className="flex-1" onClick={() => setStep(3)}>
                      I have paid <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Transaction ID</Label>
                    <Input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Paste TXID / Binance order id" />
                    <p className="text-xs text-muted-foreground">
                      We verify the transaction automatically and deliver to {email || "your email"}.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!product || !txid.trim() || mut.isPending}
                      onClick={() => mut.mutate()}
                    >
                      {mut.isPending ? "Placing order…" : `Place order · ${priceTag(total)}`}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </section>
    </StoreShell>
  );
}
