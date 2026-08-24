// Server-only Telegram shop bot engine.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  answerCallback,
  deleteMessage,
  editMessage,
  sendMessage,
  COMMAND_LIST,
  type Button,
} from "@/lib/telegram.server";
import {
  UI_ELEMENTS,
  UI_GROUPS,
  uiBtn,
  uiIconHtml,
  uiKeysOf,
  uiTag,
  uiText,
  type UiKey,
} from "@/lib/bot/ui.server";


const db = supabaseAdmin as any;

/* ------------------------------------------------------------------ utils */

export function money(n: number | string | null | undefined) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

export function maskUsername(u?: string | null, first?: string | null) {
  const base = (u || first || "User").replace(/^@/, "");
  return base.slice(0, 1).toUpperCase() + "*****";
}

function membershipFor(totalSpent: number) {
  if (totalSpent >= 500) return "Diamond";
  if (totalSpent >= 200) return "Platinum";
  if (totalSpent >= 50) return "Gold";
  if (totalSpent >= 10) return "Silver";
  return "Bronze";
}

function refCode() {
  return "REF" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

const MENU_ICONS = {
  shop: ["🛒", "SHOP"], cart: ["🧺", "Cart"], orders: ["📦", "Orders"],
  wallet: ["💰", "Wallet"], freebies: ["🎁", "Freebies"], profile: ["👤", "Profile"],
  referral: ["🏪", "Referral Store"], support: ["🆘", "Support"], emails: ["📧", "Emails & Trials"],
  api: ["🔌", "Reseller API"], clear: ["🧹", "Clear Chat"], refresh: ["🔄", "Refresh Stock"],
  back: ["◀️", "Main Menu"],
} as const;

type MenuIconKey = keyof typeof MENU_ICONS;

function iconButton(settings: Record<string, string>, key: MenuIconKey, callback_data: string, label?: string): Button {
  const [fallback, defaultLabel] = MENU_ICONS[key];
  const configured = (settings[`menu_icon_${key}`] ?? "").trim();
  const customId = /^\d{8,}$/.test(configured) ? configured : "";
  return {
    text: `${customId ? "" : configured || fallback} ${label ?? defaultLabel}`.trim(),
    callback_data,
    ...(customId ? { icon_custom_emoji_id: customId } : {}),
  };
}

/** Page header icons — admin can replace each with a Premium custom emoji. */
const PAGE_ICONS = {
  home: ["🏠", "Home page"],
  shop: ["🛍", "Shop page"],
  product: ["📦", "Product page"],
  checkout: ["🧾", "Checkout page"],
  payment: ["💳", "Payment page"],
  wallet: ["💰", "Wallet page"],
  orders: ["📬", "Orders page"],
  cart: ["🧺", "Cart page"],
  profile: ["👤", "Profile page"],
} as const;

type PageIconKey = keyof typeof PAGE_ICONS;

/** HTML for a page header icon (Premium custom emoji when configured). */
export function pageIconHtml(settings: Record<string, string>, key: PageIconKey) {
  const [fallback] = PAGE_ICONS[key];
  const configured = (settings[`page_icon_${key}`] ?? "").trim();
  const customId = /^\d{8,}$/.test(configured) ? configured : "";
  const glyph = escapeHtml(customId ? fallback : configured || fallback);
  return customId ? `<tg-emoji emoji-id="${customId}">${glyph}</tg-emoji>` : glyph;
}



function productIconHtml(product: any) {
  const id = String(product?.telegram_custom_emoji_id ?? "").trim();
  const fallback = escapeHtml(product?.emoji ?? "📦");
  return id ? `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>` : fallback;
}

function productIconButton(product: any, text: string, callback_data: string): Button {
  const id = String(product?.telegram_custom_emoji_id ?? "").trim();
  return {
    text: `${id ? "" : product?.emoji ?? "📦"} ${text}`.trim(),
    callback_data,
    ...(id ? { icon_custom_emoji_id: id } : {}),
  };
}

function customEmojiIdFromMessage(msg: any): string {
  const entity = [...(msg.entities ?? []), ...(msg.caption_entities ?? [])]
    .find((item: any) => item?.type === "custom_emoji" && item?.custom_emoji_id);
  return String(entity?.custom_emoji_id ?? "");
}

export async function getSettings(): Promise<Record<string, string>> {
  const { data } = await db.from("bot_settings").select("key,value");
  const out: Record<string, string> = {};
  for (const row of data ?? []) out[row.key] = row.value ?? "";
  return out;
}

async function setState(telegramId: number, state: Record<string, unknown> | null) {
  await db
    .from("bot_users")
    .update({ state: state ?? {} })
    .eq("telegram_id", telegramId);
}

async function trackMessage(telegramId: number, messageId?: number) {
  if (!messageId) return;
  const { data } = await db
    .from("bot_users")
    .select("state")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  const state = (data?.state ?? {}) as any;
  const msgs: number[] = Array.isArray(state.msgs) ? state.msgs : [];
  msgs.push(messageId);
  state.msgs = msgs.slice(-40);
  await db.from("bot_users").update({ state }).eq("telegram_id", telegramId);
}

async function say(chatId: number, text: string, kb?: Button[][]) {
  const res = await sendMessage(chatId, text, kb);
  await trackMessage(chatId, res?.result?.message_id);
  return res;
}

function adminIds(s: Record<string, string>) {
  return `${s["admin_telegram_ids"] || ""},${s["admin_ids"] || ""}`
    .split(/[,\s]+/)
    .filter(Boolean);
}

function adminUsernames(s: Record<string, string>) {
  return `${s["admin_usernames"] || ""}`
    .split(/[,\s]+/)
    .map((u) => u.replace(/^@/, "").toLowerCase())
    .filter(Boolean);
}

async function isAdmin(telegramId: number, settings?: Record<string, string>) {
  const s = settings ?? (await getSettings());
  if (adminIds(s).includes(String(telegramId))) return true;

  const names = adminUsernames(s);
  if (!names.length) return false;
  const { data } = await db
    .from("bot_users")
    .select("username")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  const uname = (data?.username || "").replace(/^@/, "").toLowerCase();
  return Boolean(uname) && names.includes(uname);
}


async function notifyAdmins(text: string) {
  const s = await getSettings();
  for (const id of adminIds(s)) await sendMessage(id, text);
}

/* ------------------------------------------------------------------- user */

export async function upsertUser(from: any, startPayload?: string) {
  const telegram_id = from.id as number;
  const { data: existing } = await db
    .from("bot_users")
    .select("*")
    .eq("telegram_id", telegram_id)
    .maybeSingle();

  if (existing) {
    await db
      .from("bot_users")
      .update({
        username: from.username ?? existing.username,
        first_name: from.first_name ?? existing.first_name,
        last_name: from.last_name ?? existing.last_name,
      })
      .eq("telegram_id", telegram_id);
    return { ...existing, username: from.username ?? existing.username };
  }

  let referred_by: number | null = null;
  if (startPayload && startPayload.startsWith("ref_")) {
    const code = startPayload.slice(4);
    const { data: ref } = await db
      .from("bot_users")
      .select("telegram_id")
      .eq("ref_code", code)
      .maybeSingle();
    if (ref && ref.telegram_id !== telegram_id) referred_by = ref.telegram_id;
  }

  const { data: created } = await db
    .from("bot_users")
    .insert({
      telegram_id,
      username: from.username ?? null,
      first_name: from.first_name ?? null,
      last_name: from.last_name ?? null,
      ref_code: refCode(),
      referred_by,
    })
    .select("*")
    .maybeSingle();

  if (referred_by) {
    const { data: r } = await db
      .from("bot_users")
      .select("referral_count")
      .eq("telegram_id", referred_by)
      .maybeSingle();
    await db
      .from("bot_users")
      .update({ referral_count: Number(r?.referral_count ?? 0) + 1 })
      .eq("telegram_id", referred_by);
  }
  return created;
}

async function getUser(telegramId: number) {
  const { data } = await db.from("bot_users").select("*").eq("telegram_id", telegramId).maybeSingle();
  return data;
}

/* ------------------------------------------------------------------ views */

function homeKeyboard(settings: Record<string, string>): Button[][] {
  return [
    [
      iconButton(settings, "shop", "shop:0"),
      iconButton(settings, "cart", "cart"),
      iconButton(settings, "orders", "orders"),
    ],


    [
      iconButton(settings, "wallet", "wallet"),
      iconButton(settings, "freebies", "page:freebies_text"),
      iconButton(settings, "profile", "profile"),
    ],
    [iconButton(settings, "referral", "refstore")],
    [
      iconButton(settings, "support", "page:support_text"),
      iconButton(settings, "emails", "page:emails_trials_text"),
    ],
    [
      iconButton(settings, "api", "page:reseller_api_text"),
      iconButton(settings, "clear", "clear"),
    ],
  ];
}

async function homeText(user: any) {
  const s = await getSettings();
  const botName = (s["bot_name"] || "SHOP").toUpperCase().split("").join(" ");
  const link = `https://t.me/${s["bot_username"] || "your_bot"}?start=ref_${user.ref_code}`;
  return (
    `<b>${botName}</b>\n\n` +
    `👋 Welcome back, <b>${user.first_name ?? "friend"}</b>!\n` +
    `<i>${s["welcome_text"] ?? ""}</i>\n` +
    `──────────────\n` +
    `💳 Username: ${user.username ? "@" + user.username : "—"}\n` +
    `🆔 UserID: <code>${user.telegram_id}</code>\n` +
    `🏅 Membership: ${user.membership}\n` +
    `💰 Balance: ${money(user.balance)}\n` +
    `💎 Total Spent: ${money(user.total_spent)}\n` +
    `🎟 Referrals: ${user.referral_count}\n` +
    `💸 Referral Earning: ${money(user.referral_earnings)}\n` +
    `🔗 Referral Link: ${link}\n` +
    `──────────────\n\n` +
    `Choose an option below to get started.`
  );
}

async function productsWithStock() {
  const { data: products } = await db
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const { data: stock } = await db.from("stock_items").select("product_id").eq("is_sold", false);
  const counts: Record<string, number> = {};
  for (const s of stock ?? []) counts[s.product_id] = (counts[s.product_id] ?? 0) + 1;
  return (products ?? []).map((p: any) => ({ ...p, stock: counts[p.id] ?? 0 }));
}

const PAGE = 12;

function isFlash(p: any) {
  return Number(p.old_price ?? 0) > Number(p.price) && (p.delivery_type === "manual" || (p.stock ?? 0) > 0);
}

async function shopView(page: number) {
  const settings = await getSettings();
  const products = await productsWithStock();
  const inStock = products.filter((p: any) => p.delivery_type === "manual" || p.stock > 0).length;
  const flash = products.filter(isFlash);
  const slice = products.slice(page * PAGE, page * PAGE + PAGE);
  const kb: Button[][] = [];
  if (flash.length && page === 0) kb.push([uiBtn(settings, "shop_flash", "flash", `(${flash.length})`)]);
  for (const p of slice) {
    kb.push([
      productIconButton(
        p,
        `${p.name} | ${money(p.price)} | ${p.delivery_type === "manual" ? "manual" : `📦 ${p.stock}`}`,
        `p:${p.id}`,
      ),
    ]);
  }
  const nav: Button[] = [];
  if (page > 0) nav.push(uiBtn(settings, "shop_prev", `shop:${page - 1}`));
  if (products.length > (page + 1) * PAGE) nav.push(uiBtn(settings, "shop_next", `shop:${page + 1}`));
  if (nav.length) kb.push(nav);
  kb.push([iconButton(settings, "refresh", `shop:${page}`)]);
  kb.push([
    iconButton(settings, "cart", "cart"),
    iconButton(settings, "back", "home"),
  ]);


  const text =
    `${pageIconHtml(settings, "shop")} <b>P R O D U C T S</b>\n\n` +
    `${uiIconHtml(settings, "shop_instock")} <b>${inStock} of ${products.length}</b> ${uiText(settings, "shop_instock")}\n` +
    (flash.length
      ? `${uiTag(settings, "shop_flash")} — <b>${flash.length}</b> discounted item(s) live now\n`
      : "") +
    `<i>Tap a product below to view details.</i>`;
  return { text, kb };
}

/** Flash / sale section — every product that currently runs a discount. */
async function flashView() {
  const settings = await getSettings();
  const products = (await productsWithStock()).filter(isFlash);
  const head = `${uiTag(settings, "shop_flash")}\n──────────────\n`;
  if (!products.length) {
    return {
      text: `${head}\nNo active deals right now. Check back soon!`,
      kb: [
        [iconButton(settings, "shop", "shop:0")],
        [iconButton(settings, "back", "home")],
      ] as Button[][],
    };
  }
  const list = products
    .slice(0, 20)
    .map((p: any) => {
      const off = Math.round((1 - Number(p.price) / Number(p.old_price)) * 100);
      return (
        `${uiIconHtml(settings, "flash_tag")} <b>${escapeHtml(p.name)}</b> — <s>${money(p.old_price)}</s> → ` +
        `<b>${money(p.price)}</b> (-${off}%)`
      );
    })
    .join("\n");
  const kb: Button[][] = products
    .slice(0, 20)
    .map((p: any) => [productIconButton(p, `${p.name} · ${money(p.price)}`, `p:${p.id}`)]);
  kb.push([iconButton(settings, "refresh", "flash")]);
  kb.push([iconButton(settings, "shop", "shop:0"), iconButton(settings, "back", "home")]);
  return {
    text:
      `${head}${list}\n──────────────\n` +
      `${uiTag(settings, "flash_timer")}\n<i>Tap a product to grab it before the deal ends:</i>`,
    kb,
  };
}

async function productView(productId: string) {
  const { data: p } = await db.from("products").select("*").eq("id", productId).maybeSingle();
  if (!p) return null;
  const { count } = await db
    .from("stock_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("is_sold", false);
  const stock = count ?? 0;
  const hasDrop = p.old_price && Number(p.old_price) > Number(p.price);
  const off = hasDrop
    ? Math.round((1 - Number(p.price) / Number(p.old_price)) * 100)
    : 0;

  const settings = await getSettings();
  let text = `${pageIconHtml(settings, "product")} <b>P R O D U C T</b>\n──────────────\n`;
  if (hasDrop) text += `${uiTag(settings, "prod_drop")}\n──────────────\n`;
  text += `${productIconHtml(p)} <b>${p.name}</b>\n\n`;
  if (p.description) text += `${p.description}\n\n`;
  if (hasDrop) {
    text += `<s>${money(p.old_price)}</s> ➡️ <b>${money(p.price)}</b>  ${uiTag(settings, "prod_save")} ${off}%\n`;
  } else {
    text += `${uiTag(settings, "prod_price")}: <b>${money(p.price)}</b>\n`;
  }
  text +=
    p.delivery_type === "manual"
      ? `${uiTag(settings, "prod_manual")}\n`
      : `${uiTag(settings, "prod_stock")}: <b>${stock} available</b>\n`;
  if (p.manual_note) text += `\n<i>${p.manual_note}</i>\n`;

  const available = p.delivery_type === "manual" || stock > 0;
  const kb: Button[][] = [];
  if (available)
    kb.push([
      uiBtn(settings, "prod_buy", `qty:${p.id}`),
      uiBtn(settings, "prod_addcart", `cadd:${p.id}:1`),
    ]);
  else kb.push([uiBtn(settings, "prod_out", `p:${p.id}`)]);
  kb.push([
    uiBtn(settings, "prod_refresh", `p:${p.id}`),
    uiBtn(settings, "prod_back", "shop:0"),
  ]);
  kb.push([uiBtn(settings, "prod_cart", "cart"), uiBtn(settings, "prod_home", "home")]);
  return { text, kb };
}

/* ------------------------------------------------------------------- cart */

type CartLine = { product_id: string; qty: number };

function readCart(user: any): CartLine[] {
  const raw = (user?.state ?? {}).cart;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l: any) => l && typeof l.product_id === "string" && Number(l.qty) > 0)
    .map((l: any) => ({ product_id: l.product_id, qty: Math.min(999, Math.floor(Number(l.qty))) }));
}

