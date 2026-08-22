import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWebhookStatus, registerWebhook } from "@/lib/admin.functions";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/webhook")({
  head: () => ({
    meta: [
      { title: "Webhook Status — Shop Bot Admin" },
      {
        name: "description",
        content:
          "Live Telegram webhook health: registered URL, pending updates, last error and the most recent update received by the bot.",
      },
      { property: "og:title", content: "Webhook Status — Shop Bot Admin" },
      { property: "og:description", content: "Telegram webhook health and update delivery status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WebhookStatusPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-full break-all text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function WebhookStatusPage() {
  const fetchStatus = useServerFn(getWebhookStatus);
  const hook = useServerFn(registerWebhook);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["webhook-status"],
    queryFn: () => fetchStatus({ data: { origin: window.location.origin } }),
    refetchInterval: 15000,
  });

  async function onReconnect() {
    try {
      const r = await hook({ data: { origin: window.location.origin } });
      if (r.ok) toast.success("Webhook registered");
      else toast.error(r.message ?? "Webhook registration failed");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const info = data?.info as any;
  const ok = Boolean(data?.configured && data?.matches);
  const lastErr = info?.last_error_message as string | undefined;

  return (
    <AdminShell title="Webhook Status">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={ok ? "border-primary/40" : "border-destructive/50"}>
          <CardHeader>
            <CardTitle>Endpoint</CardTitle>
          </CardHeader>
          <CardContent>
            {!data ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : !data.configured ? (
              <p className="text-sm text-destructive">
                ⚠️ Bot token is not configured. Add TELEGRAM_BOT_TOKEN first.
              </p>
            ) : (
              <>
                <p className={`mb-3 text-sm ${ok ? "text-primary" : "text-destructive"}`}>
                  {ok
                    ? "✅ Telegram is pointed at the correct endpoint."
                    : "⚠️ Telegram is not pointed at this app's endpoint."}
                </p>
                <Row label="Bot" value={data.botUsername ? `@${data.botUsername}` : "unknown"} />
                <Row label="Expected URL" value={data.expectedUrl} />
                <Row label="Registered URL" value={info?.url || "(none)"} />
                <Row
                  label="Secret token"
                  value={info?.has_custom_certificate === undefined ? "—" : "configured"}
                />
                <div className="mt-4">
                  <Button onClick={onReconnect}>
                    {ok ? "Re-register webhook" : "Fix & register webhook"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update delivery</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.configured ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <>
                <Row label="Pending updates" value={info?.pending_update_count ?? 0} />
                <Row label="Max connections" value={info?.max_connections ?? "—"} />
                <Row
                  label="Allowed updates"
                  value={(info?.allowed_updates ?? []).join(", ") || "all"}
                />
                <Row
                  label="Last Telegram error"
                  value={
                    lastErr ? (
                      <span className="text-destructive">
                        {lastErr}
                        {info?.last_error_date
                          ? ` (${new Date(info.last_error_date * 1000).toLocaleString()})`
                          : ""}
                      </span>
                    ) : (
                      "none"
                    )
                  }
                />
                <Row
                  label="Last update received"
                  value={
                    data.lastUpdate ? (
                      <span className="text-primary">
                        {new Date(data.lastUpdate.at).toLocaleString()} · {data.lastUpdate.kind} ·{" "}
                        {data.lastUpdate.from}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        no update received yet — send /start to the bot
                      </span>
                    )
                  }
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Auto-refreshes every 15s {isFetching ? "· refreshing…" : ""}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
