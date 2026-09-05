import { getUserFromRequest, json, corsHeaders, sanitize } from '../../lib/auth.js';
import { q, exec, nowSec, uuid } from '../../lib/db.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشدهاید'},401,corsHeaders(request));
  if (user.role!=='admin' && user.role!=='superadmin') return json({error:'دسترسی ندارید'},403,corsHeaders(request));
  const pays = await q(env.DB, 'SELECT p.*, o.type_name, o.total_price, u.name as user_name FROM payments p JOIN orders o ON o.id=p.order_id JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 100');
  return json({payments: pays.results||[]},200,corsHeaders(request));
}
export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشدهاید'},401,corsHeaders(request));
  if (user.role!=='admin' && user.role!=='superadmin') return json({error:'دسترسی ندارید'},403,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'نامعتبر'},400,corsHeaders(request)); }
  const id = sanitize(body.id,64);
  const action = sanitize(body.action,10); // verify | reject
  if (!id || !['verify','reject'].includes(action)) return json({error:'پارامتر نامعتبر'},400,corsHeaders(request));
  const pay = await q(env.DB, 'SELECT * FROM payments WHERE id=?', [id]);
  const p = pay.results?.[0];
  if (!p) return json({error:'یافت نشد'},404,corsHeaders(request));
  if (p.status!=='pending') return json({error:'قبلاً بررسی شده'},409,corsHeaders(request));
  const now = nowSec();
  const newStatus = action==='verify' ? 'verified' : 'rejected';
  await exec(env.DB, 'UPDATE payments SET status=?, verified_by=?, verified_at=? WHERE id=?', [newStatus, user.id, now, id]);
  // Update order status logic
  if (newStatus==='verified') {
    const order = await q(env.DB, 'SELECT total_price FROM orders WHERE id=?', [p.order_id]);
    const o = order.results?.[0];
    if (o) {
      const sums = await q(env.DB, 'SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE order_id=? AND status=?', [p.order_id, 'verified']);
      const verifiedSum = sums.results?.[0]?.s || 0;
      if (verifiedSum >= o.total_price) await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['completed', now, p.order_id]);
      else if (p.payment_phase==='deposit' || verifiedSum>0) await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['reviewing', now, p.order_id]);
    }
  }
  await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)', [uuid(), user.id, action+'_payment','payment',id, JSON.stringify({payment_phase:p.payment_phase}), now]);
  return json({ok:true, status:newStatus},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
