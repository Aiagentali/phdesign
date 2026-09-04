import { getUserFromRequest, json, corsHeaders, sanitize } from '../../lib/auth.js';
import { q, exec, nowSec, uuid } from '../../lib/db.js';

// Admin: list all orders, update status
export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user || !['admin','superadmin'].includes(user.role)) return json({error:'دسترسی ادمین لازم است'},403,corsHeaders(request));
  const rows = (await q(env.DB, 'SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.updated_at DESC')).results;
  for (const o of rows) { const pays = await q(env.DB, 'SELECT * FROM payments WHERE order_id=? ORDER BY created_at DESC', [o.id]); o.payments = pays.results||[]; }
  return json({orders: rows},200,corsHeaders(request));
}
export async function onRequestPut({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user || !['admin','superadmin'].includes(user.role)) return json({error:'دسترسی ادمین'},403,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'نامعتبر'},400,corsHeaders(request)); }
  const id = sanitize(body.id,64);
  const status = sanitize(body.status,20);
  const adminNote = sanitize(body.admin_note,500);
  const allowed = ['pending','reviewing','in_progress','delivered','completed','cancelled'];
  if (!id || !allowed.includes(status)) return json({error:'وضعیت نامعتبر'},400,corsHeaders(request));
  await exec(env.DB, 'UPDATE orders SET status=?, admin_note=?, updated_at=? WHERE id=?', [status, adminNote||null, nowSec(), id]);
  await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)', [uuid(), user.id, 'update_order', 'order', id, JSON.stringify({status}), nowSec()]);
  return json({ok:true},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
