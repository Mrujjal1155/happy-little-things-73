import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getBotSettings, registerWebhook, saveBotSettings } from "@/lib/admin.functions";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Shop Bot Admin" },
      { name: "description", content: "Configure bot name, welcome text, payment addresses, admin IDs and register the Telegram webhook." },
      { property: "og:title", content: "Settings — Shop Bot Admin" },
      { property: "og:description", content: "Bot configuration and webhook registration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const FIELDS: { key: string; label: string; long?: boolean }[] = [
  { key: "bot_name", label: "Bot name" },
  { key: "welcome_text", label: "Welcome text", long: true },
  { key: "binance_pay", label: "Binance Pay ID" },
  { key: "usdt_bep20", label: "USDT BEP-20 address" },
  { key: "bkash_number", label: "bKash number" },
  { key: "nagad_number", label: "Nagad number" },
  { key: "announce_chat_id", label: "Announcement channel/group ID" },
  { key: "admin_ids", label: "Admin telegram IDs (comma separated)" },
  { key: "support_link", label: "Support link" },
  { key: "referral_percent", label: "Referral commission %" },
  { key: "freebies_text", label: "Freebies page", long: true },
  { key: "emails_trials_text", label: "Emails & Trials page", long: true },
  { key: "reseller_api_text", label: "Reseller API page", long: true },
];

function SettingsPage() {
  const fetchSettings = useServerFn(getBotSettings);
  const save = useServerFn(saveBotSettings);
  const hook = useServerFn(registerWebhook);
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  async function onSave() {
    try {
      await save({ data: { values } });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function onConnect() {
    try {
      const r = await hook({ data: { origin: window.location.origin } });
      if (r.ok) toast.success("Webhook registered");
      else toast.error(r.message ?? "Webhook registration failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminShell title="Settings">
      <Card>
        <CardHeader>
          <CardTitle>Bot configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={`space-y-1 ${f.long ? "sm:col-span-2" : ""}`}>
              <Label>{f.label}</Label>
              {f.long ? (
                <Textarea
                  rows={3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              ) : (
                <Input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={onSave}>Save settings</Button>
            <Button variant="outline" onClick={onConnect}>
              Connect webhook
            </Button>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