async function writeCart(telegramId: number, cart: CartLine[]) {
  const { data } = await db
    .from("bot_users")
    .select("state")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  const state = (data?.state ?? {}) as any;
  state.cart = cart;
  await db.from("bot_users").update({ state }).eq("telegram_id", telegramId);
}

async function cartDetails(user: any) {
  const cart = readCart(user);
  if (!cart.length) return { lines: [] as any[], total: 0 };
  const { data: products } = await db
    .from("products")
    .select("*")
    .in(
      "id",
      cart.map((l) => l.product_id),
    );
  const { data: stock } = await db
    .from("stock_items")
    .select("product_id")
    .eq("is_sold", false)
    .in(
      "product_id",
      cart.map((l) => l.product_id),
    );
  const counts: Record<string, number> = {};
  for (const s of stock ?? []) counts[s.product_id] = (counts[s.product_id] ?? 0) + 1;

  const lines = cart
    .map((l) => {
      const p = (products ?? []).find((x: any) => x.id === l.product_id);
      if (!p) return null;
      return {
        product: p,
        qty: l.qty,
        stock: counts[p.id] ?? 0,
        subtotal: Number(p.price) * l.qty,
      };
    })
    .filter(Boolean) as any[];

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
  return { lines, total };
}

async function cartView(user: any) {
  const settings = await getSettings();
  const { lines, total } = await cartDetails(user);
  if (!lines.length) {
    return {
      text: `${pageIconHtml(settings, "cart")} <b>Y O U R   C A R T</b>\n\nYour cart is empty.\n\n<i>Browse the shop and tap “Add to Cart”.</i>`,
      kb: [
        [iconButton(settings, "shop", "shop:0")],
        [uiBtn(settings, "cart_home", "home")],
      ] as Button[][],
    };
  }

  let text = `${pageIconHtml(settings, "cart")} <b>Y O U R   C A R T</b>\n──────────────\n`;
  const kb: Button[][] = [];
  let issues = 0;
  for (const l of lines) {
    const short = l.product.delivery_type === "auto" && l.stock < l.qty;
    if (short) issues++;
    text +=
      `${productIconHtml(l.product)} <b>${l.product.name}</b>\n` +
      `   ${l.qty} × ${money(l.product.price)} = <b>${money(l.subtotal)}</b>` +
      (short ? `  ⚠️ only ${l.stock} in stock` : "") +
      `\n`;
    kb.push([
      { text: "➖", callback_data: `cdec:${l.product.id}` },
      { text: `${l.qty}× ${l.product.name}`.slice(0, 30), callback_data: `p:${l.product.id}` },
      { text: "➕", callback_data: `cinc:${l.product.id}` },
      { text: "🗑", callback_data: `crm:${l.product.id}` },
    ]);
  }
  text +=
    `──────────────\n${uiTag(settings, "cart_total")}: <b>${money(total)}</b>\n` +
    `💰 Balance: ${money(user.balance)}\n`;
  if (issues) text += `\n⚠️ Some items exceed available stock.\n`;

  kb.push([uiBtn(settings, "cart_checkout", "cchk", `· ${money(total)}`)]);
  kb.push([
    uiBtn(settings, "cart_continue", "shop:0"),
    uiBtn(settings, "cart_clear", "cclear"),
  ]);
  kb.push([uiBtn(settings, "cart_wallet", "wallet"), uiBtn(settings, "cart_home", "home")]);
  return { text, kb };
}


/** Binance gateway configuration coming from the admin dashboard. */
export async function binanceConfig() {
  const s = await getSettings();
  const on = (k: string, def = true) => (s[k] === undefined || s[k] === "" ? def : s[k] === "1" || s[k] === "true");
  return {
    active: (s["binance_status"] ?? "active") !== "inactive",
    live: (s["binance_mode"] ?? "live") !== "personal",
    payid: on("binance_enable_payid"),
    crypto: on("binance_enable_crypto"),
    rate: Number(s["dollar_rate"] || 0) || 0,
    payAddress: s["binance_pay"] ?? "",
  };
}

async function walletView(user: any) {
  const cfg = await binanceConfig();
  const s = await getSettings();
  const text =
    `${pageIconHtml(s, "wallet")} <b>W A L L E T</b>\n\n` +
    `Your Balance and Spending Stats are:\n──────────────\n` +
    `💰 Balance: <b>${money(user.balance)}</b>\n` +
    `💎 Total Spent: ${money(user.total_spent)}\n` +
    `🏅 Membership: ${user.membership}\n` +
    `──────────────\n\n` +
    `<i>Choose a payment method below to add funds to your wallet.</i>`;
  const kb: Button[][] = [];
  if (cfg.active && cfg.payid)
    kb.push([uiBtn(s, "wal_binance", "dep:binance", cfg.live ? "(auto)" : "(manual)")]);
  if (cfg.active && cfg.crypto && cfg.live) kb.push([uiBtn(s, "wal_usdt", "dep:usdt")]);
  kb.push([uiBtn(s, "wal_bkash", "dep:bkash"), uiBtn(s, "wal_nagad", "dep:nagad")]);
  kb.push([uiBtn(s, "wal_redeem", "redeem")]);
  kb.push([uiBtn(s, "wal_history", "hist:0")]);
  kb.push([uiBtn(s, "wal_home", "home")]);
  return { text, kb };
}

const DEPOSIT_LABEL: Record<string, { name: string; key: string }> = {
  bkash: { name: "bKash", key: "bkash_number" },
  nagad: { name: "Nagad", key: "nagad_number" },
};

/* ---------------------------------------------------------------- binance */

const NETWORKS: Record<string, string> = {
  BSC: "USDT BEP-20 (BSC)",
  TRX: "USDT TRC-20 (Tron)",
};

async function txUsed(tx: string) {
  const { data } = await db.from("binance_used_txs").select("tx_id").eq("tx_id", tx).maybeSingle();
  return !!data;
}

/** Unique USDT amount so concurrent deposits can be told apart. */
function uniqueAmount(base: number) {
  return Math.round((base + Math.floor(Math.random() * 99 + 1) / 10000) * 10000) / 10000;
}

