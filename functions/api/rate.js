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
  if (cache.rate && now - cache.ts < 120000) return cache.rate;
  // 1) Bitpin (ایرانی، تومان مستقیم): بازار USDT-IRT (قیمت به ریال → /10)
  try {
    const r = await fetch('https://api.bitpin.ir/v1/mkt/markets/', { headers:{'User-Agent':'Mozilla/5.0'} });
    if (r.ok) {
      const j = await r.json();
      const results = j.results || (Array.isArray(j)?j:[]);
      const usdt = results.find(m=>(m.currency1?.code||'').toUpperCase()==='USDT' && (m.currency2?.code||'').toUpperCase()==='IRT');
      if (usdt) {
        const price = parseFloat(usdt.price_info?.price||0);
        const rate = Math.round(price/10);
        if (rate > 10000) { cache = { rate, ts: now }; return rate; }
      }
    }
  } catch (e) {}
  // 2) OKX USDT-TRY
  try {
    const r = await fetch('https://www.okx.com/api/v5/market/ticker?instId=USDT-TRY', { headers:{'User-Agent':'Mozilla/5.0'} });
    if (r.ok) {
      const j = await r.json();
      const tryRate = parseFloat(j.data?.[0]?.last||0);
      const rate = Math.round(tryRate * 1.04);
      if (rate > 10000) { cache = { rate, ts: now }; return rate; }
    }
  } catch (e) {}
  // 3) KuCoin USDT-TRY
  try {
    const r = await fetch('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=USDT-TRY', { headers:{'User-Agent':'Mozilla/5.0'} });
    if (r.ok) {
      const j = await r.json();
      const tryRate = parseFloat(j.data?.price||0);
      const rate = Math.round(tryRate * 1.04);
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
