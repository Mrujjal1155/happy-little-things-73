import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const isAdminUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context as any).supabase.rpc("has_role", {
      _user_id: (context as any).userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const [users, pendingPayments, ordersToday, completed, recent] = await Promise.all([
      sb.from("bot_users").select("telegram_id", { count: "exact", head: true }),
      sb.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
      sb.from("orders").select("total").eq("status", "completed"),
      sb.from("orders").select("*").order("created_at", { ascending: false }).limit(10),
    ]);

    const revenue = (completed.data ?? []).reduce((a: number, r: any) => a + Number(r.total), 0);
    return {
      totalUsers: users.count ?? 0,
      pendingPayments: pendingPayments.count ?? 0,
      ordersToday: ordersToday.count ?? 0,
      revenue,
      recentOrders: recent.data ?? [],
    };
  });

/* --------------------------------------------------------------- catalogue */

export const getCatalogue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const [cats, prods, stock] = await Promise.all([
      sb.from("categories").select("*").order("sort_order"),
      sb.from("products").select("*").order("sort_order"),
      sb.from("stock_items").select("product_id,is_sold"),
    ]);
    const counts: Record<string, number> = {};
    for (const s of stock.data ?? []) if (!s.is_sold) counts[s.product_id] = (counts[s.product_id] ?? 0) + 1;
    return {
      categories: cats.data ?? [],
      products: (prods.data ?? []).map((p: any) => ({ ...p, stock: counts[p.id] ?? 0 })),
    };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; emoji?: string; sort_order?: number; channel?: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const row = {
      name: data.name,
      emoji: data.emoji ?? "📁",
      sort_order: data.sort_order ?? 0,
      channel: data.channel ?? "both",
    };
    const { error } = data.id
      ? await sb.from("categories").update(row).eq("id", data.id)
      : await sb.from("categories").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context as any).supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      category_id?: string | null;
      name: string;
      emoji?: string;
      description?: string;
      price: number;
      old_price?: number | null;
      delivery_type: "auto" | "manual";
      manual_note?: string;
      image_url?: string | null;
      delivery_time?: string | null;
      badge?: string | null;
      is_active?: boolean;
      sort_order?: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const { id, ...rest } = data;
    const row = {
      ...rest,
      category_id: rest.category_id || null,
      old_price: rest.old_price ?? null,
      image_url: rest.image_url || null,
      delivery_time: rest.delivery_time || null,
      badge: rest.badge || null,
    };
    const { error } = id
      ? await sb.from("products").update(row).eq("id", id)
      : await sb.from("products").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context as any).supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { product_id: string; lines: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const rows = data.lines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((content) => ({ product_id: data.product_id, content }));
    if (!rows.length) return { added: 0 };
    const { error } = await sb.from("stock_items").insert(rows);
    if (error) throw new Error(error.message);
    return { added: rows.length };
  });

