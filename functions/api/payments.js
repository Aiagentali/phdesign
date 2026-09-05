import { getUserFromRequest, json, corsHeaders, sanitize } from '../lib/auth.js';
import { q1, q, exec, nowSec, uuid } from '../lib/db.js';

// POST: crypto/card with payment_phase=deposit|remaining|full
export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشدهاید'},401,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'درخواست نامعتبر'},400,corsHeaders(request)); }
  const orderId = sanitize(body.order_id,64);
  const method = sanitize(body.method,10);
  const phase = sanitize(body.payment_phase||body.phase||'full',10); // deposit|remaining|full
  const txHash = sanitize(body.tx_hash,120);
  const receiptUrl = sanitize(body.receipt_url,500);
  if (!orderId || !['crypto','card'].includes(method)) return json({error:'پارامتر نامعتبر'},400,corsHeaders(request));
  if (!['deposit','remaining','full'].includes(phase)) return json({error:'نوع پرداخت نامعتبر'},400,corsHeaders(request));
  const order = await q1(env.DB, 'SELECT id,user_id,total_price,status FROM orders WHERE id=?', [orderId]);
  if (!order) return json({error:'سفارش یافت نشد'},404,corsHeaders(request));
  if (order.user_id !== user.id && user.role==='customer') return json({error:'دسترسی ندارید'},403,corsHeaders(request));

  // Load payment_terms to compute deposit amount
  let terms = {deposit_percent:50};
  try { const r=await q1(env.DB,'SELECT value FROM settings WHERE key=?',['payment_terms']); if(r) terms=JSON.parse(r.value); } catch {}
  const depositPercent = Math.min(90, Math.max(10, parseInt(terms.deposit_percent)||50));
  const depositAmount = Math.round(order.total_price * depositPercent / 100);
  const remainingAmount = order.total_price - depositAmount;

  // Determine amount based on phase
  let amount = 0;
  if (phase==='deposit') amount = depositAmount;
  else if (phase==='remaining') amount = remainingAmount;
  else amount = order.total_price;

  // Check existing verified payments for this phase
  const existing = await q(env.DB, 'SELECT * FROM payments WHERE order_id=? AND payment_phase=? AND status!=?', [orderId, phase, 'rejected']);
  const verifiedExists = (existing.results||[]).some(p=>p.status==='verified');
  if (verifiedExists) return json({error:'این بخش قبلاً پرداخت شده'},409,corsHeaders(request));
  // For remaining, require deposit verified
  if (phase==='remaining') {
    const dep = await q(env.DB, 'SELECT status FROM payments WHERE order_id=? AND payment_phase=? ORDER BY created_at DESC LIMIT 1', [orderId, 'deposit']);
    const depRow = dep.results?.[0];
    if (!depRow || depRow.status!=='verified') return json({error:'ابتدا بیعانه را پرداخت کنید'},400,corsHeaders(request));
  }

  const isCrypto = method==='crypto';
  const status = isCrypto ? 'verified' : 'pending';
  const id = uuid();
  const now = nowSec();
  await exec(env.DB, 'INSERT INTO payments (id,order_id,user_id,method,amount,status,payment_phase,tx_hash,receipt_url,verified_by,verified_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, orderId, user.id, method, amount, status, phase, txHash||null, receiptUrl||null, isCrypto?user.id:null, isCrypto?now:null, now]);

  // Update order status
  if (isCrypto) {
    if (phase==='full') await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['reviewing', now, orderId]);
    else if (phase==='deposit') await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['reviewing', now, orderId]);
    else if (phase==='remaining') {
      // Check if total verified >= total
      const sums = await q(env.DB, 'SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE order_id=? AND status=?', [orderId, 'verified']);
      const verifiedSum = sums.results?.[0]?.s || 0;
      if (verifiedSum >= order.total_price) await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['completed', now, orderId]);
    }
  } else {
    // card pending: move cart -> pending if first payment attempt
    if (order.status==='cart') await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['pending', now, orderId]);
  }
  // If order was cart and payment created, move to pending (awaiting verification)
  if (order.status==='cart' && !isCrypto) {
    // already handled
  }

  await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)',
    [uuid(), user.id, 'create_payment','payment',id, JSON.stringify({method, status, phase, amount}), now]);
  return json({ok:true, payment:{id, method, status, amount, payment_phase:phase}},200,corsHeaders(request));
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