async function startBinanceDeposit(
  chatId: number,
  kind: "payid" | "crypto",
  amount: number,
  network?: string,
  meta: Record<string, unknown> = {},
) {
  const s = await getSettings();
  const amountUsdt = uniqueAmount(amount);
  const personal = (s["binance_mode"] ?? "live") === "personal";
  let address = "";

  if (kind === "payid") {
    address = (s["binance_pay"] || "").trim();
    if (!address)
      return { error: "Binance Pay is not set up yet. Please contact support or use another payment method." };
  } else {
    const fallbackKey = network === "TRX" ? "usdt_trc20" : "usdt_bep20";
    address = (s[fallbackKey] || "").trim();
    if (!address && !personal) {
      // Only ask Binance when the admin has not pinned a wallet address.
      try {
        const { getDepositAddress } = await import("@/lib/binance.server");
        const r = await getDepositAddress(network!);
        if (r.ok) address = r.address;
      } catch {
        /* Binance can block the server (403) — fall through to the manual address */
      }
    }
    if (!address) {
      const label = network === "TRX" ? "USDT TRC-20" : "USDT BEP-20";
      await notifyAdmins(
        `⚠️ <b>${label} deposit address missing</b>\nA user tried to deposit but no wallet address is configured.\nAdd it in Dashboard → Settings → Binance Setup.`,
      );
      return {
        error: `${label} deposits are temporarily unavailable. Please use another payment method or contact support.`,
      };
    }
  }


  const { data: row, error } = await db
    .from("binance_deposits")
    .insert({
      telegram_id: chatId,
      kind,
      network: kind === "crypto" ? network : null,
      address,
      amount_usdt: amountUsdt,
      meta,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();
  if (error || !row) return { error: "Could not create the deposit. Please try again." };
  return { row };
}


function binanceView(row: any) {
  const head =
    row.kind === "payid"
      ? `🪙 <b>Binance Pay</b>\n\nOpen Binance app → <b>Pay</b> → <b>Send</b> → paste this Pay ID:\n<code>${row.address}</code>`
      : `💵 <b>${NETWORKS[row.network] ?? row.network}</b>\n\nSend USDT to this address on the <b>${row.network}</b> network only:\n<code>${row.address}</code>`;
  const text =
    `${head}\n\n` +
    `Amount to send (tap to copy):\n<code>${Number(row.amount_usdt).toFixed(4)}</code>\n\n` +
    `⚠️ The amount must match <b>exactly</b> — it is how we identify your payment.\n` +
    `⏳ Valid for 2 hours. After paying, send your <b>Transaction ID</b>.`;
  const kb: Button[][] = [
    [{ text: "🧾 Submit transaction ID", callback_data: `btx:${row.id}` }],
    [{ text: "✅ I have paid — auto verify", callback_data: `bchk:${row.id}` }],
    [{ text: "❌ Cancel", callback_data: "wallet" }],
  ];
  return { text, kb };
}

async function verifyBinanceDeposit(chatId: number, id: string) {
  const { data: row } = await db
    .from("binance_deposits")
    .select("*")
    .eq("id", id)
    .eq("telegram_id", chatId)
    .maybeSingle();
  if (!row) return { message: "❌ Deposit not found." };
  if (row.status === "credited") return { message: "✅ This deposit was already credited." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.from("binance_deposits").update({ status: "expired" }).eq("id", id);
    return { message: "⌛ This deposit request expired. Please start a new one." };
  }

  const { findCryptoDeposit, findPayTransaction } = await import("@/lib/binance.server");
  const expected = Number(row.amount_usdt);
  const result =
    row.kind === "payid"
      ? await findPayTransaction(expected, txUsed)
      : await findCryptoDeposit(expected, row.network, txUsed);

  if (!result.ok) {
    return {
      message:
        `⏳ Payment not confirmed yet.\n\n` +
        `Make sure you sent exactly <b>${expected.toFixed(4)} USDT</b>. Payments can take a few minutes.\n\n` +
        `👉 Fastest way: tap <b>Submit transaction ID</b> and send your TXID — we will confirm it manually within minutes.`,
      keyboard: [
        [{ text: "🧾 Submit transaction ID", callback_data: `btx:${id}` }],
        [{ text: "🔄 Verify again", callback_data: `bchk:${id}` }],
        [{ text: "⬅️ Wallet", callback_data: "wallet" }],
      ] as Button[][],
    };
  }


  const { error: usedErr } = await db.from("binance_used_txs").insert({ tx_id: result.txId });
  if (usedErr) return { message: "⏳ Payment not found yet. Please try again." };

  return await settlePayment(chatId, row, Number(result.amount), result.txId!, "Auto-verified via Binance API");
}

/** Credit a wallet deposit, or fulfil a direct checkout attached to the deposit row. */
async function settlePayment(chatId: number, row: any, amount: number, txid: string, note: string) {
  const methodLabel = row.kind === "payid" ? "Binance Pay" : `USDT ${row.network}`;
  const methodKey = row.kind === "payid" ? "binance_pay" : `usdt_${row.network}`;
  const meta = (row.meta ?? {}) as any;

  await db.from("binance_deposits").update({ status: "credited", tx_id: txid }).eq("id", row.id);
  await db.from("payment_requests").insert({
    telegram_id: chatId,
    method: methodLabel,
    amount,
    txid,
    status: "approved",
    admin_note: note,
  });

  if (Array.isArray(meta.items) && meta.items.length) {
    await db.from("transactions").insert({
      telegram_id: chatId,
      type: "deposit",
      amount,
      method: methodKey,
      reference: txid,
      note: "Direct checkout payment",
    });
    const fresh = await getUser(chatId);
    await db.from("bot_users").update({ balance: Number(fresh.balance) + amount }).eq("telegram_id", chatId);
    const res = await fulfillCheckout(chatId, meta, methodKey, txid);
    return { message: res.text, keyboard: res.kb };
  }

  const user = await getUser(chatId);
  await db.from("bot_users").update({ balance: Number(user.balance) + amount }).eq("telegram_id", chatId);
  await db.from("transactions").insert({
    telegram_id: chatId,
    type: "deposit",
    amount,
    method: methodKey,
    reference: txid,
    note,
  });

  return {
    message: `🎉 Payment confirmed!\n\n${money(amount)} has been added to your balance.`,
    keyboard: [
      [{ text: "💰 Wallet", callback_data: "wallet" }],
      [{ text: "🏠 Home", callback_data: "home" }],
    ] as Button[][],
  };
}




/** User-supplied transaction id: auto-match against Binance, else queue for admin. */
async function submitBinanceTxid(chatId: number, depId: string, txid: string, username: string | null) {
  const back: Button[][] = [[{ text: "💰 Wallet", callback_data: "wallet" }], [{ text: "🏠 Home", callback_data: "home" }]];
  if (!txid || txid.length < 6) {
    return { message: "❌ That does not look like a valid transaction ID. Please try again.", keyboard: back };
  }
  const { data: row } = await db
    .from("binance_deposits")
    .select("*")
    .eq("id", depId)
    .eq("telegram_id", chatId)
    .maybeSingle();
  if (!row) return { message: "❌ Deposit request not found. Please start again.", keyboard: back };
  if (row.status === "credited") return { message: "✅ This deposit was already credited.", keyboard: back };
  if (await txUsed(txid)) return { message: "❌ This transaction ID was already used.", keyboard: back };

  const expected = Number(row.amount_usdt);
  const method = row.kind === "payid" ? "Binance Pay" : `USDT ${row.network}`;

  let match: { ok: boolean; amount?: number; error?: string } = { ok: false };
  try {
    const { findByTxId } = await import("@/lib/binance.server");
    match = await findByTxId(txid);
  } catch {
    match = { ok: false };
  }

  if (match.ok && Math.abs(Number(match.amount) - expected) < 0.01) {
    const { error: usedErr } = await db.from("binance_used_txs").insert({ tx_id: txid });
    if (usedErr) return { message: "❌ This transaction ID was already used.", keyboard: back };
    const r = await settlePayment(chatId, row, Number(match.amount), txid, "Auto-approved — transaction ID matched");
    return { message: r.message, keyboard: r.keyboard };
  }

  const meta = (row.meta ?? {}) as any;
  const isOrder = Array.isArray(meta.items) && meta.items.length;

  await db.from("payment_requests").insert({
    telegram_id: chatId,
    method,
    amount: expected,
    txid,
    sender_info: username ? "@" + username : String(chatId),
    status: "pending",
  });
  await db.from("binance_deposits").update({ tx_id: txid }).eq("id", depId);
  await notifyAdmins(
    `💳 <b>${isOrder ? "Order payment" : "Binance deposit"} — manual check</b>\nUser: <code>${chatId}</code>\nMethod: ${method}\nAmount: <b>${expected.toFixed(4)} USDT</b>\nTXID: <code>${escapeHtml(txid)}</code>` +
      (isOrder ? `\nItems: ${escapeHtml(String(meta.summary ?? ""))}` : ""),
  );
  return {
    message: isOrder
      ? `🧾 Transaction ID received.\n\n⏳ <b>Your order is waiting for payment confirmation.</b>\nAn admin is verifying your payment — delivery will be sent here as soon as it is confirmed.\n\n<i>Order:</i> ${escapeHtml(String(meta.summary ?? ""))}\n<i>Amount:</i> <b>${expected.toFixed(4)} USDT</b>`
      : `🧾 Transaction ID received.\n\nWe could not match it automatically yet, so an admin will verify it shortly. ` +
        `You can also tap auto verify again in a few minutes.`,
    keyboard: back,
  };
}


/* --------------------------------------------- automatic payment verifier */

let lastSweep = 0;

/**
 * Scans every open Binance Pay / USDT deposit and settles the ones Binance has
 * already received — no admin action and no user tap needed.
 */
export async function sweepBinanceDeposits(force = false) {
  if (!force && Date.now() - lastSweep < 45_000) return { skipped: true, settled: 0 };
  lastSweep = Date.now();

  const nowIso = new Date().toISOString();
  const { data: rows } = await db
    .from("binance_deposits")
    .select("*")
    .neq("status", "credited")
    .neq("status", "expired")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(25);

  if (!rows?.length) return { skipped: false, settled: 0 };

  const { findCryptoDeposit, findPayTransaction, findByTxId } = await import("@/lib/binance.server");
  let settled = 0;

  for (const row of rows) {
    const expected = Number(row.amount_usdt);
    let txId: string | null = null;
    let amount = expected;

    // 1) If the user already gave us a TXID, confirm that exact transaction.
    if (row.tx_id && !(await txUsed(row.tx_id))) {
      const byId = await findByTxId(String(row.tx_id));
      if (byId.ok && Math.abs(Number(byId.amount) - expected) < 0.01) {
        txId = String(row.tx_id);
        amount = Number(byId.amount);
      }
    }

    // 2) Otherwise match by the unique amount in Binance Pay / deposit history.
    if (!txId) {
      const result =
        row.kind === "payid"
          ? await findPayTransaction(expected, txUsed)
          : await findCryptoDeposit(expected, row.network, txUsed);
      if (result.ok) {
        txId = result.txId;
        amount = Number(result.amount);
      }
    }

    if (!txId) continue;

    const { error: usedErr } = await db.from("binance_used_txs").insert({ tx_id: txId });
    if (usedErr) continue; // another worker took it

    const res = await settlePayment(
      Number(row.telegram_id),
      row,
      amount,
      txId,
      "Auto-verified via Binance API (background check)",
    );
    settled++;
    await db
      .from("payment_requests")
      .update({ status: "approved", admin_note: "Auto-verified via Binance API" })
      .eq("telegram_id", row.telegram_id)
      .eq("txid", txId)
      .eq("status", "pending");
    try {
      await sendMessage(Number(row.telegram_id), res.message, res.keyboard);
    } catch {
      /* user blocked the bot */
    }
  }

  return { skipped: false, settled };
}

export async function announcePurchase(user: any, product: any, qty: number) {
  const s = await getSettings();
  const chat = s["announce_chat_id"];
  if (!chat) return;
  await sendMessage(
    chat,
    `User ${maskUsername(user.username, user.first_name)} just bought ${qty}× ${productIconHtml(product)} <b>${product.name}</b>!`,
  );
}

/* ------------------------------------------------------------- dispatchers */

export async function handleUpdate(update: any) {
  // Every interaction also runs a throttled background payment check, so
  // Binance Pay / USDT deposits get approved automatically.
  void sweepBinanceDeposits().catch(() => {});
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message ?? update.edited_message;
  if (msg) return handleMessage(msg);
}

async function handleMessage(msg: any) {
  if (!msg.from || msg.chat?.type !== "private") return;
  const chatId = msg.chat.id as number;
  const text: string = msg.text ?? "";
  const payload = text.startsWith("/start ") ? text.slice(7).trim() : undefined;
  const user = await upsertUser(msg.from, payload);
  if (!user) return;
  if (user.is_banned) {
    await sendMessage(chatId, "🚫 Your account has been banned.");
    return;
  }
  await trackMessage(chatId, msg.message_id);

  if (text.startsWith("/start")) {
    await setState(chatId, { msgs: (user.state as any)?.msgs ?? [] });
    const fresh = await getUser(chatId);
    await say(chatId, await homeText(fresh), homeKeyboard(await getSettings()));
    return;
  }

  // shortcut commands
  if (
    /^\/(menu|home|shop|wallet|orders|profile|support|cart|checkout|freebies|referral|emails|api|redeem|deposit|help|commands)\b/.test(
      text,
    )
  ) {
    const cmd = text.slice(1).split(/[\s@]/)[0] ?? "";
    const fresh = await getUser(chatId);
    const homeBtn: Button[][] = [[{ text: "🏠 Home", callback_data: "home" }]];
    const pageKeys: Record<string, string> = {
      freebies: "freebies_text",
      emails: "emails_trials_text",
      api: "reseller_api_text",
    };
    if (cmd === "menu" || cmd === "home") {
      await say(chatId, await homeText(fresh), homeKeyboard(await getSettings()));
    } else if (cmd === "help" || cmd === "commands") {
      await say(
        chatId,
        `<b>C O M M A N D S</b>\n\n` +
          COMMAND_LIST.map((c) => `/${c.command} — ${c.description}`).join("\n"),
        homeKeyboard(await getSettings()),
      );
    } else if (pageKeys[cmd]) {
      const s = await getSettings();
      await say(chatId, s[pageKeys[cmd]] || "Coming soon.", homeBtn);
    } else if (cmd === "referral") {
      const s = await getSettings();
      await say(
        chatId,
        `<b>R E F E R R A L   S T O R E</b>\n\n` +
          `Earn <b>${s["referral_percent"] || 0}%</b> of everything your referrals spend.\n\n` +
          `🎟 Referrals: ${fresh.referral_count}\n` +
          `💸 Earnings: ${money(fresh.referral_earnings)}\n\n` +
          `🔗 <code>https://t.me/${s["bot_username"] || "your_bot"}?start=ref_${fresh.ref_code}</code>`,
        homeBtn,
      );
    } else if (cmd === "redeem") {
      await setState(chatId, { ...(fresh.state ?? {}), awaiting: "redeem" });
      await say(chatId, "🎟 Send your redeem code now.", [[{ text: "⬅️ Back", callback_data: "wallet" }]]);
    } else if (cmd === "deposit") {
      const v = await walletView(fresh);
      await say(chatId, v.text, v.kb);
    } else if (cmd === "shop") {

      const v = await shopView(0);
      await say(chatId, v.text, v.kb);
    } else if (cmd === "wallet") {
      const v = await walletView(fresh);
      await say(chatId, v.text, v.kb);
    } else if (cmd === "orders") {
      const v = await ordersView(chatId);
      await say(chatId, v.text, v.kb);
    } else if (cmd === "cart") {
      const v = await cartView(fresh);
      await say(chatId, v.text, v.kb);
    } else if (cmd === "checkout") {
      const v = (await startCheckout(chatId, readCart(fresh))) ?? (await cartView(fresh));
      await say(chatId, v.text, v.kb);
    } else if (cmd === "profile") {
      const { count } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("telegram_id", chatId);
      await say(
        chatId,
        `<b>P R O F I L E</b>\n\n` +
          `💳 Username: ${fresh.username ? "@" + fresh.username : "—"}\n` +
          `🆔 UserID: <code>${fresh.telegram_id}</code>\n` +
          `🏅 Membership: ${fresh.membership}\n` +
          `💰 Balance: ${money(fresh.balance)}\n` +
          `💎 Total Spent: ${money(fresh.total_spent)}\n` +
          `📦 Orders: ${count ?? 0}\n` +
          `🎟 Referrals: ${fresh.referral_count}`,
        [[{ text: "🏠 Home", callback_data: "home" }]],
      );
    } else {
      const s = await getSettings();
      await say(chatId, s["support_text"] || "🆘 Contact support.", [[{ text: "🏠 Home", callback_data: "home" }]]);
    }
    return;
  }


  if (text.startsWith("/admin")) {
    if (!(await isAdmin(chatId))) {
      await say(chatId, "⛔ You are not an admin.");
      return;
    }
    await say(chatId, await adminStatsText(), adminKeyboard());
    return;
  }

  // state machine
  const state = (user.state ?? {}) as any;
  switch (state.awaiting) {
    case "bin_amount": {
      const amount = Number(text.replace(/[^0-9.]/g, ""));
      if (!amount || amount <= 0) {
        await say(chatId, "❌ Please send a valid amount, e.g. <code>10</code>");
        return;
      }
      const kind = state.bin_kind === "crypto" ? "crypto" : "payid";
      state.awaiting = null;
      await setState(chatId, state);
      const r = await startBinanceDeposit(chatId, kind, amount, state.bin_network);
      if ("error" in r && r.error) {
        await say(chatId, `❌ ${escapeHtml(r.error)}`, [[{ text: "⬅️ Wallet", callback_data: "wallet" }]]);
        return;
      }
      const view = binanceView((r as any).row);
      await say(chatId, view.text, view.kb);
      return;
    }
    case "bin_txid": {
      const txid = text.trim();
      state.awaiting = null;
      await setState(chatId, state);
      const r = await submitBinanceTxid(chatId, state.bin_dep_id, txid, msg.from.username ?? null);
      await say(chatId, r.message, r.keyboard);
      return;
    }
    case "deposit_amount": {

      const amount = Number(text.replace(/[^0-9.]/g, ""));
      if (!amount || amount <= 0) {
        await say(chatId, "❌ Please send a valid amount, e.g. <code>10</code>");
        return;
      }
      state.amount = amount;
      state.awaiting = "deposit_txid";
      await setState(chatId, state);
      await say(chatId, "🧾 Now send the <b>TXID / sender number</b> of your payment.");
      return;
    }
    case "deposit_txid": {
      await db.from("payment_requests").insert({
        telegram_id: chatId,
        method: state.method,
        amount: state.amount,
        txid: text.trim(),
        sender_info: msg.from.username ? "@" + msg.from.username : String(chatId),
      });
      state.awaiting = null;
      await setState(chatId, state);
      await say(chatId, "✅ Payment request submitted. An admin will verify it shortly.", [
        [{ text: "🏠 Home", callback_data: "home" }],
      ]);
      await notifyAdmins(
        `💳 <b>New deposit request</b>\nUser: <code>${chatId}</code>\nMethod: ${state.method}\nAmount: ${money(state.amount)}\nTXID: <code>${text.trim()}</code>`,
      );
      return;
    }
    case "redeem": {
      const code = text.trim().toUpperCase();
      const { data: rc } = await db
        .from("redeem_codes")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .is("used_by", null)
        .maybeSingle();
      state.awaiting = null;
      await setState(chatId, state);
      if (!rc) {
        await say(chatId, "❌ Invalid or already used code.", [[{ text: "🏠 Home", callback_data: "home" }]]);
        return;
      }
      await db
        .from("redeem_codes")
        .update({ used_by: chatId, used_at: new Date().toISOString(), is_active: false })
        .eq("id", rc.id);
      const fresh = await getUser(chatId);
      await db
        .from("bot_users")
        .update({ balance: Number(fresh.balance) + Number(rc.amount) })
        .eq("telegram_id", chatId);
      await db.from("transactions").insert({
        telegram_id: chatId,
        type: "deposit",
        amount: rc.amount,
        method: "redeem_code",
        reference: code,
      });
      await say(chatId, `🎉 Code redeemed! ${money(rc.amount)} added to your balance.`, [
        [{ text: "💰 Wallet", callback_data: "wallet" }],
        [{ text: "🏠 Home", callback_data: "home" }],
      ]);
      return;
    }
    case "custom_qty": {
      const qty = parseInt(text.replace(/\D/g, ""), 10);
      state.awaiting = null;
      await setState(chatId, state);
      if (!qty || qty < 1) {
        await say(chatId, "❌ Invalid quantity.");
        return;
      }
      const view = await startCheckout(chatId, [{ product_id: state.product_id, qty }]);
      if (view) await say(chatId, view.text, view.kb);
      return;
    }
    case "coupon": {
      const code = text.trim().toUpperCase();
      state.awaiting = null;
      await setState(chatId, state);
      const meta = await readCo(chatId);
      if (!meta) {
        await say(chatId, "🧺 Nothing to check out.", [[{ text: "🛒 SHOP", callback_data: "shop:0" }]]);
        return;
      }
      const { data: c } = await db
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      const expired = c?.expires_at && new Date(c.expires_at).getTime() < Date.now();
      const exhausted = c && Number(c.max_uses) > 0 && Number(c.used_count) >= Number(c.max_uses);
      if (!c || expired || exhausted) {
        await say(chatId, "❌ Invalid, expired or already used coupon code.", [
          [{ text: "⬅️ Back to checkout", callback_data: "co" }],
        ]);
        return;
      }
      meta.coupon = { code: c.code, percent: Number(c.percent), amount_off: Number(c.amount_off) };
      await writeCo(chatId, meta);
      const view = await coView(chatId);
      await say(chatId, `✅ Coupon <code>${escapeHtml(c.code)}</code> applied!\n\n${view.text}`, view.kb);
      return;
    }

    case "broadcast": {
      state.awaiting = null;
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      const { data: all } = await db.from("bot_users").select("telegram_id").eq("is_banned", false);
      let sent = 0;
      for (const u of all ?? []) {
        const r = await sendMessage(u.telegram_id, text);
        if (r.ok) sent++;
      }
      await say(chatId, `📢 Broadcast sent to ${sent} users.`);
      return;
    }
    case "addbal": {
      state.awaiting = null;
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      const [idPart, amountPart] = text.trim().split(/\s+/);
      const targetId = Number(idPart);
      const amount = Number(amountPart);
      if (!targetId || !amount) {
        await say(chatId, "❌ Format: <code>123456789 10</code>");
        return;
      }
      const target = await getUser(targetId);
      if (!target) {
        await say(chatId, "❌ User not found.");
        return;
      }
      await db
        .from("bot_users")
        .update({ balance: Number(target.balance) + amount })
        .eq("telegram_id", targetId);
      await db.from("transactions").insert({
        telegram_id: targetId,
        type: "admin",
        amount,
        note: "Admin balance adjustment",
      });
      await say(chatId, `✅ Added ${money(amount)} to ${targetId}.`);
      await sendMessage(targetId, `💰 An admin added ${money(amount)} to your balance.`);
      return;
    }
    case "adm_find": {
      state.awaiting = null;
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      const q = text.trim().replace(/^@/, "");
      let targetId = Number(q);
      if (!targetId) {
        const { data: found } = await db
          .from("bot_users")
          .select("telegram_id")
          .ilike("username", q)
          .maybeSingle();
        targetId = Number(found?.telegram_id ?? 0);
      }
      if (!targetId) {
        await say(chatId, "❌ User not found. Send a telegram ID or @username.", ADM_BACK);
        return;
      }
      const v = await admUserView(targetId);
      await say(chatId, v.text, v.kb);
      return;
    }
    case "adm_addbal_user": {
      state.awaiting = null;
      const targetId = Number(state.adm_target);
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      const amount = Number(text.replace(/[^0-9.-]/g, ""));
      const target = await getUser(targetId);
      if (!amount || !target) {
        await say(chatId, "❌ Invalid amount or user.", ADM_BACK);
        return;
      }
      await db
        .from("bot_users")
        .update({ balance: Number(target.balance) + amount })
        .eq("telegram_id", targetId);
      await db
        .from("transactions")
        .insert({ telegram_id: targetId, type: "admin", amount, note: "Admin balance adjustment" });
      await sendMessage(targetId, `💰 An admin updated your balance by ${money(amount)}.`);
      const v = await admUserView(targetId);
      await say(chatId, `✅ Done.\n\n${v.text}`, v.kb);
      return;
    }
    case "adm_msg_user": {
      state.awaiting = null;
      const targetId = Number(state.adm_target);
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      await sendMessage(targetId, `📩 <b>Message from admin</b>\n\n${escapeHtml(text)}`);
      await say(chatId, "✅ Message sent.", ADM_BACK);
      return;
    }
    case "adm_deliver": {
      state.awaiting = null;
      const orderId = String(state.adm_order ?? "");
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      const { data: o } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!o) {
        await say(chatId, "❌ Order not found.", ADM_BACK);
        return;
      }
      await db
        .from("orders")
        .update({ status: "completed", delivered_content: text })
        .eq("id", orderId);
      await sendMessage(
        o.telegram_id,
        `📦 <b>Order #${o.order_no} delivered!</b>\n\n<pre>${escapeHtml(text)}</pre>`,
      );
      await say(chatId, `✅ Order #${o.order_no} delivered.`, ADM_BACK);
      return;
    }
    case "adm_stock": {
      state.awaiting = null;
      const productId = String(state.adm_product ?? "");
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length) {
        await say(chatId, "❌ No stock lines received.", ADM_BACK);
        return;
      }
      await db.from("stock_items").insert(lines.map((content) => ({ product_id: productId, content })));
      await say(chatId, `✅ Added ${lines.length} stock item(s).`, ADM_BACK);
      return;
    }
    case "adm_ui_icon":
    case "adm_ui_text": {
      const mode = state.awaiting;
      state.awaiting = null;
      const uiKey = String(state.adm_ui_key ?? "") as UiKey;
      await setState(chatId, state);
      if (!(await isAdmin(chatId)) || !(uiKey in UI_ELEMENTS)) return;
      const raw = text.trim();
      if (mode === "adm_ui_icon") {
        const customEmojiId = raw === "-" ? "" : customEmojiIdFromMessage(msg);
        const value = raw === "-" ? "" : customEmojiId || raw.slice(0, 16);
        await db.from("bot_settings").upsert({ key: `ui_icon_${uiKey}`, value }, { onConflict: "key" });
      } else {
        const value = raw === "-" ? "" : raw.slice(0, 40);
        await db.from("bot_settings").upsert({ key: `ui_text_${uiKey}`, value }, { onConflict: "key" });
      }
      const v = await admUiItemView(uiKey);
      await say(chatId, `✅ Updated.\n\n${v.text}`, v.kb);
      return;
    }
    case "adm_icon": {
      state.awaiting = null;
      const productId = String(state.adm_product ?? "");
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      const raw = text.trim();
      const customEmojiId = raw === "-" ? "" : customEmojiIdFromMessage(msg);
      const icon = raw === "-" || !raw ? "📦" : raw.slice(0, 16);
      const { data: p } = await db
        .from("products")
        .update({ emoji: icon, telegram_custom_emoji_id: customEmojiId || null })
        .eq("id", productId)
        .select("name")
        .maybeSingle();
      await say(
        chatId,
        p ? `✅ Icon updated: ${customEmojiId ? `<tg-emoji emoji-id="${customEmojiId}">${escapeHtml(icon)}</tg-emoji>` : escapeHtml(icon)} <b>${escapeHtml(p.name)}</b>` : "❌ Product not found.",
        [[{ text: "🎨 More icons", callback_data: "adm:icons" }], ADM_BACK[0]!],
      );
      return;
    }
    case "adm_menu_icon": {
      state.awaiting = null;
      const menuKey = String(state.adm_menu_icon ?? "") as MenuIconKey;
      await setState(chatId, state);
      if (!(await isAdmin(chatId)) || !(menuKey in MENU_ICONS)) return;
      const raw = text.trim();
      const customEmojiId = raw === "-" ? "" : customEmojiIdFromMessage(msg);
      const value = raw === "-" ? "" : customEmojiId || raw.slice(0, 16);
      await db.from("bot_settings").upsert({ key: `menu_icon_${menuKey}`, value }, { onConflict: "key" });
      await say(chatId, `✅ ${MENU_ICONS[menuKey][1]} icon updated.`, [[{ text: "🎨 More menu icons", callback_data: "adm:menuicons" }], ADM_BACK[0]!]);
      return;
    }
    case "adm_page_icon": {
      state.awaiting = null;
      const pageKey = String(state.adm_page_icon ?? "") as PageIconKey;
      await setState(chatId, state);
      if (!(await isAdmin(chatId)) || !(pageKey in PAGE_ICONS)) return;
      const raw = text.trim();
      const customEmojiId = raw === "-" ? "" : customEmojiIdFromMessage(msg);
      const value = raw === "-" ? "" : customEmojiId || raw.slice(0, 16);
      await db.from("bot_settings").upsert({ key: `page_icon_${pageKey}`, value }, { onConflict: "key" });
      await say(chatId, `✅ ${PAGE_ICONS[pageKey][1]} icon updated.`, [
        [{ text: "🖼 More page icons", callback_data: "adm:pageicons" }],
        ADM_BACK[0]!,
      ]);
      return;
    }
    case "np_name": {
      if (!(await isAdmin(chatId))) return;
      const name = text.trim();
      if (!name) {
        await say(chatId, "❌ Send a valid product name.");
        return;
      }
      state.np = { ...(state.np ?? {}), name };
      state.awaiting = "np_price";
      await setState(chatId, state);
      await say(chatId, `🆕 <b>Step 2/6</b>\n\nSend the <b>price</b> in USD, e.g. <code>4.5</code>`, [
        [{ text: "✖️ Cancel", callback_data: "adm:stats" }],
      ]);
      return;
    }
    case "np_price": {
      if (!(await isAdmin(chatId))) return;
      const price = Number(text.replace(/[^0-9.]/g, ""));
      if (!price) {
        await say(chatId, "❌ Send a valid price, e.g. <code>4.5</code>");
        return;
      }
      state.np = { ...(state.np ?? {}), price };
      state.awaiting = "np_icon";
      await setState(chatId, state);
      await say(
        chatId,
        "🆕 <b>Step 3/6</b>\n\nSend the product <b>icon</b> — a normal emoji or a Telegram <b>Premium custom emoji</b>. Send <code>-</code> to use 📦.",
        [[{ text: "✖️ Cancel", callback_data: "adm:stats" }]],
      );
      return;
    }
    case "np_icon": {
      if (!(await isAdmin(chatId))) return;
      const raw = text.trim();
      const customEmojiId = raw === "-" ? "" : customEmojiIdFromMessage(msg);
      state.np = {
        ...(state.np ?? {}),
        icon: raw === "-" || !raw ? "📦" : raw.slice(0, 16),
        custom_emoji_id: customEmojiId || "",
      };
      state.awaiting = "np_desc";
      await setState(chatId, state);
      await say(chatId, "🆕 <b>Step 4/6</b>\n\nSend a short <b>description</b>, or <code>-</code> to skip.", [
        [{ text: "✖️ Cancel", callback_data: "adm:stats" }],
      ]);
      return;
    }
    case "np_desc": {
      if (!(await isAdmin(chatId))) return;
      const raw = text.trim();
      const d = { ...(state.np ?? {}), description: raw === "-" ? "" : raw } as ProdDraft;
      state.np = d;
      state.awaiting = null;
      await setState(chatId, state);
      const v = await admWizardDeliveryView(d);
      await say(chatId, v.text, v.kb);
      return;
    }
    case "adm_newprod": {
      state.awaiting = null;
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      const parts = text.split("|").map((s) => s.trim());
      const [icon, name, priceRaw, kind] = [parts[0] ?? "", parts[1] ?? "", parts[2] ?? "", parts[3] ?? "auto"];
      const customEmojiId = customEmojiIdFromMessage(msg);
      const price = Number(String(priceRaw).replace(/[^0-9.]/g, ""));
      if (!name || !price) {
        await say(chatId, "❌ Format: <code>icon | name | price | auto/manual</code>", ADM_BACK);
        return;
      }
      const { error } = await db.from("products").insert({
        name,
        emoji: icon || "📦",
        telegram_custom_emoji_id: customEmojiId || null,
        price,
        delivery_type: kind === "manual" ? "manual" : "auto",
        is_active: true,
      });
      await say(
        chatId,
        error ? `❌ ${escapeHtml(error.message)}` : `✅ Product created: ${icon || "📦"} <b>${escapeHtml(name)}</b> — ${money(price)}`,
        [[{ text: "📦 Add stock", callback_data: "adm:stock" }], ADM_BACK[0]!],
      );
      return;
    }
    case "adm_code": {

      state.awaiting = null;
      await setState(chatId, state);
      if (!(await isAdmin(chatId))) return;
      const amount = Number(text.replace(/[^0-9.]/g, ""));
      if (!amount) {
        await say(chatId, "❌ Send a valid amount, e.g. <code>10</code>", ADM_BACK);
        return;
      }
      const code = "GC" + Math.random().toString(36).slice(2, 10).toUpperCase();
      await db.from("redeem_codes").insert({ code, amount });
      await say(chatId, `🎁 New code created:\n\n<code>${code}</code>\nValue: ${money(amount)}`, ADM_BACK);
      return;
    }
    default:
      await say(chatId, "Use /start to open the menu.", [[{ text: "🏠 Home", callback_data: "home" }]]);
  }
}

