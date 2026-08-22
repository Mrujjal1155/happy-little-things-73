// Server-only Binance API helper (Pay ID + on-chain USDT deposits).
// Mirrors the paykori.online gateway logic: signed SAPI requests with HMAC-SHA256.
import { createHmac } from "crypto";

const BASE = "https://api.binance.com";

export type BinanceCreds = { apiKey: string; secretKey: string };

/** Keys come from the admin dashboard (DB, server-only read) or fall back to env secrets. */
export async function getCreds(): Promise<BinanceCreds | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("binance_credentials")
      .select("api_key,api_secret")
      .eq("id", 1)
      .maybeSingle();
    if (data?.api_key && data?.api_secret) {
      return { apiKey: data.api_key as string, secretKey: data.api_secret as string };
    }
  } catch {
    /* fall through to env */
  }
  const apiKey = process.env["BINANCE_API_KEY"];
  const secretKey = process.env["BINANCE_API_SECRET"];
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey };
}

/** True when keys are stored (without revealing them). */
export async function hasStoredCreds() {
  return (await getCreds()) !== null;
}

/** Validate a key pair without persisting it. */
export async function validateCreds(creds: BinanceCreds) {
  const r = await signedGet("/sapi/v1/capital/config/getall", {}, creds);
  if (!r.ok) return { ok: false as const, message: `Binance rejected the keys: ${r.error}` };
  return { ok: true as const, message: "Binance API keys are valid." };
}

async function signedGet(path: string, params: Record<string, string | number>, creds: BinanceCreds) {
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: String(Date.now()),
    recvWindow: "10000",
  }).toString();
  const signature = createHmac("sha256", creds.secretKey).update(query).digest("hex");
  const res = await fetch(`${BASE}${path}?${query}&signature=${signature}`, {
    headers: { "X-MBX-APIKEY": creds.apiKey },
  });
  const body = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(body);
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    console.error(`Binance ${path} failed [${res.status}]: ${body}`);
    return { ok: false as const, status: res.status, error: json?.msg ?? body, data: json };
  }
  return { ok: true as const, status: res.status, data: json, error: null };
}

/** Fetch (or create) the merchant's USDT deposit address for a network. */
export async function getDepositAddress(network: string) {
  const creds = getCreds();
  if (!creds) return { ok: false as const, error: "Binance API keys are not configured." };
  const r = await signedGet("/sapi/v1/capital/deposit/address", { coin: "USDT", network }, creds);
  if (!r.ok || !r.data?.address) {
    return { ok: false as const, error: r.ok ? "No address returned by Binance." : String(r.error) };
  }
  return { ok: true as const, address: r.data.address as string, tag: (r.data.tag ?? "") as string };
}

export type MatchResult =
  | { ok: true; txId: string; amount: number }
  | { ok: false; error?: string | undefined; pending: true };

/** Look for a matching on-chain USDT deposit of `expected` amount. */
export async function findCryptoDeposit(expected: number, network: string | null, isUsed: (tx: string) => Promise<boolean>): Promise<MatchResult> {
  const creds = getCreds();
  if (!creds) return { ok: false, pending: true, error: "Binance API keys are not configured." };
  const r = await signedGet(
    "/sapi/v1/capital/deposit/hisrec",
    { coin: "USDT", limit: 50, startTime: (Date.now() - 2 * 60 * 60 * 1000) },
    creds,
  );
  if (!r.ok || !Array.isArray(r.data)) return { ok: false, pending: true, error: r.ok ? undefined : String(r.error) };
  for (const d of r.data) {
    const netMatch = !network || d.network === network;
    if (netMatch && Math.abs(Number(d.amount) - expected) < 0.01 && [0, 1, 6].includes(Number(d.status))) {
      const txId = String(d.txId ?? d.id);
      if (!(await isUsed(txId))) return { ok: true, txId, amount: Number(d.amount) };
    }
  }
  return { ok: false, pending: true };
}

/** Look for a matching Binance Pay (Pay ID) transfer of `expected` USDT. */
export async function findPayTransaction(expected: number, isUsed: (tx: string) => Promise<boolean>): Promise<MatchResult> {
  const creds = getCreds();
  if (!creds) return { ok: false, pending: true, error: "Binance API keys are not configured." };
  const r = await signedGet("/sapi/v1/pay/transactions", { limit: 50, startTime: Date.now() - 2 * 60 * 60 * 1000 }, creds);
  if (!r.ok || !Array.isArray(r.data?.data)) return { ok: false, pending: true, error: r.ok ? undefined : String(r.error) };
  for (const t of r.data.data) {
    const amount = Number(t.amount);
    if (amount > 0 && Math.abs(amount - expected) < 0.01) {
      const txId = String(t.transactionId);
      if (!(await isUsed(txId))) return { ok: true, txId, amount };
    }
  }
  return { ok: false, pending: true };
}

export async function checkBinanceKeys() {
  const creds = getCreds();
  if (!creds) return { ok: false as const, message: "BINANCE_API_KEY / BINANCE_API_SECRET are not set." };
  const r = await signedGet("/sapi/v1/capital/config/getall", {}, creds);
  if (!r.ok) return { ok: false as const, message: `Binance rejected the keys: ${r.error}` };
  return { ok: true as const, message: "Binance API keys are valid." };
}
