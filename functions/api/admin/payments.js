import { getUserFromRequest, json, corsHeaders, sanitize } from '../../lib/auth.js';
import { q, exec, nowSec, uuid } from '../../lib/db.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user || !['admin','superadmin'].includes(user.role)) return json({error:'دسترسی ادمین'},403,corsHeaders(request));
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  let sql = 'SELECT p.*, o.type_name, u.name as user_name FROM payments p JOIN orders o ON o.id=p.order_id JOIN users u ON u.id=p.user_id';
  let params=[];
  if (status && ['pending','verified','rejected'].includes(status)) { sql+=' WHERE p.status=?'; params=[status]; }
  sql+=' ORDER BY p.created_at DESC';
  const rows = (await q(env.DB, sql, params)).results;
  return json({payments: rows},200,corsHeaders(request));
}
export async function onRequestPut({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user || !['admin','superadmin'].includes(user.role)) return json({error:'دسترسی ادمین'},403,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'نامعتبر'},400,corsHeaders(request)); }
  const id = sanitize(body.id,64);
  const action = sanitize(body.action,10); // verify | reject
  if (!id || !['verify','reject'].includes(action)) return json({error:'اکشن نامعتبر'},400,corsHeaders(request));
  const status = action==='verify' ? 'verified' : 'rejected';
  await exec(env.DB, 'UPDATE payments SET status=?, verified_by=?, verified_at=? WHERE id=?', [status, user.id, nowSec(), id]);
  await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)', [uuid(), user.id, action+'_payment','payment',id, JSON.stringify({status}), nowSec()]);
  return json({ok:true, status},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
