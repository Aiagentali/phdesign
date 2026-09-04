import { getUserFromRequest, json, corsHeaders, sanitize } from '../../lib/auth.js';
import { q, q1, exec, nowSec, uuid } from '../../lib/db.js';

// Superadmin: admins CRUD + stats + settings
export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user || user.role!=='superadmin') return json({error:'دسترسی سوپرادمین'},403,corsHeaders(request));
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'stats';
  if (action==='admins') {
    const rows = (await q(env.DB, "SELECT id,name,email,role,created_at FROM users WHERE role IN ('admin','superadmin') ORDER BY created_at DESC")).results;
    return json({admins: rows},200,corsHeaders(request));
  }
  if (action==='settings') {
    const pricing = await q1(env.DB, 'SELECT value FROM settings WHERE key=?', ['pricing']);
    const payInfo = await q1(env.DB, 'SELECT value FROM settings WHERE key=?', ['payment_info']);
    return json({pricing: pricing?JSON.parse(pricing.value):null, payment_info: payInfo?JSON.parse(payInfo.value):null},200,corsHeaders(request));
  }
  if (action==='logs') {
    const rows = (await q(env.DB, 'SELECT l.*, u.name as actor_name FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_id ORDER BY l.created_at DESC LIMIT 100')).results;
    return json({logs: rows},200,corsHeaders(request));
  }
  // stats default
  const totalOrders = await q1(env.DB, 'SELECT COUNT(*) as c FROM orders');
  const totalUsers = await q1(env.DB, 'SELECT COUNT(*) as c FROM users WHERE role=?', ['customer']);
  const verifiedSum = await q1(env.DB, "SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='verified'");
  const pendingPays = await q1(env.DB, "SELECT COUNT(*) as c FROM payments WHERE status='pending'");
  const byStatus = (await q(env.DB, 'SELECT status, COUNT(*) as c FROM orders GROUP BY status')).results;
  return json({stats:{totalOrders: totalOrders.c, totalUsers: totalUsers.c, verifiedSum: verifiedSum.s, pendingPays: pendingPays.c, byStatus}},200,corsHeaders(request));
}

export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user || user.role!=='superadmin') return json({error:'دسترسی سوپرادمین'},403,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'نامعتبر'},400,corsHeaders(request)); }
  const action = sanitize(body.action,20);
  if (action==='create_admin') {
    const email = sanitize(body.email,100).toLowerCase();
    const name = sanitize(body.name,60);
    const password = String(body.password||'');
    if (!email||!name||!password) return json({error:'فیلدها ناقص'},400,corsHeaders(request));
    const { hashPassword } = await import('../../lib/auth.js');
    const hash = await hashPassword(password);
    const id = uuid();
    try {
      await exec(env.DB, 'INSERT INTO users (id,email,phone,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?,?)', [id,email,'',name,hash,'admin', nowSec()]);
    } catch { return json({error:'ایمیل تکراری'},409,corsHeaders(request)); }
    await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,created_at) VALUES (?,?,?,?,?,?)', [uuid(), user.id, 'create_admin','user',id, nowSec()]);
    return json({ok:true, id},200,corsHeaders(request));
  }
  if (action==='update_settings') {
    const key = sanitize(body.key,30);
    let value = body.value;
    if (!['pricing','payment_info'].includes(key)) return json({error:'کلید نامعتبر'},400,corsHeaders(request));
    // value should be object
    if (typeof value !== 'object') return json({error:'مقدار باید JSON باشد'},400,corsHeaders(request));
    await exec(env.DB, 'INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at', [key, JSON.stringify(value), nowSec()]);
    await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)', [uuid(), user.id, 'update_settings','settings',key, JSON.stringify({key}), nowSec()]);
    return json({ok:true},200,corsHeaders(request));
  }
  if (action==='delete_admin') {
    const id = sanitize(body.id,64);
    await exec(env.DB, "DELETE FROM users WHERE id=? AND role='admin'", [id]);
    return json({ok:true},200,corsHeaders(request));
  }
  return json({error:'اکشن نامعتبر'},400,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