async function adminStatsText() {
  const [users, orders, pay] = await Promise.all([
    db.from("bot_users").select("telegram_id", { count: "exact", head: true }),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const { data: totals } = await db.from("orders").select("total").eq("status", "completed");
  const revenue = (totals ?? []).reduce((a: number, r: any) => a + Number(r.total), 0);
  return (
    `<b>A D M I N</b>\n\n` +
    `👥 Users: ${users.count ?? 0}\n` +
    `💵 Revenue: ${money(revenue)}\n` +
    `⏳ Pending orders: ${orders.count ?? 0}\n` +
    `💳 Pending payments: ${pay.count ?? 0}`
  );
}

export function adminKeyboard(): Button[][] {
  return [
    [
      { text: "🔄 Refresh", callback_data: "adm:stats" },
      { text: "⏳ Pending orders", callback_data: "adm:orders" },
    ],
    [
      { text: "💳 Payments", callback_data: "adm:pays" },
      { text: "👤 Find user", callback_data: "adm:user" },
    ],
    [
      { text: "📦 Add stock", callback_data: "adm:stock" },
      { text: "🎁 New code", callback_data: "adm:code" },
    ],
    [
      { text: "📢 Broadcast", callback_data: "adm:broadcast" },
      { text: "➕ Add balance", callback_data: "adm:addbal" },
    ],
    [
      { text: "🎨 Product icons", callback_data: "adm:icons" },
      { text: "🧩 Menu icons", callback_data: "adm:menuicons" },
    ],
    [
      { text: "🖼 Page icons", callback_data: "adm:pageicons" },
      { text: "🆕 Add product", callback_data: "adm:npw" },
    ],
    [{ text: "🎛 UI icons & tags", callback_data: "adm:ui" }],
    [{ text: "⚡ Quick add (one line)", callback_data: "adm:newprod" }],
    [{ text: "🏠 Home", callback_data: "home" }],

  ];
}

const ADM_BACK: Button[][] = [[{ text: "⬅️ Admin panel", callback_data: "adm:stats" }]];

async function admOrdersView() {
  const { data } = await db
    .from("orders")
    .select("id,order_no,telegram_id,product_name,quantity,total,delivery_type")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  if (!data?.length) return { text: "✅ No pending orders.", kb: ADM_BACK };
  const kb: Button[][] = data.map((o: any) => [
    { text: `#${o.order_no} · ${o.product_name} x${o.quantity}`, callback_data: `adm:o:${o.id}` },
  ]);
  kb.push(ADM_BACK[0]!);
  return { text: `⏳ <b>Pending orders</b> (${data.length})\nTap one to deliver or cancel.`, kb };
}

async function admOrderView(id: string) {
  const { data: o } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!o) return { text: "Order not found.", kb: ADM_BACK };
  const text =
    `🧾 <b>Order #${o.order_no}</b>\n\n` +
    `Product: ${escapeHtml(o.product_name)} x${o.quantity}\n` +
    `Total: ${money(o.total)}\n` +
    `Buyer: <code>${o.telegram_id}</code>\n` +
    `Status: ${o.status} · ${o.delivery_type}`;
  return {
    text,
    kb: [
      [{ text: "🚚 Deliver now", callback_data: `adm:od:${o.id}` }],
      [{ text: "❌ Cancel & refund", callback_data: `adm:oc:${o.id}` }],
      [{ text: "⬅️ Back", callback_data: "adm:orders" }],
    ] as Button[][],
  };
}

async function admPaymentsView() {
  const { data } = await db
    .from("payment_requests")
    .select("id,telegram_id,method,amount")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  if (!data?.length) return { text: "✅ No pending payment requests.", kb: ADM_BACK };
  const kb: Button[][] = data.map((p: any) => [
    { text: `${money(p.amount)} · ${p.method} · ${p.telegram_id}`, callback_data: `adm:pay:${p.id}` },
  ]);
  kb.push(ADM_BACK[0]!);
  return { text: `💳 <b>Pending payments</b> (${data.length})`, kb };
}

async function admPaymentView(id: string) {
  const { data: p } = await db.from("payment_requests").select("*").eq("id", id).maybeSingle();
  if (!p) return { text: "Payment not found.", kb: ADM_BACK };
  return {
    text:
      `💳 <b>Deposit request</b>\n\n` +
      `User: <code>${p.telegram_id}</code>\n` +
      `Method: ${escapeHtml(p.method)}\n` +
      `Amount: ${money(p.amount)}\n` +
      `TXID: <code>${escapeHtml(p.txid ?? "-")}</code>\n` +
      `Status: ${p.status}`,
    kb: [
      [
        { text: "✅ Approve", callback_data: `adm:pa:${p.id}` },
        { text: "❌ Reject", callback_data: `adm:pr:${p.id}` },
      ],
      [{ text: "⬅️ Back", callback_data: "adm:pays" }],
    ] as Button[][],
  };
}

async function admDecidePayment(id: string, approve: boolean) {
  const { data: p } = await db.from("payment_requests").select("*").eq("id", id).maybeSingle();
  if (!p || p.status !== "pending") return "Already handled.";
  await db
    .from("payment_requests")
    .update({ status: approve ? "approved" : "rejected" })
    .eq("id", id);
  if (!approve) {
    await sendMessage(p.telegram_id, "❌ Your deposit request was rejected. Contact support if this is wrong.");
    return "Rejected.";
  }
  const u = await getUser(p.telegram_id);
  await db
    .from("bot_users")
    .update({ balance: Number(u?.balance ?? 0) + Number(p.amount) })
    .eq("telegram_id", p.telegram_id);
  await db.from("transactions").insert({
    telegram_id: p.telegram_id,
    type: "deposit",
    amount: p.amount,
    method: p.method,
    reference: p.txid,
  });
  await sendMessage(p.telegram_id, `✅ Deposit approved! ${money(p.amount)} added to your balance.`);
  return "Approved and balance credited.";
}

async function admUserView(targetId: number) {
  const u = await getUser(targetId);
  if (!u) return { text: "❌ User not found.", kb: ADM_BACK };
  const { count } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("telegram_id", targetId);
  return {
    text:
      `👤 <b>${escapeHtml(u.username ? "@" + u.username : (u.first_name ?? "User"))}</b>\n\n` +
      `ID: <code>${u.telegram_id}</code>\n` +
      `Balance: ${money(u.balance)}\n` +
      `Spent: ${money(u.total_spent)}\n` +
      `Orders: ${count ?? 0}\n` +
      `Membership: ${u.membership}\n` +
      `Banned: ${u.is_banned ? "yes 🚫" : "no"}`,
    kb: [
      [{ text: "➕ Add balance", callback_data: `adm:ub:${targetId}` }],
      [{ text: "✉️ Message user", callback_data: `adm:um:${targetId}` }],
      [{ text: u.is_banned ? "✅ Unban" : "🚫 Ban", callback_data: `adm:ux:${targetId}` }],
      [{ text: "⬅️ Admin panel", callback_data: "adm:stats" }],
    ] as Button[][],
  };
}

async function admStockPickView() {
  const { data } = await db
    .from("products")
    .select("id,name,emoji,telegram_custom_emoji_id")
    .eq("is_active", true)
    .order("sort_order")
    .limit(20);
  if (!data?.length) return { text: "No products yet.", kb: ADM_BACK };
  const kb: Button[][] = data.map((p: any) => [productIconButton(p, p.name, `adm:sp:${p.id}`)]);
  kb.push(ADM_BACK[0]!);
  return { text: "📦 Pick the product to add stock to:", kb };
}

async function admIconPickView() {
  const { data } = await db
    .from("products")
    .select("id,name,emoji,telegram_custom_emoji_id")
    .order("sort_order")
    .limit(30);
  if (!data?.length) return { text: "No products yet.", kb: ADM_BACK };
  const kb: Button[][] = data.map((p: any) => [productIconButton(p, p.name, `adm:ip:${p.id}`)]);
  kb.push(ADM_BACK[0]!);
  return {
    text:
      "🎨 <b>Product icons</b>\n\nPick a product, then send the icon you want.\n" +
      "You can send a normal emoji or a <b>Telegram Premium custom emoji</b> — it will be used as the product icon.",
    kb,
  };
}

async function admMenuIconView() {
  const settings = await getSettings();
  const kb = (Object.keys(MENU_ICONS) as MenuIconKey[]).map((key) => [
    iconButton(settings, key, `adm:mi:${key}`, MENU_ICONS[key][1]),
  ]);
  kb.push(ADM_BACK[0]!);
  return {
    text: "🧩 <b>Menu icons</b>\n\nPick a shortcut, then send a normal emoji or Telegram Premium custom emoji. Send <code>-</code> to restore its default icon.",
    kb,
  };
}

async function admPageIconView() {
  const settings = await getSettings();
  const kb: Button[][] = (Object.keys(PAGE_ICONS) as PageIconKey[]).map((key) => {
    const configured = (settings[`page_icon_${key}`] ?? "").trim();
    const customId = /^\d{8,}$/.test(configured) ? configured : "";
    return [
      {
        text: `${customId ? "" : configured || PAGE_ICONS[key][0]} ${PAGE_ICONS[key][1]}`.trim(),
        callback_data: `adm:pi:${key}`,
        ...(customId ? { icon_custom_emoji_id: customId } : {}),
      },
    ];
  });
  kb.push(ADM_BACK[0]!);
  return {
    text:
      "🖼 <b>Page icons</b>\n\nEvery bot page (shop, product, checkout, payment, wallet, orders…) has a header icon.\n" +
      "Pick a page, then send a normal emoji or a <b>Telegram Premium custom emoji</b>. Send <code>-</code> to reset.",
    kb,
  };
}

/* ------------------------------- every button + tag of every page (UI kit) */

const UI_GROUP_LABEL: Record<string, string> = {
  shop: "🛍 Shop page",
  product: "📦 Product page",
  cart: "🧺 Cart page",
  checkout: "🧾 Checkout page",
  payment: "💳 Payment page",
  wallet: "💰 Wallet page",
  orders: "📬 Orders page",
};

async function admUiGroupView() {
  const kb: Button[][] = UI_GROUPS.map((g) => [
    { text: `${UI_GROUP_LABEL[g] ?? g} (${uiKeysOf(g).length})`, callback_data: `adm:uig:${g}` },
  ]);
  kb.push(ADM_BACK[0]!);
  return {
    text:
      "🎛 <b>UI icons &amp; tags</b>\n\nEvery button and tag of every page can be customized.\n" +
      "Pick a page → pick an element → set a <b>Premium custom emoji</b> / normal emoji, or rename its text.",
    kb,
  };
}

async function admUiListView(group: string) {
  const settings = await getSettings();
  const keys = uiKeysOf(group);
  if (!keys.length) return await admUiGroupView();
  const kb: Button[][] = keys.map((k) => [uiBtn(settings, k, `adm:uie:${k}`)]);
  kb.push([{ text: "⬅️ Pages", callback_data: "adm:ui" }]);
  kb.push(ADM_BACK[0]!);
  return { text: `${UI_GROUP_LABEL[group] ?? group}\n\nTap the element you want to customize:`, kb };
}

async function admUiItemView(key: UiKey) {
  const settings = await getSettings();
  const entry = UI_ELEMENTS[key];
  const text =
    `🎛 <b>${escapeHtml(entry.label)}</b>\n──────────────\n` +
    `Preview: ${uiTag(settings, key)}\n` +
    `Current text: <b>${escapeHtml(uiText(settings, key))}</b>\n` +
    `Default: ${escapeHtml(entry.icon)} ${escapeHtml(entry.label)}\n\n` +
    `Choose what to change:`;
  return {
    text,
    kb: [
      [{ text: "🎨 Set icon", callback_data: `adm:uii:${key}` }],
      [{ text: "✏️ Set text (tag)", callback_data: `adm:uit:${key}` }],
      [{ text: "♻️ Reset to default", callback_data: `adm:uir:${key}` }],
      [{ text: "⬅️ Back", callback_data: `adm:uig:${entry.group}` }],
    ] as Button[][],
  };
}


/* ------------------------------------------- step-by-step product wizard */

type ProdDraft = {
  name?: string;
  price?: number;
  icon?: string;
  custom_emoji_id?: string;
  description?: string;
  delivery_type?: "auto" | "manual";
  category_id?: string | null;
};

function draftSummary(d: ProdDraft) {
  const icon = d.custom_emoji_id
    ? `<tg-emoji emoji-id="${d.custom_emoji_id}">${escapeHtml(d.icon || "📦")}</tg-emoji>`
    : escapeHtml(d.icon || "📦");
  return (
    `${icon} <b>${escapeHtml(d.name ?? "-")}</b>\n` +
    `💎 Price: ${money(d.price ?? 0)}\n` +
    `📦 Delivery: ${d.delivery_type ?? "—"}\n` +
    (d.description ? `📝 ${escapeHtml(d.description)}\n` : "")
  );
}

async function admWizardDeliveryView(d: ProdDraft) {
  return {
    text: `🆕 <b>New product · step 5/6</b>\n\n${draftSummary(d)}\nChoose the delivery type:`,
    kb: [
      [{ text: "⚡ Auto (from stock)", callback_data: "adm:npd:auto" }],
      [{ text: "🙋 Manual (admin delivers)", callback_data: "adm:npd:manual" }],
      [{ text: "✖️ Cancel", callback_data: "adm:stats" }],
    ] as Button[][],
  };
}

async function admWizardCategoryView(d: ProdDraft) {
  const { data } = await db
    .from("categories")
    .select("id,name,emoji")
    .order("sort_order")
    .limit(20);
  const kb: Button[][] = (data ?? []).map((c: any) => [
    { text: `${c.emoji ?? "📁"} ${c.name}`, callback_data: `adm:npc:${c.id}` },
  ]);
  kb.push([{ text: "— No category —", callback_data: "adm:npc:none" }]);
  kb.push([{ text: "✖️ Cancel", callback_data: "adm:stats" }]);
  return { text: `🆕 <b>New product · step 6/6</b>\n\n${draftSummary(d)}\nPick a category:`, kb };
}

async function admCreateProduct(chatId: number, d: ProdDraft) {
  const { data: created, error } = await db
    .from("products")
    .insert({
      name: d.name,
      emoji: d.icon || "📦",
      telegram_custom_emoji_id: d.custom_emoji_id || null,
      description: d.description || null,
      price: d.price ?? 0,
      delivery_type: d.delivery_type === "manual" ? "manual" : "auto",
      category_id: d.category_id ?? null,
      is_active: true,
    })
    .select("id,name")
    .maybeSingle();

  if (error || !created) {
    await say(chatId, `❌ Could not create the product: ${escapeHtml(error?.message ?? "unknown error")}`, ADM_BACK);
    return;
  }

  const kb: Button[][] = [];
  if (d.delivery_type !== "manual") kb.push([{ text: "📦 Add stock now", callback_data: `adm:sp:${created.id}` }]);
  kb.push([{ text: "🆕 Add another product", callback_data: "adm:npw" }]);
  kb.push([{ text: "🎨 Set product icon", callback_data: `adm:ip:${created.id}` }]);
  kb.push(ADM_BACK[0]!);
  await say(chatId, `✅ <b>Product created!</b>\n\n${draftSummary(d)}`, kb);
}







/* --------------------------------------------- direct checkout (pay per order) */

type Coupon = { code: string; percent: number; amount_off: number };
type CoMeta = { items: CartLine[]; coupon?: Coupon | null; summary?: string; total?: number };

async function coTotals(meta: CoMeta) {
  const ids = meta.items.map((i) => i.product_id);
  const { data: products } = await db.from("products").select("*").in("id", ids);
  const lines = meta.items
    .map((i) => {
      const p = (products ?? []).find((x: any) => x.id === i.product_id);
      return p ? { product: p, qty: i.qty, subtotal: Number(p.price) * i.qty } : null;
    })
    .filter(Boolean) as any[];
  const subtotal = Math.round(lines.reduce((s, l) => s + l.subtotal, 0) * 100) / 100;
  const c = meta.coupon;
  let discount = c ? (subtotal * Number(c.percent || 0)) / 100 + Number(c.amount_off || 0) : 0;
  discount = Math.max(0, Math.min(subtotal, Math.round(discount * 100) / 100));
  const total = Math.round((subtotal - discount) * 100) / 100;
  return { lines, subtotal, discount, total };
}

async function readCo(chatId: number): Promise<CoMeta | null> {
  const u = await getUser(chatId);
  const co = (u?.state ?? {}).co;
  return co && Array.isArray(co.items) && co.items.length ? (co as CoMeta) : null;
}

async function writeCo(chatId: number, meta: CoMeta | null) {
  const { data } = await db.from("bot_users").select("state").eq("telegram_id", chatId).maybeSingle();
  const state = (data?.state ?? {}) as any;
  if (meta) state.co = meta;
  else delete state.co;
  await db.from("bot_users").update({ state }).eq("telegram_id", chatId);
}

async function coView(chatId: number) {
  const meta = await readCo(chatId);
  if (!meta) {
    return {
      text: "🧺 Nothing to check out.",
      kb: [[{ text: "🛒 SHOP", callback_data: "shop:0" }], [{ text: "🏠 Home", callback_data: "home" }]] as Button[][],
    };
  }
  const { lines, subtotal, discount, total } = await coTotals(meta);
  const settings = await getSettings();
  let text = `${pageIconHtml(settings, "checkout")} <b>C H E C K O U T</b>\n──────────────\n`;
  for (const l of lines) {
    text += `${productIconHtml(l.product)} <b>${l.product.name}</b>\n   ${l.qty} × ${money(l.product.price)} = <b>${money(l.subtotal)}</b>\n`;
  }
  text += `──────────────\n${uiTag(settings, "co_subtotal")}: ${money(subtotal)}\n`;
  if (meta.coupon) text += `🏷 Coupon <code>${escapeHtml(meta.coupon.code)}</code>: −${money(discount)}\n`;
  text += `${uiTag(settings, "co_total")}: <b>${money(total)}</b>\n\n<i>No wallet deposit needed — pay directly and submit your transaction ID.</i>`;

  const kb: Button[][] = [];
  kb.push([
    meta.coupon
      ? uiBtn(settings, "co_coupon_rm", "cocrm")
      : uiBtn(settings, "co_coupon", "cocpn"),
  ]);
  kb.push([uiBtn(settings, "co_pay", "copay", `· ${money(total)}`)]);
  kb.push([iconButton(settings, "shop", "shop:0"), iconButton(settings, "back", "home")]);
  return { text, kb };
}

async function coPayView(chatId: number) {
  const meta = await readCo(chatId);
  if (!meta) return await coView(chatId);
  const { total } = await coTotals(meta);
  const cfg = await binanceConfig();
  const settings = await getSettings();
  const user = await getUser(chatId);
  const kb: Button[][] = [];
  if (Number(user.balance) >= total && total > 0)
    kb.push([uiBtn(settings, "pay_balance", "copm:balance", `(${money(user.balance)})`)]);
  if (cfg.active && cfg.payid) kb.push([uiBtn(settings, "pay_payid", "copm:payid")]);
  if (cfg.active && cfg.crypto) {
    kb.push([uiBtn(settings, "pay_bep20", "copm:BSC")]);
    kb.push([uiBtn(settings, "pay_trc20", "copm:TRX")]);
  }
  kb.push([uiBtn(settings, "pay_back", "co")]);
  return {
    text: `${pageIconHtml(settings, "payment")} <b>P A Y M E N T</b>\n\nAmount to pay: <b>${money(total)}</b>\n\nChoose how you want to pay:`,

    kb,
  };
}

/** Create the paid orders, deliver instantly or notify the admin for manual delivery. */
async function fulfillCheckout(chatId: number, meta: CoMeta, methodKey: string, reference: string) {
  const { lines, discount, total } = await coTotals(meta);
  let user = await getUser(chatId);

  // charge the order total from balance (payments are credited before fulfilment)
  await db
    .from("bot_users")
    .update({
      balance: Math.round((Number(user.balance) - total) * 100) / 100,
      total_spent: Number(user.total_spent) + total,
      membership: membershipFor(Number(user.total_spent) + total),
    })
    .eq("telegram_id", chatId);
  await db.from("transactions").insert({
    telegram_id: chatId,
    type: "purchase",
    amount: -total,
    method: methodKey,
    reference,
    note: meta.summary ?? lines.map((l) => `${l.qty}x ${l.product.name}`).join(", "),
  });

  const share = lines.length ? discount / lines.length : 0;
  let text = `<b>O R D E R   C O N F I R M E D</b>\n──────────────\n💳 Paid: <b>${money(total)}</b>\n`;
  let deliveries = "";
  let pending = 0;

  for (const l of lines) {
    const p = l.product;
    let delivered: string | null = null;
    let status = "pending";
    if (p.delivery_type === "auto") {
      const { data: items } = await db
        .from("stock_items")
        .select("*")
        .eq("product_id", p.id)
        .eq("is_sold", false)
        .order("created_at", { ascending: true })
        .limit(l.qty);
      if (items && items.length >= l.qty) {
        await db
          .from("stock_items")
          .update({ is_sold: true, sold_to: chatId, sold_at: new Date().toISOString() })
          .in("id", items.map((i: any) => i.id));
        delivered = items.map((i: any) => i.content).join("\n");
        status = "completed";
      }
    }

    const { data: order } = await db
      .from("orders")
      .insert({
        telegram_id: chatId,
        product_id: p.id,
        product_name: p.name,
        quantity: l.qty,
        unit_price: p.price,
        total: Math.max(0, Math.round((l.subtotal - share) * 100) / 100),
        status,
        delivery_type: p.delivery_type,
        delivered_content: delivered,
        coupon_code: meta.coupon?.code ?? null,
        discount: Math.round(share * 100) / 100,
      })
      .select("*")
      .maybeSingle();

    text += `• #${order?.order_no} — ${l.qty}× ${p.name}${status === "completed" ? " ✅" : " ⏳ manual"}\n`;
    if (delivered) deliveries += `\n<b>${p.name}</b>\n<pre>${escapeHtml(delivered)}</pre>`;
    if (status !== "completed") {
      pending++;
      await notifyAdmins(
        `🕐 <b>Manual delivery needed — order #${order?.order_no}</b>\nUser: <code>${chatId}</code>\n${l.qty}× ${p.name}\nPaid via: ${methodKey}\nRef: <code>${escapeHtml(reference)}</code>`,
      );
    }
    await announcePurchase(user, p, l.qty);
  }

  // referral commission on the paid total
  user = await getUser(chatId);
  if (user?.referred_by) {
    const s = await getSettings();
    const pct = Number(s["referral_percent"] || 0);
    const commission = Number(((total * pct) / 100).toFixed(2));
    if (commission > 0) {
      const { data: ref } = await db
        .from("bot_users")
        .select("balance,referral_earnings")
        .eq("telegram_id", user.referred_by)
        .maybeSingle();
      if (ref) {
        await db
          .from("bot_users")
          .update({
            balance: Number(ref.balance) + commission,
            referral_earnings: Number(ref.referral_earnings) + commission,
          })
          .eq("telegram_id", user.referred_by);
        await db.from("transactions").insert({
          telegram_id: user.referred_by,
          type: "referral",
          amount: commission,
          note: `Referral commission from ${maskUsername(user.username, user.first_name)}`,
        });
      }
    }
  }

  if (meta.coupon) {
    const { data: c } = await db.from("coupons").select("id,used_count").eq("code", meta.coupon.code).maybeSingle();
    if (c) await db.from("coupons").update({ used_count: Number(c.used_count) + 1 }).eq("id", c.id);
  }

  await writeCo(chatId, null);
  await writeCart(chatId, []);

  if (deliveries) text += `\n🎁 <b>Your items</b>${deliveries}\n`;
  if (pending)
    text +=
      `\n⏳ <b>${pending} item(s) need manual delivery.</b>\n` +
      `Our admin has been notified and will deliver here shortly. Please wait — you can check progress with /orders.\n`;

  const settingsK = await getSettings();
  const kb: Button[][] = [
    [uiBtn(settingsK, "ord_my", "orders")],
    [uiBtn(settingsK, "ord_shop", "shop:0"), uiBtn(settingsK, "ord_home", "home")],
  ];
  return { text, kb };
}

/** Start a checkout for a single product or the whole cart. */
async function startCheckout(chatId: number, items: CartLine[]) {
  if (!items.length) return null;
  const meta: CoMeta = { items, coupon: null };
  const { lines, total } = await coTotals(meta);
  if (!lines.length) return null;
  meta.summary = lines.map((l) => `${l.qty}x ${l.product.name}`).join(", ");
  meta.total = total;
  await writeCo(chatId, meta);
  return await coView(chatId);
}

async function ordersView(chatId: number) {
  const settings = await getSettings();
  const { data: rows } = await db
    .from("orders")
    .select("*")
    .eq("telegram_id", chatId)
    .order("created_at", { ascending: false })
    .limit(10);
  const text = !rows?.length
    ? `${pageIconHtml(settings, "orders")} <b>M Y   O R D E R S</b>\n\nYou have no orders yet.`
    : `${pageIconHtml(settings, "orders")} <b>M Y   O R D E R S</b>\n──────────────\n` +
      rows
        .map(
          (o: any) =>
            `${o.status === "completed" ? "✅" : o.status === "cancelled" ? "❌" : "⏳"} #${o.order_no} — ${o.quantity}× ${o.product_name} · ${money(o.total)}` +
            (o.status === "pending" ? `\n   <i>waiting for manual delivery</i>` : ""),
        )
        .join("\n");
  return {
    text,
    kb: [
      [uiBtn(settings, "ord_refresh", "orders")],
      [uiBtn(settings, "ord_shop", "shop:0"), uiBtn(settings, "ord_home", "home")],
    ] as Button[][],
  };
}


function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handleCallback(cq: any) {
  const chatId = cq.message?.chat?.id as number;
  const messageId = cq.message?.message_id as number;
  const data: string = cq.data ?? "";
  await answerCallback(cq.id);
  if (!chatId) return;
  const user = await upsertUser(cq.from);
  if (!user || user.is_banned) return;

  const edit = async (text: string, kb?: Button[][]) => {
    await editMessage(chatId, messageId, text, kb);
  };

  if (data === "home") {
    const fresh = await getUser(chatId);
    await edit(await homeText(fresh), homeKeyboard(await getSettings()));
    return;
  }

  if (data.startsWith("shop:")) {
    const page = Number(data.split(":")[1] || 0);
    const view = await shopView(page);
    await edit(view.text, view.kb);
    return;
  }

  if (data.startsWith("p:")) {
    const view = await productView(data.slice(2));
    if (!view) return;
    await edit(view.text, view.kb);
    return;
  }

  if (data.startsWith("qty:")) {
    const productId = data.split(":")[1]!;
    const kb: Button[][] = [
      [1, 2, 3].map((n) => ({ text: `${n}×`, callback_data: `buy:${productId}:${n}` })),
      [5, 10].map((n) => ({ text: `${n}×`, callback_data: `buy:${productId}:${n}` })),
      [{ text: "✏️ Custom quantity", callback_data: `cq:${productId}` }],
      [
        { text: "➕ Add 1 to cart", callback_data: `cadd:${productId}:1` },
        { text: "➕ Add 5", callback_data: `cadd:${productId}:5` },
      ],
      [{ text: "⬅️ Back", callback_data: `p:${productId}` }],
    ];
    await edit("🔢 <b>Select quantity</b>", kb);
    return;
  }

  if (data === "cart") {
    const fresh = await getUser(chatId);
    const view = await cartView(fresh);
    await edit(view.text, view.kb);
    return;
  }

  if (
    data.startsWith("cadd:") ||
    data.startsWith("cinc:") ||
    data.startsWith("cdec:") ||
    data.startsWith("crm:")
  ) {
    const [op, productId, n] = data.split(":");
    const fresh = await getUser(chatId);
    const cart = readCart(fresh);
    const idx = cart.findIndex((l) => l.product_id === productId);
    if (op === "crm") {
      if (idx >= 0) cart.splice(idx, 1);
    } else if (op === "cdec") {
      if (idx >= 0) {
        cart[idx]!.qty -= 1;
        if (cart[idx]!.qty < 1) cart.splice(idx, 1);
      }
    } else {
      const add = op === "cadd" ? Math.max(1, Number(n) || 1) : 1;
      if (idx >= 0) cart[idx]!.qty = Math.min(999, cart[idx]!.qty + add);
      else cart.push({ product_id: productId!, qty: add });
    }
    await writeCart(chatId, cart);
    const updated = await getUser(chatId);
    const view = await cartView(updated);
    await edit(view.text, view.kb);
    return;
  }

  if (data === "cclear") {
    await writeCart(chatId, []);
    const updated = await getUser(chatId);
    const view = await cartView(updated);
    await edit(view.text, view.kb);
    return;
  }

  if (data === "cchk" || data === "cgo") {
    const fresh = await getUser(chatId);
    const cart = readCart(fresh);
    const view = (await startCheckout(chatId, cart)) ?? (await cartView(fresh));
    await edit(view.text, view.kb);
    return;
  }

  if (data === "co") {
    const view = await coView(chatId);
    await edit(view.text, view.kb);
    return;
  }

  if (data === "cocpn") {
    await setState(chatId, { ...(user.state ?? {}), awaiting: "coupon" });
    await edit("🏷 Send your <b>coupon code</b> now.", [[{ text: "⬅️ Back", callback_data: "co" }]]);
    return;
  }

  if (data === "cocrm") {
    const meta = await readCo(chatId);
    if (meta) {
      meta.coupon = null;
      await writeCo(chatId, meta);
    }
    const view = await coView(chatId);
    await edit(view.text, view.kb);
    return;
  }

  if (data === "copay") {
    const view = await coPayView(chatId);
    await edit(view.text, view.kb);
    return;
  }

  if (data.startsWith("copm:")) {
    const method = data.slice(5);
    const meta = await readCo(chatId);
    if (!meta) {
      const view = await coView(chatId);
      await edit(view.text, view.kb);
      return;
    }
    const { total } = await coTotals(meta);

    if (method === "balance") {
      const fresh = await getUser(chatId);
      if (Number(fresh.balance) < total) {
        await edit(`❌ Not enough balance (${money(fresh.balance)}). Choose another payment method.`, [
          [{ text: "⬅️ Back", callback_data: "copay" }],
        ]);
        return;
      }
      const res = await fulfillCheckout(chatId, meta, "balance", "wallet");
      await edit(res.text, res.kb);
      return;
    }

    const kind = method === "payid" ? "payid" : "crypto";
    const network = method === "payid" ? undefined : method;
    const r = await startBinanceDeposit(chatId, kind as any, total, network, {
      items: meta.items,
      coupon: meta.coupon ?? null,
      summary: meta.summary ?? "",
      total,
    });
    if ("error" in r && r.error) {
      await edit(`❌ ${escapeHtml(r.error)}`, [[{ text: "⬅️ Back", callback_data: "copay" }]]);
      return;
    }
    const view = binanceView((r as any).row);
    await edit(
      `🧾 <b>Order:</b> ${escapeHtml(meta.summary ?? "")}\n\n${view.text}`,
      view.kb,
    );
    return;
  }

  if (data === "orders") {
    const view = await ordersView(chatId);
    await edit(view.text, view.kb);
    return;
  }

  if (data.startsWith("cq:")) {
    await setState(chatId, { ...(user.state ?? {}), awaiting: "custom_qty", product_id: data.slice(3) });
    await say(chatId, "✏️ Send the quantity you want to buy.");
    return;
  }

  if (data.startsWith("buy:")) {
    const [, productId, n] = data.split(":");
    const view = await startCheckout(chatId, [{ product_id: productId!, qty: Math.max(1, Number(n) || 1) }]);
    if (view) await edit(view.text, view.kb);
    return;
  }


  if (data === "wallet") {
    const fresh = await getUser(chatId);
    const view = await walletView(fresh);
    await edit(view.text, view.kb);
    return;
  }

  if (data === "dep:binance") {
    const cfg = await binanceConfig();
    if (!cfg.active || !cfg.payid) {
      await edit("⚠️ Binance deposits are currently disabled. Please use another method.", [
        [{ text: "⬅️ Wallet", callback_data: "wallet" }],
      ]);
      return;
    }
    if (!cfg.live) {
      await setState(chatId, { ...(user.state ?? {}), awaiting: "deposit_amount", method: "Binance Pay" });
      await edit(
        `🪙 <b>Binance Pay (manual)</b>\n\nSend your payment to Pay ID:\n<code>${cfg.payAddress || "Not configured — contact support."}</code>\n\nThen reply with the <b>amount</b> you sent.`,
        [[{ text: "⬅️ Back", callback_data: "wallet" }]],
      );
      return;
    }
    await setState(chatId, { ...(user.state ?? {}), awaiting: "bin_amount", bin_kind: "payid" });
    await edit(
      "🪙 <b>Binance Pay deposit</b>\n\nHow much <b>USDT</b> do you want to add?\nReply with the amount, e.g. <code>10</code>.",
      [[{ text: "⬅️ Back", callback_data: "wallet" }]],
    );
    return;
  }

  if (data === "dep:usdt") {
    const cfg = await binanceConfig();
    if (!cfg.active || !cfg.crypto || !cfg.live) {
      await edit("⚠️ Crypto deposits are currently disabled. Please use another method.", [
        [{ text: "⬅️ Wallet", callback_data: "wallet" }],
      ]);
      return;
    }
    await edit("💵 <b>USDT deposit</b>\n\nChoose the network you will send from:", [
      [{ text: "BEP-20 (BSC)", callback_data: "bnet:BSC" }],
      [{ text: "TRC-20 (Tron)", callback_data: "bnet:TRX" }],
      [{ text: "⬅️ Back", callback_data: "wallet" }],
    ]);
    return;
  }

  if (data.startsWith("bnet:")) {
    const network = data.slice(5);
    if (!NETWORKS[network]) return;
    await setState(chatId, { ...(user.state ?? {}), awaiting: "bin_amount", bin_kind: "crypto", bin_network: network });
    await edit(
      `💵 <b>${NETWORKS[network]}</b>\n\nHow much <b>USDT</b> do you want to add?\nReply with the amount, e.g. <code>10</code>.`,
      [[{ text: "⬅️ Back", callback_data: "dep:usdt" }]],
    );
    return;
  }

  if (data.startsWith("btx:")) {
    const id = data.slice(4);
    await setState(chatId, { ...(user.state ?? {}), awaiting: "bin_txid", bin_dep_id: id });
    await edit(
      "🧾 Send the <b>Transaction ID</b> of your payment.\n\nBinance Pay → History → open the payment → copy the <b>Transaction ID / Order ID</b>.",
      [[{ text: "⬅️ Wallet", callback_data: "wallet" }]],
    );
    return;
  }

  if (data.startsWith("bchk:")) {
    const id = data.slice(5);
    const r = await verifyBinanceDeposit(chatId, id);
    await edit(r.message, r.keyboard ?? [[{ text: "⬅️ Wallet", callback_data: "wallet" }]]);
    return;
  }

  if (data.startsWith("dep:")) {
    const method = data.slice(4);
    const info = DEPOSIT_LABEL[method];
    if (!info) return;
    const s = await getSettings();
    const address = s[info.key] || "Not configured — contact support.";
    await setState(chatId, { ...(user.state ?? {}), awaiting: "deposit_amount", method: info.name });
    await edit(
      `<b>${info.name}</b>\n\nSend your payment to:\n<code>${address}</code>\n\nThen reply with the <b>amount</b> you sent.`,
      [[{ text: "⬅️ Back", callback_data: "wallet" }]],
    );
    return;
  }


  if (data === "redeem") {
    await setState(chatId, { ...(user.state ?? {}), awaiting: "redeem" });
    await edit("🎟 Send your redeem code now.", [[{ text: "⬅️ Back", callback_data: "wallet" }]]);
    return;
  }

  if (data.startsWith("hist:")) {
    const page = Number(data.split(":")[1] || 0);
    const { data: rows } = await db
      .from("transactions")
      .select("*")
      .eq("telegram_id", chatId)
      .order("created_at", { ascending: false })
      .range(page * 10, page * 10 + 9);
    const lines =
      (rows ?? []).length === 0
        ? "No transactions yet."
        : (rows ?? [])
            .map(
              (t: any) =>
                `${Number(t.amount) >= 0 ? "🟢" : "🔴"} ${money(Math.abs(t.amount))} · ${t.type} · ${new Date(t.created_at).toLocaleDateString()}`,
            )
            .join("\n");
    const nav: Button[] = [];
    if (page > 0) nav.push({ text: "⬅️ Prev", callback_data: `hist:${page - 1}` });
    if ((rows ?? []).length === 10) nav.push({ text: "Next ➡️", callback_data: `hist:${page + 1}` });
    const kb: Button[][] = [];
    if (nav.length) kb.push(nav);
    kb.push([{ text: "⬅️ Wallet", callback_data: "wallet" }]);
    await edit(`<b>T R A N S A C T I O N S</b>\n\n${lines}`, kb);
    return;
  }

  if (data === "profile") {
    const fresh = await getUser(chatId);
    const { count } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("telegram_id", chatId);
    await edit(
      `<b>P R O F I L E</b>\n\n` +
        `💳 Username: ${fresh.username ? "@" + fresh.username : "—"}\n` +
        `🆔 UserID: <code>${fresh.telegram_id}</code>\n` +
        `🏅 Membership: ${fresh.membership}\n` +
        `💰 Balance: ${money(fresh.balance)}\n` +
        `💎 Total Spent: ${money(fresh.total_spent)}\n` +
        `📦 Orders: ${count ?? 0}\n` +
        `🎟 Referrals: ${fresh.referral_count}`,
      [[{ text: "🏠 Home", callback_data: "home" }]],
    );
    return;
  }

  if (data === "refstore") {
    const s = await getSettings();
    const fresh = await getUser(chatId);
    await edit(
      `<b>R E F E R R A L   S T O R E</b>\n\n` +
        `Earn <b>${s["referral_percent"] || 0}%</b> of everything your referrals spend.\n\n` +
        `🎟 Referrals: ${fresh.referral_count}\n` +
        `💸 Earnings: ${money(fresh.referral_earnings)}\n\n` +
        `🔗 <code>https://t.me/${s["bot_username"] || "your_bot"}?start=ref_${fresh.ref_code}</code>`,
      [[{ text: "🏠 Home", callback_data: "home" }]],
    );
    return;
  }

  if (data.startsWith("page:")) {
    const key = data.slice(5);
    const s = await getSettings();
    await edit(s[key] || "Coming soon.", [[{ text: "🏠 Home", callback_data: "home" }]]);
    return;
  }

  if (data === "clear") {
    const state = (user.state ?? {}) as any;
    const msgs: number[] = Array.isArray(state.msgs) ? state.msgs : [];
    for (const id of msgs) await deleteMessage(chatId, id).catch(() => undefined);
    await deleteMessage(chatId, messageId).catch(() => undefined);
    await setState(chatId, { ...state, msgs: [] });
    const fresh = await getUser(chatId);
    await say(chatId, await homeText(fresh), homeKeyboard(await getSettings()));
    return;
  }

  if (data.startsWith("adm:")) {
    if (!(await isAdmin(chatId))) return;
    const action = data.slice(4);
    const arg = action.split(":")[1] ?? "";
    const st = (user.state ?? {}) as any;

    if (action === "stats") {
      await edit(await adminStatsText(), adminKeyboard());
    } else if (action === "orders") {
      const v = await admOrdersView();
      await edit(v.text, v.kb);
    } else if (action.startsWith("o:")) {
      const v = await admOrderView(arg);
      await edit(v.text, v.kb);
    } else if (action.startsWith("od:")) {
      await setState(chatId, { ...st, awaiting: "adm_deliver", adm_order: arg });
      await say(chatId, "🚚 Send the content to deliver to the buyer.");
    } else if (action.startsWith("oc:")) {
      const { data: o } = await db.from("orders").select("*").eq("id", arg).maybeSingle();
      if (o && o.status === "pending") {
        await db.from("orders").update({ status: "cancelled" }).eq("id", arg);
        const u = await getUser(o.telegram_id);
        await db
          .from("bot_users")
          .update({ balance: Number(u?.balance ?? 0) + Number(o.total) })
          .eq("telegram_id", o.telegram_id);
        await db.from("transactions").insert({
          telegram_id: o.telegram_id,
          type: "refund",
          amount: o.total,
          note: `Order #${o.order_no} cancelled`,
        });
        await sendMessage(
          o.telegram_id,
          `❌ Order #${o.order_no} was cancelled. ${money(o.total)} refunded to your balance.`,
        );
      }
      const v = await admOrdersView();
      await edit(v.text, v.kb);
    } else if (action === "pays") {
      const v = await admPaymentsView();
      await edit(v.text, v.kb);
    } else if (action.startsWith("pay:")) {
      const v = await admPaymentView(arg);
      await edit(v.text, v.kb);
    } else if (action.startsWith("pa:") || action.startsWith("pr:")) {
      const msgTxt = await admDecidePayment(arg, action.startsWith("pa:"));
      const v = await admPaymentsView();
      await edit(`${msgTxt}\n\n${v.text}`, v.kb);
    } else if (action === "user") {
      await setState(chatId, { ...st, awaiting: "adm_find" });
      await say(chatId, "👤 Send the telegram ID or @username.");
    } else if (action.startsWith("ub:")) {
      await setState(chatId, { ...st, awaiting: "adm_addbal_user", adm_target: Number(arg) });
      await say(chatId, "➕ Send the amount (negative to deduct).");
    } else if (action.startsWith("um:")) {
      await setState(chatId, { ...st, awaiting: "adm_msg_user", adm_target: Number(arg) });
      await say(chatId, "✉️ Send the message text.");
    } else if (action.startsWith("ux:")) {
      const target = await getUser(Number(arg));
      if (target) {
        await db
          .from("bot_users")
          .update({ is_banned: !target.is_banned })
          .eq("telegram_id", target.telegram_id);
      }
      const v = await admUserView(Number(arg));
      await edit(v.text, v.kb);
    } else if (action === "stock") {
      const v = await admStockPickView();
      await edit(v.text, v.kb);
    } else if (action === "icons") {
      const v = await admIconPickView();
      await edit(v.text, v.kb);
    } else if (action === "pageicons") {
      const v = await admPageIconView();
      await edit(v.text, v.kb);
    } else if (action === "ui") {
      const v = await admUiGroupView();
      await edit(v.text, v.kb);
    } else if (action.startsWith("uig:")) {
      const v = await admUiListView(arg);
      await edit(v.text, v.kb);
    } else if (action.startsWith("uie:")) {
      if (!(arg in UI_ELEMENTS)) return;
      const v = await admUiItemView(arg as UiKey);
      await edit(v.text, v.kb);
    } else if (action.startsWith("uii:") || action.startsWith("uit:")) {
      if (!(arg in UI_ELEMENTS)) return;
      const wantIcon = action.startsWith("uii:");
      await setState(chatId, {
        ...st,
        awaiting: wantIcon ? "adm_ui_icon" : "adm_ui_text",
        adm_ui_key: arg,
      });
      await say(
        chatId,
        wantIcon
          ? `🎨 Send the new icon for <b>${escapeHtml(UI_ELEMENTS[arg as UiKey].label)}</b>.\n\nNormal emoji or Telegram Premium custom emoji both work. Send <code>-</code> to reset.`
          : `✏️ Send the new text for <b>${escapeHtml(UI_ELEMENTS[arg as UiKey].label)}</b>.\n\nSend <code>-</code> to restore the default text.`,
      );
    } else if (action.startsWith("uir:")) {
      if (!(arg in UI_ELEMENTS)) return;
      await db.from("bot_settings").upsert({ key: `ui_icon_${arg}`, value: "" }, { onConflict: "key" });
      await db.from("bot_settings").upsert({ key: `ui_text_${arg}`, value: "" }, { onConflict: "key" });
      const v = await admUiItemView(arg as UiKey);
      await edit(v.text, v.kb);
    } else if (action.startsWith("pi:")) {
      const pageKey = arg as PageIconKey;
      if (!(pageKey in PAGE_ICONS)) return;
      await setState(chatId, { ...st, awaiting: "adm_page_icon", adm_page_icon: pageKey });
      await say(
        chatId,
        `🖼 Send the new header icon for <b>${PAGE_ICONS[pageKey][1]}</b>.\n\nNormal emoji or Telegram Premium custom emoji both work. Send <code>-</code> to reset.`,
      );
    } else if (action === "npw") {
      await setState(chatId, { ...st, awaiting: "np_name", np: {} });
      await say(chatId, "🆕 <b>New product · step 1/6</b>\n\nSend the product <b>name</b>.", [
        [{ text: "✖️ Cancel", callback_data: "adm:stats" }],
      ]);
    } else if (action.startsWith("npd:")) {
      const d = { ...(st.np ?? {}), delivery_type: arg === "manual" ? "manual" : "auto" } as ProdDraft;
      await setState(chatId, { ...st, awaiting: null, np: d });
      const v = await admWizardCategoryView(d);
      await edit(v.text, v.kb);
    } else if (action.startsWith("npc:")) {
      const d = { ...(st.np ?? {}), category_id: arg === "none" ? null : arg } as ProdDraft;
      await setState(chatId, { ...st, awaiting: null, np: null });
      await admCreateProduct(chatId, d);
    } else if (action === "menuicons") {
      const v = await admMenuIconView();
      await edit(v.text, v.kb);
    } else if (action.startsWith("mi:")) {
      const menuKey = arg as MenuIconKey;
      if (!(menuKey in MENU_ICONS)) return;
      await setState(chatId, { ...st, awaiting: "adm_menu_icon", adm_menu_icon: menuKey });
      await say(chatId, `🧩 Send the new icon for <b>${MENU_ICONS[menuKey][1]}</b>.\n\nPremium custom emoji and normal emoji both work. Send <code>-</code> to reset.`);
    } else if (action.startsWith("ip:")) {
      await setState(chatId, { ...st, awaiting: "adm_icon", adm_product: arg });
      await say(
        chatId,
        "🎨 Send the icon for this product now.\n\nA normal emoji or a <b>Premium custom emoji</b> both work. Send <code>-</code> to reset to 📦.",
      );

    } else if (action.startsWith("sp:")) {
      await setState(chatId, { ...st, awaiting: "adm_stock", adm_product: arg });
      await say(chatId, "📦 Send the stock items — one per line.");
    } else if (action === "code") {
      await setState(chatId, { ...st, awaiting: "adm_code" });
      await say(chatId, "🎁 Send the code value, e.g. <code>10</code>");
    } else if (action === "broadcast") {
      await setState(chatId, { ...st, awaiting: "broadcast" });
      await say(chatId, "📢 Send the broadcast message text.");
    } else if (action === "addbal") {
      await setState(chatId, { ...st, awaiting: "addbal" });
      await say(chatId, "➕ Send: <code>telegram_id amount</code>");
    } else if (action === "newprod") {
      await setState(chatId, { ...st, awaiting: "adm_newprod" });
      await say(
        chatId,
        "🆕 <b>New product</b>\n\nSend one line:\n<code>icon | name | price | auto/manual</code>\n\n" +
          "Example:\n<code>🤖 | Gemini AI Pro 18m | 4.5 | auto</code>\n\n" +
          "The icon can be a Premium custom emoji too.",
      );
    }

    return;
  }
}
