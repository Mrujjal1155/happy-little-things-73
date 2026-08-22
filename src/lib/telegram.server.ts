// Server-only Telegram API helper.
// Uses the Lovable connector gateway when TELEGRAM_API_KEY is configured,
// otherwise falls back to a direct bot token (TELEGRAM_BOT_TOKEN).
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export type TgResult = { ok: boolean; result?: any; description?: string };

export async function tg(method: string, body: Record<string, unknown> = {}): Promise<TgResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url: string;

  if (token) {
    url = `https://api.telegram.org/bot${token}/${method}`;
  } else {
    const connKey = process.env["TELEGRAM_API_KEY"];
    const lovableKey = process.env["LOVABLE_API_KEY"];
    if (!connKey || !lovableKey) {
      throw new Error("Telegram credentials missing (TELEGRAM_BOT_TOKEN or TELEGRAM_API_KEY)");
    }
    url = `${GATEWAY_URL}/${method}`;
    headers["Authorization"] = `Bearer ${lovableKey}`;
    headers["X-Connection-Api-Key"] = connKey;
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({ ok: false }))) as TgResult;
  if (!res.ok || json.ok === false) {
    console.error(`Telegram ${method} failed [${res.status}]:`, JSON.stringify(json));
  }
  return json;
}

export type Button = { text: string; callback_data?: string; url?: string };

export function sendMessage(
  chat_id: number | string,
  text: string,
  keyboard?: Button[][],
  extra: Record<string, unknown> = {},
) {
  return tg("sendMessage", {
    chat_id,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    ...extra,
  });
}

export function editMessage(
  chat_id: number | string,
  message_id: number,
  text: string,
  keyboard?: Button[][],
) {
  return tg("editMessageText", {
    chat_id,
    message_id,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function answerCallback(callback_query_id: string, text?: string, show_alert = false) {
  return tg("answerCallbackQuery", { callback_query_id, text, show_alert });
}

export function deleteMessage(chat_id: number | string, message_id: number) {
  return tg("deleteMessage", { chat_id, message_id });
}

export function setWebhook(url: string, secret_token: string) {
  return tg("setWebhook", {
    url,
    secret_token,
    allowed_updates: ["message", "edited_message", "callback_query"],
  });
}

export function getWebhookInfo() {
  return tg("getWebhookInfo", {});
}

export function getMe() {
  return tg("getMe", {});
}

export function setMyCommands() {
  return tg("setMyCommands", {
    commands: [
      { command: "start", description: "Open the home menu" },
      { command: "shop", description: "Browse the shop" },
      { command: "cart", description: "View your cart" },
      { command: "checkout", description: "Checkout and pay" },
      { command: "orders", description: "View your orders" },
      { command: "wallet", description: "View your wallet & balance" },
      { command: "profile", description: "View your profile" },
      { command: "support", description: "Contact support" },
    ],
  });
}
