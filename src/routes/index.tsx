import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStorefront } from "@/lib/shop.functions";
import { StoreShell, priceTag } from "@/components/StoreShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QORIX Store — Premium Digital Products, Instantly Delivered" },
      {
        name: "description",
        content:
          "Buy premium digital products on the web or inside our Telegram bot. Instant automatic delivery, crypto checkout and 24/7 support.",
      },
      { property: "og:title", content: "QORIX Store — Premium Digital Products, Instantly Delivered" },
      {
        property: "og:description",
        content: "One catalogue, two channels: shop on the website or inside Telegram with instant delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PERKS = [
  { icon: "⚡", title: "Instant delivery", body: "Auto products are released the second your payment is verified." },
  { icon: "🛡️", title: "Safe crypto checkout", body: "Binance Pay, USDT BEP-20 and TRC-20 with transaction verification." },
  { icon: "🤖", title: "Telegram + Web", body: "Same catalogue, same prices — buy wherever you prefer." },
  { icon: "🎧", title: "Human support", body: "Manual services handled personally by our team, fast." },
];

function Landing() {
  const fetchStore = useServerFn(listStorefront);
  const { data } = useQuery({ queryKey: ["storefront"], queryFn: () => fetchStore() });
  const featured = (data?.products ?? []).slice(0, 6);

  return (
    <StoreShell>
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-primary">
          Digital goods marketplace
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
          Premium digital products,
          <br />
          <span className="bg-gradient-to-r from-primary to-chart-4 bg-clip-text text-transparent">
            delivered in seconds
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Shop the same catalogue on our website or inside the Telegram bot. Automatic products arrive instantly;
          manual services are fulfilled by our team.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/store">Browse the store</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/track">Track an order</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {PERKS.map((p) => (
          <Card key={p.title} className="border-border/70 bg-card/60">
            <CardContent className="space-y-2 pt-6">
              <div className="text-2xl">{p.icon}</div>
              <h2 className="font-medium">{p.title}</h2>
              <p className="text-sm text-muted-foreground">{p.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">Trending now</h2>
            <Link to="/store" className="text-sm text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p: any) => (
              <Card
                key={p.id}
                className="group border-border/70 bg-card/70 transition-all hover:-translate-y-1 hover:border-primary/60"
              >
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{p.emoji ?? "📦"}</span>
                    <Badge variant={p.delivery_type === "auto" ? "default" : "secondary"}>
                      {p.delivery_type === "auto" ? "Instant" : "Manual"}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-medium">{p.name}</h3>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.description || "Digital product"}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-primary">{priceTag(p.price)}</span>
                    <Button asChild size="sm">
                      <Link to="/store/$id" params={{ id: p.id }}>
                        Buy
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </StoreShell>
  );
}
