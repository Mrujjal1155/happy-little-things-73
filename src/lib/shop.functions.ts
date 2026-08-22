import { createServerFn } from "@tanstack/react-start";

/* Public storefront server functions — no auth required.
   Reads use the publishable key (anon RLS), writes are validated then
   performed with the admin client loaded inside the handler. */

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return { url, key };
}

async function anonSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  const { url, key } = publicClient();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listStorefront = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await anonSupabase();
  const [cats, prods] = await Promise.all([
    sb.from("categories").select("id,name,emoji,sort_order,channel").eq("is_active", true).order("sort_order"),
    sb
      .from("products")
      .select(
        "id,name,emoji,description,price,old_price,delivery_type,category_id,sort_order,image_url,delivery_time,badge",
      )
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  const categories = (cats.data ?? []).filter((c: any) => c.channel !== "telegram");
  const allowed = new Set(categories.map((c: any) => c.id));
  const base = (prods.data ?? []).filter((p: any) => !p.category_id || allowed.has(p.category_id));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: stock } = await supabaseAdmin.from("stock_items").select("product_id").eq("is_sold", false);
  const counts: Record<string, number> = {};
  for (const s of stock ?? []) counts[s.product_id as string] = (counts[s.product_id as string] ?? 0) + 1;

  const products = base.map((p: any) => ({ ...p, stock: counts[p.id] ?? 0 }));
  return { categories, products };
});

export const getStoreProduct = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const sb = await anonSupabase();
    const { data: row } = await sb
      .from("products")
      .select(
        "id,name,emoji,description,price,old_price,delivery_type,category_id,image_url,delivery_time,badge",
      )
      .eq("id", data.id)
      .eq("is_active", true)
      .maybeSingle();
    return row ?? null;
  });

export const getStorePayInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("bot_settings")
    .select("key,value")
    .in("key", ["binance_pay_id", "usdt_bep20_address", "usdt_trc20_address", "bot_username"]);
  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.key] = r.value ?? "";
  return map;
});

export const placeWebsiteOrder = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      product_id: string;
      quantity: number;
      customer_name: string;
      customer_email: string;
      payment_method: string;
      txid: string;
    }) => {
      const qty = Math.max(1, Math.min(20, Math.floor(Number(d.quantity) || 1)));
      const email = String(d.customer_email ?? "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Valid email is required");
      const name = String(d.customer_name ?? "").trim().slice(0, 80);
      if (name.length < 2) throw new Error("Name is required");
      const txid = String(d.txid ?? "").trim().slice(0, 200);
      if (txid.length < 4) throw new Error("Transaction ID / payment reference is required");
      const method = ["binance", "usdt_bep20", "usdt_trc20"].includes(d.payment_method) ? d.payment_method : "binance";
      return { product_id: String(d.product_id), quantity: qty, customer_name: name, customer_email: email, payment_method: method, txid };
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id,name,price,delivery_type,is_active")
      .eq("id", data.product_id)
      .maybeSingle();
    if (!product || !product.is_active) throw new Error("Product is not available");

    const dup = await supabaseAdmin.from("orders").select("id").eq("txid", data.txid).maybeSingle();
    if (dup.data) throw new Error("This transaction ID has already been used");

    const unit = Number(product.price);
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        telegram_id: 0,
        source: "website",
        product_id: product.id,
        product_name: product.name,
        quantity: data.quantity,
        unit_price: unit,
        total: unit * data.quantity,
        status: "pending",
        delivery_type: product.delivery_type,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        payment_method: data.payment_method,
        txid: data.txid,
      })
      .select("order_no")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { order_no: order?.order_no as number };
  });

export const trackWebsiteOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { order_no: number | string; email: string }) => ({
    order_no: Number(d.order_no),
    email: String(d.email ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data }) => {
    if (!data.order_no || !data.email) throw new Error("Order number and email are required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("orders")
      .select("order_no,product_name,quantity,total,status,delivery_type,delivered_content,created_at,customer_email")
      .eq("order_no", data.order_no)
      .eq("source", "website")
      .maybeSingle();
    if (!row || String(row.customer_email ?? "").toLowerCase() !== data.email) throw new Error("Order not found");
    const { customer_email, ...safe } = row as any;
    return safe;
  });
