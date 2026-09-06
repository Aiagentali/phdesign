import { json, corsHeaders } from '../lib/auth.js';

// GET /api/rate?fiat=usdt&amount=4150000
// نرخ لحظه‌ای تتر از نوبیتکس (بازار USDT-IRT و USDT-TTM)
// اگر نوبیتکس در دسترس نبود: فالبک به قیمت جهانی + حاشیه
const WALLEX_URL = 'https://api.wallex.ir/v1/markets';
const NOBITEX_URL = 'https://api.nobitex.ir/market/stats?srcCurrency=usdt&dstCurrency=irt';
const GLOBAL_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY';

// ساده: cache در ماژول برای 60 ثانیه (per-isolate)
let cache = { rate: 0, ts: 0 };

async function getRate() {
  const now = Date.now();
  if (cache.rate && now - cache.ts < 60000) return cache.rate;
  // 1) Wallex USDT-Toman
  try {
    const r = await fetch(WALLEX_URL, { headers: { 'User-Agent': 'PHWeb/1.0' } });
    if (r.ok) {
      const j = await r.json();
      const st = j.result?.symbols?.USDTTMN?.stats;
      const bid = parseFloat(st?.bidPrice||0), ask = parseFloat(st?.askPrice||0);
      const mid = (bid&&ask)? (bid+ask)/2 : (bid||ask||0);
      const rate = Math.round(mid);
      if (rate > 10000) { cache = { rate, ts: now }; return rate; }
    }
  } catch (e) {}
  // 2) Nobitex
  try {
    const r = await fetch(NOBITEX_URL, { method:'POST', headers: { 'User-Agent': 'PHWeb/1.0' } });
    if (r.ok) {
      const j = await r.json();
      const rate = Math.round((j.stats?.USDTIRT?.latestTradePrice || 0) / 10);
      if (rate > 10000) { cache = { rate, ts: now }; return rate; }
    }
  } catch (e) { /* fallthrough */ }
  try {
    // fallback: binance USDTTRY (TRY ~= toman/1000 تقریبا) — فقط برای اضطرار
    const r2 = await fetch(GLOBAL_URL);
    if (r2.ok) {
      const j2 = await r2.json();
      const rate = Math.round(parseFloat(j2.price) / 10); // very rough
      if (rate > 10000) { cache = { rate, ts: now }; return rate; }
    }
  } catch (e) {}
  return 0;
}

export async function onRequestGet({ request, env }) {
  try {
    const rate = await getRate();
    if (!rate) return json({ error: 'rate_unavailable', rate: 0 }, 200, corsHeaders(request));
    const url = new URL(request.url);
    const amount = parseInt(url.searchParams.get('amount') || '0');
    let crypto_amount = null;
    if (amount > 0) {
      crypto_amount = Math.round((amount / rate) * 100) / 100; // 2 decimal unique
    }
    return json({ ok: true, rate, crypto_amount, updated_at: Math.floor(Date.now()/1000) }, 200, corsHeaders(request));
  } catch (e) {
    return json({ error: e.message, rate: 0 }, 200, corsHeaders(request));
  }
}
export async function onRequestOptions({ request }) { return new Response(null, { headers: corsHeaders(request) }); }
