// Server-only Telegram shop bot engine.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  answerCallback,
  deleteMessage,
  editMessage,
  sendMessage,
  type Button,
} from "@/lib/telegram.server";

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

async function isAdmin(telegramId: number, settings?: Record<string, string>) {
  const s = settings ?? (await getSettings());
  return (s["admin_telegram_ids"] || "")
    .split(/[,\s]+/)
    .filter(Boolean)
    .includes(String(telegramId));
}

async function notifyAdmins(text: string) {
  const s = await getSettings();
  const ids = (s["admin_telegram_ids"] || "").split(/[,\s]+/).filter(Boolean);
  for (const id of ids) await sendMessage(id, text);
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

function homeKeyboard(): Button[][] {
  return [
    [{ text: "🛒 SHOP", callback_data: "shop:0" }],
    [
      { text: "💰 Wallet", callback_data: "wallet" },
      { text: "🎁 Freebies", callback_data: "page:freebies_text" },
      { text: "👤 Profile", callback_data: "profile" },
    ],
    [{ text: "🏪 Referral Store", callback_data: "refstore" }],
    [
      { text: "🆘 Support", callback_data: "page:support_text" },
      { text: "📧 Emails & Trials", callback_data: "page:emails_trials_text" },
    ],
    [
      { text: "🔌 Reseller API", callback_data: "page:reseller_api_text" },
      { text: "🧹 Clear Chat", callback_data: "clear" },
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

async function shopView(page: number) {
  const products = await productsWithStock();
  const inStock = products.filter((p: any) => p.delivery_type === "manual" || p.stock > 0).length;
  const slice = products.slice(page * PAGE, page * PAGE + PAGE);
  const kb: Button[][] = slice.map((p: any) => [
    {
      text: `${p.emoji ?? "📦"} ${p.name} | ${money(p.price)} | ${
        p.delivery_type === "manual" ? "manual" : `📦 ${p.stock}`
      }`,
      callback_data: `p:${p.id}`,
    },
  ]);
  const nav: Button[] = [];
  if (page > 0) nav.push({ text: "⬅️ Prev", callback_data: `shop:${page - 1}` });
  if (products.length > (page + 1) * PAGE) nav.push({ text: "Next ➡️", callback_data: `shop:${page + 1}` });
  if (nav.length) kb.push(nav);
  kb.push([
    { text: "🔄 Refresh", callback_data: `shop:${page}` },
    { text: "🏠 Home", callback_data: "home" },
  ]);
  const text =
    `<b>P R O D U C T S</b>\n\n` +
    `🟢 <b>${inStock} of ${products.length}</b> in stock\n` +
    `<i>Tap a product below to view details.</i>`;
  return { text, kb };
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

  let text = "";
  if (hasDrop) text += `🔥 <b>PRICE DROP</b>\n──────────────\n`;
  text += `${p.emoji ?? "📦"} <b>${p.name}</b>\n\n`;
  if (p.description) text += `${p.description}\n\n`;
  if (hasDrop) {
    text += `📉 Price Drop\n<s>${money(p.old_price)}</s> ➡️ <b>${money(p.price)}</b>  🔻 Save ${off}%\n`;
  } else {
    text += `💎 Price: <b>${money(p.price)}</b>\n`;
  }
  text +=
    p.delivery_type === "manual"
      ? `📦 Delivery: manual (admin delivers)\n`
      : `📦 In Stock: <b>${stock} available</b>\n`;
  if (p.manual_note) text += `\n<i>${p.manual_note}</i>\n`;

  const available = p.delivery_type === "manual" || stock > 0;
  const kb: Button[][] = [];
  if (available)
    kb.push([
      { text: "🛒 Buy Now", callback_data: `qty:${p.id}` },
      { text: "➕ Add to Cart", callback_data: `cadd:${p.id}:1` },
    ]);
  else kb.push([{ text: "❌ Out of stock", callback_data: `p:${p.id}` }]);
  kb.push([
    { text: "🔄 Refresh", callback_data: `p:${p.id}` },
    { text: "⬅️ Back", callback_data: "shop:0" },
  ]);
  kb.push([
    { text: "🧺 Cart", callback_data: "cart" },
    { text: "🏠 Home", callback_data: "home" },
  ]);
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
  const { lines, total } = await cartDetails(user);
  if (!lines.length) {
    return {
      text: `<b>Y O U R   C A R T</b>\n\n🧺 Your cart is empty.\n\n<i>Browse the shop and tap “Add to Cart”.</i>`,
      kb: [
        [{ text: "🛒 SHOP", callback_data: "shop:0" }],
        [{ text: "🏠 Home", callback_data: "home" }],
      ] as Button[][],
    };
  }

  let text = `<b>Y O U R   C A R T</b>\n──────────────\n`;
  const kb: Button[][] = [];
  let issues = 0;
  for (const l of lines) {
    const short = l.product.delivery_type === "auto" && l.stock < l.qty;
    if (short) issues++;
    text +=
      `${l.product.emoji ?? "📦"} <b>${l.product.name}</b>\n` +
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
    `──────────────\n🧾 Total: <b>${money(total)}</b>\n` +
    `💰 Balance: ${money(user.balance)}\n`;
  if (Number(user.balance) < total) text += `\n⚠️ Not enough balance — add funds in Wallet.\n`;
  if (issues) text += `\n⚠️ Some items exceed available stock.\n`;

  kb.push([{ text: `✅ Checkout · ${money(total)}`, callback_data: "cchk" }]);
  kb.push([
    { text: "🛒 Continue shopping", callback_data: "shop:0" },
    { text: "🧹 Clear cart", callback_data: "cclear" },
  ]);
  kb.push([
    { text: "💰 Wallet", callback_data: "wallet" },
    { text: "🏠 Home", callback_data: "home" },
  ]);
  return { text, kb };
}


async function walletView(user: any) {
  const text =
    `<b>W A L L E T</b>\n\n` +
    `Your Balance and Spending Stats are:\n──────────────\n` +
    `💰 Balance: <b>${money(user.balance)}</b>\n` +
    `💎 Total Spent: ${money(user.total_spent)}\n` +
    `🏅 Membership: ${user.membership}\n` +
    `──────────────\n\n` +
    `<i>Choose a payment method below to add funds to your wallet.</i>`;
  const kb: Button[][] = [
    [{ text: "🪙 Binance Pay", callback_data: "dep:binance" }],
    [{ text: "💵 USDT BEP-20 · BSC", callback_data: "dep:usdt" }],
    [
      { text: "📱 bKash", callback_data: "dep:bkash" },
      { text: "📲 Nagad", callback_data: "dep:nagad" },
    ],
    [{ text: "🎟 Redeem Code", callback_data: "redeem" }],
    [{ text: "🧾 Transaction History", callback_data: "hist:0" }],
    [{ text: "🏠 Home", callback_data: "home" }],
  ];
  return { text, kb };
}

const DEPOSIT_LABEL: Record<string, { name: string; key: string }> = {
  binance: { name: "Binance Pay", key: "binance_pay_id" },
  usdt: { name: "USDT BEP-20 (BSC)", key: "usdt_bep20_address" },
  bkash: { name: "bKash", key: "bkash_number" },
  nagad: { name: "Nagad", key: "nagad_number" },
};

/* -------------------------------------------------------------- purchasing */

async function completePurchase(user: any, product: any, qty: number) {
  const total = Number(product.price) * qty;
  if (Number(user.balance) < total) {
    return { error: `Insufficient balance. You need ${money(total)} but have ${money(user.balance)}.` };
  }

  let delivered: string | null = null;
  let status = "pending";

  if (product.delivery_type === "auto") {
    const { data: items } = await db
      .from("stock_items")
      .select("*")
      .eq("product_id", product.id)
      .eq("is_sold", false)
      .order("created_at", { ascending: true })
      .limit(qty);
    if (!items || items.length < qty) return { error: "Not enough stock available right now." };
    await db
      .from("stock_items")
      .update({ is_sold: true, sold_to: user.telegram_id, sold_at: new Date().toISOString() })
      .in(
        "id",
        items.map((i: any) => i.id),
      );
    delivered = items.map((i: any) => i.content).join("\n");
    status = "completed";
  }

  const { data: order } = await db
    .from("orders")
    .insert({
      telegram_id: user.telegram_id,
      product_id: product.id,
      product_name: product.name,
      quantity: qty,
      unit_price: product.price,
      total,
      status,
      delivery_type: product.delivery_type,
      delivered_content: delivered,
    })
    .select("*")
    .maybeSingle();

  const newSpent = Number(user.total_spent) + total;
  await db
    .from("bot_users")
    .update({
      balance: Number(user.balance) - total,
      total_spent: newSpent,
      membership: membershipFor(newSpent),
    })
    .eq("telegram_id", user.telegram_id);

  await db.from("transactions").insert({
    telegram_id: user.telegram_id,
    type: "purchase",
    amount: -total,
    method: "balance",
    reference: order?.id ?? null,
    note: `${qty}x ${product.name}`,
  });

  // referral commission
  if (user.referred_by) {
    const s = await getSettings();
    const pct = Number(s["referral_percent"] || 0);
    if (pct > 0) {
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
  }

  return { order, delivered, status, total };
}

export async function announcePurchase(user: any, product: any, qty: number) {
  const s = await getSettings();
  const chat = s["announce_chat_id"];
  if (!chat) return;
  await sendMessage(
    chat,
    `User ${maskUsername(user.username, user.first_name)} just bought ${qty}× ${product.emoji ?? ""} <b>${product.name}</b>!`,
  );
}

/* ------------------------------------------------------------- dispatchers */

export async function handleUpdate(update: any) {
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
    await say(chatId, await homeText(fresh), homeKeyboard());
    return;
  }

  if (text.startsWith("/admin")) {
    if (!(await isAdmin(chatId))) {
      await say(chatId, "⛔ You are not an admin.");
      return;
    }
    await say(chatId, await adminStatsText(), [
      [{ text: "🔄 Refresh", callback_data: "adm:stats" }],
      [{ text: "📢 Broadcast", callback_data: "adm:broadcast" }],
      [{ text: "➕ Add Balance", callback_data: "adm:addbal" }],
      [{ text: "🏠 Home", callback_data: "home" }],
    ]);
    return;
  }

  // state machine
  const state = (user.state ?? {}) as any;
  switch (state.awaiting) {
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
      await doBuy(chatId, state.product_id, qty);
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

async function doBuy(chatId: number, productId: string, qty: number) {
  const user = await getUser(chatId);
  const { data: product } = await db.from("products").select("*").eq("id", productId).maybeSingle();
  if (!user || !product) return;
  const result = await completePurchase(user, product, qty);
  if ((result as any).error) {
    await say(chatId, `❌ ${(result as any).error}`, [
      [{ text: "💰 Wallet", callback_data: "wallet" }],
      [{ text: "🏠 Home", callback_data: "home" }],
    ]);
    return;
  }
  if (result.status === "completed") {
    await say(
      chatId,
      `✅ <b>Order #${result.order?.order_no}</b> completed!\n${qty}× ${product.name}\nPaid: ${money(result.total)}\n\n<pre>${escapeHtml(result.delivered ?? "")}</pre>`,
      [[{ text: "🏠 Home", callback_data: "home" }]],
    );
  } else {
    await say(
      chatId,
      `🕐 <b>Order #${result.order?.order_no}</b> placed!\n${qty}× ${product.name}\nPaid: ${money(result.total)}\n\nThis product is delivered manually — an admin will deliver it shortly.`,
      [[{ text: "🏠 Home", callback_data: "home" }]],
    );
    await notifyAdmins(
      `🕐 <b>Manual order #${result.order?.order_no}</b>\nUser: <code>${chatId}</code>\n${qty}× ${product.name}`,
    );
  }
  await announcePurchase(user, product, qty);
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
    await edit(await homeText(fresh), homeKeyboard());
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
      [{ text: "⬅️ Back", callback_data: `p:${productId}` }],
    ];
    await edit("🔢 <b>Select quantity</b>", kb);
    return;
  }

  if (data.startsWith("cq:")) {
    await setState(chatId, { ...(user.state ?? {}), awaiting: "custom_qty", product_id: data.slice(3) });
    await say(chatId, "✏️ Send the quantity you want to buy.");
    return;
  }

  if (data.startsWith("buy:")) {
    const [, productId, n] = data.split(":");
    await doBuy(chatId, productId!, Number(n));
    return;
  }

  if (data === "wallet") {
    const fresh = await getUser(chatId);
    const view = await walletView(fresh);
    await edit(view.text, view.kb);
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
    await say(chatId, await homeText(fresh), homeKeyboard());
    return;
  }

  if (data.startsWith("adm:")) {
    if (!(await isAdmin(chatId))) return;
    const action = data.slice(4);
    if (action === "stats") {
      await edit(await adminStatsText(), [
        [{ text: "🔄 Refresh", callback_data: "adm:stats" }],
        [{ text: "📢 Broadcast", callback_data: "adm:broadcast" }],
        [{ text: "➕ Add Balance", callback_data: "adm:addbal" }],
        [{ text: "🏠 Home", callback_data: "home" }],
      ]);
    } else if (action === "broadcast") {
      await setState(chatId, { ...(user.state ?? {}), awaiting: "broadcast" });
      await say(chatId, "📢 Send the broadcast message text.");
    } else if (action === "addbal") {
      await setState(chatId, { ...(user.state ?? {}), awaiting: "addbal" });
      await say(chatId, "➕ Send: <code>telegram_id amount</code>");
    }
    return;
  }
}
