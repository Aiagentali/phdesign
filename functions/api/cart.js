import { getUserFromRequest, json, corsHeaders, sanitize } from '../lib/auth.js';
import { q, q1, exec, nowSec, uuid } from '../lib/db.js';

// DELETE order in cart (owner only)
export async function onRequestDelete({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشدهاید'},401,corsHeaders(request));
  const url = new URL(request.url);
  const id = sanitize(url.searchParams.get('id')||'',64);
  if (!id) return json({error:'id الزامی است'},400,corsHeaders(request));
  const order = await q1(env.DB, 'SELECT id,user_id,status FROM orders WHERE id=?', [id]);
  if (!order) return json({error:'یافت نشد'},404,corsHeaders(request));
  if (order.user_id!==user.id && user.role==='customer') return json({error:'دسترسی ندارید'},403,corsHeaders(request));
  if (order.status!=='cart') return json({error:'فقط سفارشهای سبد قابل حذف هستند'},400,corsHeaders(request));
  await exec(env.DB, 'DELETE FROM orders WHERE id=?', [id]);
  await exec(env.DB, 'DELETE FROM payments WHERE order_id=?', [id]);
  return json({ok:true},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