/* ------------------------------------------------------------------ orders */

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; source?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    let q = sb.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    if (data?.source && data.source !== "all") q = q.eq("source", data.source);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deliverOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; content: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const { data: order, error } = await sb
      .from("orders")
      .update({ status: "completed", delivered_content: data.content })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (order?.source === "website" || !order?.telegram_id) return { ok: true };
    const { sendMessage } = await import("@/lib/telegram.server");
    const esc = data.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    await sendMessage(
      order.telegram_id,
      `✅ <b>Order #${order.order_no}</b> delivered!\n${order.quantity}× ${order.product_name}\n\n<pre>${esc}</pre>`,
    );
    return { ok: true };
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "pending" | "completed" | "cancelled" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context as any).supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------------------------------------------- payments */

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await (context as any).supabase
      .from("payment_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const decidePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approve: boolean; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const { data: req } = await sb.from("payment_requests").select("*").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("Request not found");

    await sb
      .from("payment_requests")
      .update({ status: data.approve ? "approved" : "rejected", admin_note: data.note ?? null })
      .eq("id", data.id);

    const { sendMessage } = await import("@/lib/telegram.server");
    if (data.approve) {
      const { data: user } = await sb
        .from("bot_users")
        .select("balance")
        .eq("telegram_id", req.telegram_id)
        .maybeSingle();
      await sb
        .from("bot_users")
        .update({ balance: Number(user?.balance ?? 0) + Number(req.amount) })
        .eq("telegram_id", req.telegram_id);
      await sb.from("transactions").insert({
        telegram_id: req.telegram_id,
        type: "deposit",
        amount: req.amount,
        method: req.method,
        reference: req.txid,
      });
      await sendMessage(
        req.telegram_id,
        `✅ Your deposit of $${Number(req.amount).toFixed(2)} has been approved and added to your balance.`,
      );
    } else {
      await sendMessage(
        req.telegram_id,
        `❌ Your deposit request was rejected.${data.note ? `\nReason: ${data.note}` : ""}`,
      );
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------- users */

export const listBotUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    let q = sb.from("bot_users").select("*").order("created_at", { ascending: false }).limit(200);
    if (data?.search) {
      const s = data.search.replace(/[%,]/g, "");
      q = /^\d+$/.test(s) ? q.eq("telegram_id", Number(s)) : q.ilike("username", `%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telegram_id: number; amount: number; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const { data: user } = await sb
      .from("bot_users")
      .select("balance")
      .eq("telegram_id", data.telegram_id)
      .maybeSingle();
    if (!user) throw new Error("User not found");
    await sb
      .from("bot_users")
      .update({ balance: Number(user.balance) + Number(data.amount) })
      .eq("telegram_id", data.telegram_id);
    await sb.from("transactions").insert({
      telegram_id: data.telegram_id,
      type: "admin",
      amount: data.amount,
      note: data.note ?? "Dashboard adjustment",
    });
    const { sendMessage } = await import("@/lib/telegram.server");
    await sendMessage(
      data.telegram_id,
      `💰 Your balance was adjusted by $${Number(data.amount).toFixed(2)}.`,
    );
    return { ok: true };
  });

export const setBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telegram_id: number; banned: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context as any).supabase
      .from("bot_users")
      .update({ is_banned: data.banned })
      .eq("telegram_id", data.telegram_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const messageUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telegram_id: number; text: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { sendMessage } = await import("@/lib/telegram.server");
    const res = await sendMessage(data.telegram_id, data.text);
    return { ok: res.ok };
  });

/* ------------------------------------------------------------ redeem codes */

export const listCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await (context as any).supabase
      .from("redeem_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    return data ?? [];
  });

export const generateCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { count: number; amount: number }) => d)
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const count = Math.min(Math.max(1, Math.floor(data.count)), 200);
    const rows = Array.from({ length: count }, () => ({
      code: "GIFT" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      amount: data.amount,
    }));
    const { error } = await sb.from("redeem_codes").insert(rows);
    if (error) throw new Error(error.message);
    return { codes: rows.map((r) => r.code) };
  });

/* ---------------------------------------------------------------- settings */

export const getBotSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await (context as any).supabase.from("bot_settings").select("key,value");
    const out: Record<string, string> = {};
    for (const row of data ?? []) out[row.key] = row.value ?? "";
    return out;
  });

export const saveBotSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { values: Record<string, string> }) => d)
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    await assertAdmin(context);
    const rows = Object.entries(data.values).map(([key, value]) => ({ key, value }));
    const { error } = await sb.from("bot_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registerWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = process.env["TELEGRAM_API_KEY"] || process.env["TELEGRAM_BOT_TOKEN"];
    if (!key)
      return {
        ok: false,
        message:
          "TELEGRAM_BOT_TOKEN is not configured yet. Add the bot token from @BotFather before connecting the webhook.",
      };
    const { setWebhook, getWebhookInfo, setMyCommands } = await import("@/lib/telegram.server");
    const { createHash } = await import("crypto");
    const deriveTelegramWebhookSecret = (k: string) =>
      createHash("sha256").update(`telegram-webhook:${k}`).digest("base64url");
    // The id-preview host redirects through auth; use the stable public dev host instead.
    const origin = data.origin
      .replace(/\/$/, "")
      .replace(/^https:\/\/id-preview--([0-9a-f-]{36})\.(.+)$/, "https://project--$1-dev.$2")
      // sandbox/preview iframe host -> stable public dev host
      .replace(/^https:\/\/([0-9a-f-]{36})\.lovableproject\.com$/, "https://project--$1-dev.lovable.app")
      .replace(/^https:\/\/([0-9a-f-]{36})\.(?:sandbox\.)?lovable\.app$/, "https://project--$1-dev.lovable.app");
    const url = `${origin}/api/public/telegram/webhook`;
    const res = await setWebhook(url, deriveTelegramWebhookSecret(key));
    // Admin commands (/admin) are registered only in admin private chats.
    const { data: settingRows } = await context.supabase
      .from("bot_settings")
      .select("key,value")
      .in("key", ["admin_telegram_ids", "admin_ids"]);
    const adminChatIds = (settingRows ?? [])
      .map((r: any) => String(r.value ?? ""))
      .join(",")
      .split(/[,\s]+/)
      .filter(Boolean);
    await setMyCommands(adminChatIds);

    const info = await getWebhookInfo();
    return {
      ok: Boolean(res.ok),
      message: res.ok
        ? `Webhook registered: ${url}`
        : res.description?.toLowerCase().includes("unauthorized")
          ? "Telegram rejected the bot token (Unauthorized). Update TELEGRAM_BOT_TOKEN with a fresh token from @BotFather and try again."
          : (res.description ?? "Webhook registration failed. Please try again."),
      info: info.result ?? null,
    };
  });

export const checkBotToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    const connKey = process.env["TELEGRAM_API_KEY"];
    if (!token && !connKey) {
      return {
        status: "missing" as const,
        message:
          "TELEGRAM_BOT_TOKEN is not configured yet. Add the bot token from @BotFather, then reload this page.",
      };
    }
    if (token && !/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token.trim())) {
      return {
        status: "malformed" as const,
        message:
          "The saved TELEGRAM_BOT_TOKEN does not look like a valid token. It should look like 123456789:AA... — copy it again from @BotFather.",
      };
    }
    try {
      const { getMe } = await import("@/lib/telegram.server");
      const me = await getMe();
      if (!me.ok) {
        return {
          status: "invalid" as const,
          message:
            me.description?.includes("Unauthorized") || me.description?.includes("401")
              ? "Telegram rejected this token (Unauthorized). The token is wrong or was revoked — generate a new one with /token in @BotFather and update the secret."
              : `Telegram could not verify the bot: ${me.description ?? "unknown error"}`,
        };
      }
      return {
        status: "ok" as const,
        username: me.result?.username as string | undefined,
        message: `Connected as @${me.result?.username ?? "unknown"}`,
      };
    } catch (e) {
      return {
        status: "error" as const,
        message: e instanceof Error ? e.message : "Could not reach Telegram right now. Try again.",
      };
    }
  });

export const getWebhookStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = process.env["TELEGRAM_API_KEY"] || process.env["TELEGRAM_BOT_TOKEN"];
    const origin = data.origin
      .replace(/\/$/, "")
      .replace(/^https:\/\/id-preview--([0-9a-f-]{36})\.(.+)$/, "https://project--$1-dev.$2")
      .replace(/^https:\/\/([0-9a-f-]{36})\.lovableproject\.com$/, "https://project--$1-dev.lovable.app")
      .replace(/^https:\/\/([0-9a-f-]{36})\.(?:sandbox\.)?lovable\.app$/, "https://project--$1-dev.lovable.app");
    const expectedUrl = `${origin}/api/public/telegram/webhook`;

    if (!key) {
      return {
        configured: false as const,
        expectedUrl,
        info: null,
        matches: false,
        lastUpdate: null as null | { at: string; kind: string; from: string },
        botUsername: null as string | null,
      };
    }

    const { getWebhookInfo, getMe } = await import("@/lib/telegram.server");
    const [info, me] = await Promise.all([getWebhookInfo(), getMe()]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: rows } = await db
      .from("bot_settings")
      .select("key,value")
      .in("key", ["webhook_last_update_at", "webhook_last_update_kind", "webhook_last_update_from"]);
    const map: Record<string, string> = {};
    for (const r of rows ?? []) map[r.key] = r.value ?? "";

    const current = (info.result?.url ?? "") as string;
    return {
      configured: true as const,
      expectedUrl,
      info: info.result ?? null,
      matches: current === expectedUrl,
      lastUpdate: map["webhook_last_update_at"]
        ? {
            at: map["webhook_last_update_at"]!,
            kind: map["webhook_last_update_kind"] ?? "unknown",
            from: map["webhook_last_update_from"] ?? "unknown",
          }
        : null,
      botUsername: (me.result?.username as string | undefined) ?? null,
    };
  });


export const checkBinanceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    try {
      const { checkBinanceKeys } = await import("@/lib/binance.server");
      return await checkBinanceKeys();
    } catch (e) {
      return {
        ok: false as const,
        saved: false as const,
        message: e instanceof Error ? e.message : "Could not reach Binance.",
      };
    }
  });

export const saveBinanceKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { apiKey: string; secretKey: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const apiKey = data.apiKey.trim();
    const secretKey = data.secretKey.trim();
    if (apiKey.length < 10 || secretKey.length < 10) {
      return { ok: false as const, message: "API Key ও Secret Key দুটোই সঠিকভাবে দিন।" };
    }
    const { validateCreds } = await import("@/lib/binance.server");
    const check = await validateCreds({ apiKey, secretKey });
    if (!check.ok) return { ok: false as const, message: check.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("binance_credentials")
      .upsert({ id: 1, api_key: apiKey, api_secret: secretKey }, { onConflict: "id" });
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, message: "Binance API keys saved and verified." };
  });

export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await (context as any).supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const saveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; percent: number; amount_off: number; max_uses: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const code = data.code.trim().toUpperCase();
    if (!code) throw new Error("Coupon code is required");
    const { error } = await (context as any).supabase.from("coupons").upsert(
      {
        code,
        percent: Number(data.percent) || 0,
        amount_off: Number(data.amount_off) || 0,
        max_uses: Number(data.max_uses) || 0,
        is_active: true,
      },
      { onConflict: "code" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; is_active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context as any).supabase
      .from("coupons")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
