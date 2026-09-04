import { getUserFromRequest, json, corsHeaders, sanitize } from '../../lib/auth.js';
import { q1, q, exec, nowSec, uuid } from '../../lib/db.js';

// POST /api/payments - create payment (crypto auto-verified, card pending)
export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشده‌اید'},401,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'درخواست نامعتبر'},400,corsHeaders(request)); }
  const orderId = sanitize(body.order_id,64);
  const method = sanitize(body.method,10); // crypto | card
  const amount = parseInt(body.amount)||0;
  const txHash = sanitize(body.tx_hash,120);
  const receiptUrl = sanitize(body.receipt_url,500);

  if (!orderId || !['crypto','card'].includes(method)) return json({error:'پارامتر نامعتبر'},400,corsHeaders(request));
  const order = await q1(env.DB, 'SELECT id,user_id,total_price FROM orders WHERE id=?', [orderId]);
  if (!order) return json({error:'سفارش یافت نشد'},404,corsHeaders(request));
  if (order.user_id !== user.id && user.role==='customer') return json({error:'دسترسی ندارید'},403,corsHeaders(request));

  const isCrypto = method==='crypto';
  const status = isCrypto ? 'verified' : 'pending'; // crypto auto
  const id = uuid();
  const now = nowSec();
  await exec(env.DB, 'INSERT INTO payments (id,order_id,user_id,method,amount,status,tx_hash,receipt_url,verified_by,verified_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, orderId, user.id, method, amount||order.total_price, status, txHash||null, receiptUrl||null, isCrypto?user.id:null, isCrypto?now:null, now]);

  if (isCrypto) {
    // Optionally auto-move order to reviewing
    await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['reviewing', now, orderId]);
  }
  await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)',
    [uuid(), user.id, 'create_payment','payment',id, JSON.stringify({method, status}), now]);

  return json({ok:true, payment:{id, method, status, amount: amount||order.total_price}},200,corsHeaders(request));
}

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشده‌اید'},401,corsHeaders(request));
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order_id');
  if (!orderId) return json({error:'order_id الزامی است'},400,corsHeaders(request));
  const pays = await q(env.DB, 'SELECT * FROM payments WHERE order_id=? ORDER BY created_at DESC', [sanitize(orderId,64)]);
  return json({payments: pays.results||[]},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
