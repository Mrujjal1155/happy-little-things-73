import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

export function deriveTelegramWebhookSecret(key: string): string {
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["TELEGRAM_API_KEY"] || process.env["TELEGRAM_BOT_TOKEN"];
        if (!key) return new Response("Bot not configured", { status: 503 });

        const expected = deriveTelegramWebhookSecret(key);
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        let update: any;
        try {
          update = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const from =
            update.message?.from ?? update.edited_message?.from ?? update.callback_query?.from;
          const kind = update.callback_query
            ? "callback_query"
            : update.edited_message
              ? "edited_message"
              : update.message
                ? "message"
                : "other";
          await (supabaseAdmin as any).from("bot_settings").upsert(
            [
              { key: "webhook_last_update_at", value: new Date().toISOString() },
              { key: "webhook_last_update_kind", value: kind },
              {
                key: "webhook_last_update_from",
                value: String(from?.username ? "@" + from.username : (from?.id ?? "unknown")),
              },
            ],
            { onConflict: "key" },
          );
        } catch (error) {
          console.error("Webhook status tracking failed:", error);
        }

        try {
          const { handleUpdate } = await import("@/lib/bot/engine.server");
          await handleUpdate(update);
        } catch (error) {
          console.error("Telegram update failed:", error);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
