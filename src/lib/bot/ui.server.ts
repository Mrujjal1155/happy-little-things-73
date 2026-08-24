// Server-only registry of every customizable bot button / tag.
// Admin can override the icon (`ui_icon_<key>`) and the text (`ui_text_<key>`)
// of each entry from Telegram (/admin → UI icons & tags).
import type { Button } from "@/lib/telegram.server";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type UiEntry = { icon: string; label: string; group: string };

export const UI_ELEMENTS = {
  /* ---- shop page ---- */
  shop_flash: { icon: "🎁", label: "Flash Deals", group: "shop" },
  shop_prev: { icon: "⬅️", label: "Prev", group: "shop" },
  shop_next: { icon: "➡️", label: "Next", group: "shop" },
  shop_instock: { icon: "🟢", label: "in stock", group: "shop" },
  flash_tag: { icon: "🏷", label: "SALE", group: "shop" },
  flash_timer: { icon: "⏳", label: "limited offer", group: "shop" },

  /* ---- product page ---- */
  prod_buy: { icon: "🛒", label: "Buy Now", group: "product" },
  prod_addcart: { icon: "➕", label: "Add to Cart", group: "product" },
  prod_refresh: { icon: "🔄", label: "Refresh", group: "product" },
  prod_back: { icon: "⬅️", label: "Back", group: "product" },
  prod_cart: { icon: "🧺", label: "Cart", group: "product" },
  prod_home: { icon: "🏠", label: "Home", group: "product" },
  prod_out: { icon: "❌", label: "Out of stock", group: "product" },
  prod_drop: { icon: "🔥", label: "PRICE DROP", group: "product" },
  prod_price: { icon: "💎", label: "Price", group: "product" },
  prod_save: { icon: "🔻", label: "Save", group: "product" },
  prod_stock: { icon: "📦", label: "In Stock", group: "product" },
  prod_manual: { icon: "📦", label: "Delivery: manual (admin delivers)", group: "product" },

  /* ---- cart page ---- */
  cart_checkout: { icon: "✅", label: "Checkout", group: "cart" },
  cart_continue: { icon: "🛒", label: "Continue shopping", group: "cart" },
  cart_clear: { icon: "🧹", label: "Clear cart", group: "cart" },
  cart_wallet: { icon: "💰", label: "Wallet", group: "cart" },
  cart_home: { icon: "🏠", label: "Home", group: "cart" },
  cart_total: { icon: "🧾", label: "Total", group: "cart" },

  /* ---- checkout page ---- */
  co_coupon: { icon: "🏷", label: "Apply coupon", group: "checkout" },
  co_coupon_rm: { icon: "🗑", label: "Remove coupon", group: "checkout" },
  co_pay: { icon: "💳", label: "Pay now", group: "checkout" },
  co_subtotal: { icon: "🧾", label: "Subtotal", group: "checkout" },
  co_total: { icon: "💵", label: "Total to pay", group: "checkout" },

  /* ---- payment page ---- */
  pay_balance: { icon: "💰", label: "Pay with balance", group: "payment" },
  pay_payid: { icon: "🪙", label: "Binance Pay ID", group: "payment" },
  pay_bep20: { icon: "💵", label: "USDT BEP-20 (BSC)", group: "payment" },
  pay_trc20: { icon: "💵", label: "USDT TRC-20 (Tron)", group: "payment" },
  pay_back: { icon: "⬅️", label: "Back", group: "payment" },

  /* ---- wallet page ---- */
  wal_binance: { icon: "🪙", label: "Binance Pay", group: "wallet" },
  wal_usdt: { icon: "💵", label: "USDT crypto (auto)", group: "wallet" },
  wal_bkash: { icon: "📱", label: "bKash", group: "wallet" },
  wal_nagad: { icon: "📲", label: "Nagad", group: "wallet" },
  wal_redeem: { icon: "🎟", label: "Redeem Code", group: "wallet" },
  wal_history: { icon: "🧾", label: "Transaction History", group: "wallet" },
  wal_home: { icon: "🏠", label: "Home", group: "wallet" },

  /* ---- orders page ---- */
  ord_refresh: { icon: "🔄", label: "Refresh", group: "orders" },
  ord_shop: { icon: "🛒", label: "SHOP", group: "orders" },
  ord_home: { icon: "🏠", label: "Home", group: "orders" },
  ord_my: { icon: "📦", label: "My Orders", group: "orders" },
} as const satisfies Record<string, UiEntry>;

export type UiKey = keyof typeof UI_ELEMENTS;

export const UI_GROUPS = ["shop", "product", "cart", "checkout", "payment", "wallet", "orders"] as const;
export type UiGroup = (typeof UI_GROUPS)[number];

export function uiKeysOf(group: string): UiKey[] {
  return (Object.keys(UI_ELEMENTS) as UiKey[]).filter((k) => UI_ELEMENTS[k].group === group);
}

function raw(settings: Record<string, string>, key: UiKey) {
  const configured = (settings[`ui_icon_${key}`] ?? "").trim();
  const customId = /^\d{8,}$/.test(configured) ? configured : "";
  const glyph = customId ? UI_ELEMENTS[key].icon : configured || UI_ELEMENTS[key].icon;
  return { customId, glyph };
}

/** Admin-customizable label (tag) text. */
export function uiText(settings: Record<string, string>, key: UiKey) {
  const custom = (settings[`ui_text_${key}`] ?? "").trim();
  return custom || UI_ELEMENTS[key].label;
}

/** Icon + label as HTML (Premium custom emoji supported) for message bodies. */
export function uiTag(settings: Record<string, string>, key: UiKey, label?: string) {
  const { customId, glyph } = raw(settings, key);
  const icon = customId
    ? `<tg-emoji emoji-id="${customId}">${esc(glyph)}</tg-emoji>`
    : esc(glyph);
  const text = label ?? uiText(settings, key);
  return `${icon} ${esc(text)}`.trim();
}

/** Only the icon, as HTML. */
export function uiIconHtml(settings: Record<string, string>, key: UiKey) {
  const { customId, glyph } = raw(settings, key);
  return customId ? `<tg-emoji emoji-id="${customId}">${esc(glyph)}</tg-emoji>` : esc(glyph);
}

/** Inline keyboard button honouring the admin's icon + label overrides. */
export function uiBtn(
  settings: Record<string, string>,
  key: UiKey,
  callback_data: string,
  suffix?: string,
): Button {
  const { customId, glyph } = raw(settings, key);
  const label = `${uiText(settings, key)}${suffix ? ` ${suffix}` : ""}`;
  return {
    text: `${customId ? "" : glyph} ${label}`.trim(),
    callback_data,
    ...(customId ? { icon_custom_emoji_id: customId } : {}),
  };
}
