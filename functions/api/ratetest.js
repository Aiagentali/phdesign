import { corsHeaders } from '../lib/auth.js';
export async function onRequestGet({ request }) {
  const out = {};
  const tests = {
    coingecko:'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=try',
    coinbase:'https://api.coinbase.com/v2/exchange-rates?currency=USDT',
    binance_us:'https://api.binance.us/api/v3/ticker/price?symbol=USDTTRY',
    kucoin:'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=USDT-TRY',
    okx:'https://www.okx.com/api/v5/market/ticker?instId=USDT-TRY',
    bitpin:'https://api.bitpin.ir/v1/mkt/markets/',
    exir:'https://api.exir.io/v1/ticker?symbol=usdt-irt',
    openexchange:'https://open.er-api.com/v6/latest/USD'
  };
  for (const [k,u] of Object.entries(tests)) {
    try { const r = await fetch(u, { headers:{'User-Agent':'Mozilla/5.0'} }); out[k] = r.status; }
    catch(e) { out[k] = 'ERR'; }
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type':'application/json', ...corsHeaders(request) } });
}
