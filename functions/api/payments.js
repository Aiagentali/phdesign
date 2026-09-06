import { getUserFromRequest, json, corsHeaders, sanitize } from '../lib/auth.js';
import { q1, q, exec, nowSec, uuid } from '../lib/db.js';

// POST: crypto/card with payment_phase=deposit|remaining|full
// همه پرداخت‌ها pending هستند و توسط ادمین تایید می‌شوند (کریپتو دیگر الکی تایید نمی‌شود)
// receipt_data: base64 داده فیش / اسکرین‌شات تراکنش (الزامی برای هر دو روش)
export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشدهاید'},401,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'درخواست نامعتبر'},400,corsHeaders(request)); }
  const orderId = sanitize(body.order_id,64);
  const method = sanitize(body.method,10);
  const phase = sanitize(body.payment_phase||body.phase||'full',10);
  const txHash = sanitize(body.tx_hash||'',120);
  const receiptUrl = sanitize(body.receipt_url||'',500);
  const receiptData = body.receipt_data ? String(body.receipt_data).slice(0, 8*1024*1024) : '';
  const receiptMime = sanitize(body.receipt_mime||'',50);
  const receiptName = sanitize(body.receipt_name||'',120);
  const cryptoAsset = sanitize(body.crypto_asset||'USDT_TRC20',20);
  if (!orderId || !['crypto','card'].includes(method)) return json({error:'پارامتر نامعتبر'},400,corsHeaders(request));
  if (!['deposit','remaining','full'].includes(phase)) return json({error:'نوع پرداخت نامعتبر'},400,corsHeaders(request));
  const asset = ['USDT_TRC20','BTC'].includes(cryptoAsset) ? cryptoAsset : 'USDT_TRC20';
  if (method==='card') {
    const hasReceiptFile = receiptData && receiptData.length > 100;
    const hasReceiptUrl = receiptUrl && receiptUrl.length > 4;
    if (!hasReceiptFile && !hasReceiptUrl) return json({error:'لطفاً تصویر فیش را آپلود کنید'},400,corsHeaders(request));
    if (hasReceiptFile && receiptData.length > 6*1024*1024) return json({error:'حجم فایل زیاد است (حداکثر 4MB)'},400,corsHeaders(request));
  }

  const order = await q1(env.DB, 'SELECT id,user_id,total_price,status FROM orders WHERE id=?', [orderId]);
  if (!order) return json({error:'سفارش یافت نشد'},404,corsHeaders(request));
  if (order.user_id !== user.id && user.role==='customer') return json({error:'دسترسی ندارید'},403,corsHeaders(request));

  let terms = {deposit_percent:50};
  try { const r=await q1(env.DB,'SELECT value FROM settings WHERE key=?',['payment_terms']); if(r) terms=JSON.parse(r.value); } catch {}
  const depositPercent = Math.min(90, Math.max(10, parseInt(terms.deposit_percent)||50));
  const depositAmount = Math.round(order.total_price * depositPercent / 100);
  const remainingAmount = order.total_price - depositAmount;

  let amount = 0;
  if (phase==='deposit') amount = depositAmount;
  else if (phase==='remaining') amount = remainingAmount;
  else amount = order.total_price;

  // crypto: قفل مبلغ USDT با نرخ لحظه‌ای + شناسه یونیک (اعشار 1-99)
  let cryptoAmount = null, rateUsed = null;
  if (method==='crypto' && cryptoAsset==='USDT_TRC20') {
    try {
      let rj = null;
      try {
        const rr = await fetch(new URL('/api/rate', request.url).toString());
        rj = await rr.json();
      } catch(e) { rj = null; }
      if (!rj || !rj.rate) {
        // OKX USDT-TRY fallback
        try {
          const ro = await fetch('https://www.okx.com/api/v5/market/ticker?instId=USDT-TRY', { headers:{'User-Agent':'Mozilla/5.0'} });
          if (ro.ok) {
            const jo = await ro.json();
            const t = parseFloat(jo.data?.[0]?.last||0);
            if (t>1000) rj = { rate: Math.round(t*1.04) };
          }
        } catch(e) {}
      }
      if (!rj || !rj.rate) {
        // KuCoin USDT-TRY fallback
        try {
          const rk = await fetch('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=USDT-TRY', { headers:{'User-Agent':'Mozilla/5.0'} });
          if (rk.ok) {
            const jk = await rk.json();
            const t = parseFloat(jk.data?.price||0);
            if (t>1000) rj = { rate: Math.round(t*1.04) };
          }
        } catch(e) {}
      }
      if (rj && rj.rate) {
        rateUsed = rj.rate;
        const base = amount / rj.rate;
        // cents یونیک از 4 رقم آخر order id (1..99) تا هر سفارش قابل شناسایی باشه
        const cents = parseInt(orderId.replace(/-/g,'').slice(-4), 36) % 99 + 1;
        cryptoAmount = Math.floor(base) + cents/100;
      }
    } catch(e) {}
  }

  const existing = await q(env.DB, 'SELECT * FROM payments WHERE order_id=? AND payment_phase=? AND status!=?', [orderId, phase, 'rejected']);
  const verifiedExists = (existing.results||[]).some(p=>p.status==='verified');
  if (verifiedExists) return json({error:'این بخش قبلاً پرداخت شده'},409,corsHeaders(request));
  // also block duplicate pending for same phase
  const pendingExists = (existing.results||[]).some(p=>p.status==='pending');
  if (pendingExists) return json({error:'یک پرداخت در انتظار برای این بخش وجود دارد — منتظر تایید ادمین بمانید'},409,corsHeaders(request));
  if (phase==='remaining') {
    const dep = await q(env.DB, 'SELECT status FROM payments WHERE order_id=? AND payment_phase=? ORDER BY created_at DESC LIMIT 1', [orderId, 'deposit']);
    const depRow = dep.results?.[0];
    if (!depRow || depRow.status!=='verified') return json({error:'ابتدا بیعانه باید تایید شود'},400,corsHeaders(request));
  }

  const id = uuid();
  const now = nowSec();
  // همه pending — حتی کریپتو
  const status = 'pending';
  await exec(env.DB, 'INSERT INTO payments (id,order_id,user_id,method,amount,status,payment_phase,tx_hash,receipt_url,receipt_name,receipt_mime,receipt_data,crypto_asset,crypto_amount,rate_used,verified_by,verified_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, orderId, user.id, method, amount, status, phase, txHash||null, receiptUrl||null, receiptName||null, receiptMime||null, receiptData||null, asset, cryptoAmount, rateUsed, null, null, now]);

  if (order.status==='cart') await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['pending', now, orderId]);

  await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)',
    [uuid(), user.id, 'create_payment','payment',id, JSON.stringify({method, status, phase, amount}), now]);
  return json({ok:true, payment:{id, method, status, amount, payment_phase:phase, crypto_asset:asset, crypto_amount:cryptoAmount, rate_used:rateUsed}},200,corsHeaders(request));
}
export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشدهاید'},401,corsHeaders(request));
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order_id');
  if (!orderId) return json({error:'order_id الزامی است'},400,corsHeaders(request));
  const pays = await q(env.DB, 'SELECT * FROM payments WHERE order_id=? ORDER BY created_at DESC', [sanitize(orderId,64)]);
  return json({payments: pays.results||[]},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
