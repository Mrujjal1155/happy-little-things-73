import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Telegram Digital Shop Bot — Auto Delivery Store" },
      {
        name: "description",
        content:
          "A Telegram shop bot with instant automatic delivery, wallet top-ups, referral rewards and a full web admin dashboard.",
      },
      { property: "og:title", content: "Telegram Digital Shop Bot — Auto Delivery Store" },
      {
        property: "og:description",
        content: "Sell digital products on Telegram with instant delivery, wallet, referrals and admin dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { title: "Instant auto delivery", body: "Stock credentials are popped and sent the moment an order is paid." },
  { title: "Wallet & deposits", body: "Binance Pay, USDT BEP-20, bKash and Nagad requests with admin approval." },
  { title: "Referral rewards", body: "Every user gets a referral link and earns commission on referred spending." },
  { title: "Full admin dashboard", body: "Products, stock, orders, payments, users, redeem codes and settings." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">Telegram Commerce</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Digital product shop bot with automatic delivery
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
          Run your whole store inside Telegram — catalogue, wallet, orders and delivery — while you manage
          everything from a clean web dashboard.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Open admin dashboard</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-24 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle className="text-lg">{f.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{f.body}</CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
