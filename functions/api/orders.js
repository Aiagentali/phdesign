import { getUserFromRequest, json, corsHeaders, sanitize } from '../lib/auth.js';
import { q, q1, exec, nowSec, uuid } from '../lib/db.js';

// GET list my orders, POST create (now goes to cart)
export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشدهاید'},401,corsHeaders(request));
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const rows = isAdmin
    ? (await q(env.DB, 'SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC')).results
    : (await q(env.DB, 'SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC', [user.id])).results;
  for (const o of rows) {
    const pays = await q(env.DB, 'SELECT * FROM payments WHERE order_id=? ORDER BY created_at DESC', [o.id]);
    o.payments = pays.results || [];
    try { o.addons = JSON.parse(o.addons_json||'[]'); } catch { o.addons=[]; }
    // compute paid/remaining
    const verifiedSum = (o.payments||[]).filter(p=>p.status==='verified').reduce((s,p)=>s+p.amount,0);
    o.paid_verified = verifiedSum;
    o.remaining = Math.max(0, o.total_price - verifiedSum);
    o.pay_progress = o.total_price ? Math.round(verifiedSum/o.total_price*100) : 0;
  }
  return json({orders: rows},200,corsHeaders(request));
}

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشدهاید - لطفاً وارد شوید'},401,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'درخواست نامعتبر'},400,corsHeaders(request)); }
  const type = sanitize(body.type,20);
  const addons = Array.isArray(body.addons) ? body.addons : [];
  const note = sanitize(body.note,500);
  if (!type) return json({error:'نوع سایت الزامی است'},400,corsHeaders(request));
  const pricingRow = await q1(env.DB, 'SELECT value FROM settings WHERE key=?', ['pricing']);
  let pricing = {};
  try { pricing = JSON.parse(pricingRow.value); } catch {}
  const typeInfo = pricing.types?.[type];
  if (!typeInfo) return json({error:'نوع سایت نامعتبر'},400,corsHeaders(request));
  let addonsPrice=0, addonsDays=0;
  const validAddons=[];
  for (const a of addons) {
    const info = pricing.addons?.[a];
    if (info) { addonsPrice+=info.price; addonsDays+=info.days; validAddons.push({id:a, ...info}); }
  }
  const total = typeInfo.price + addonsPrice;
  const days = typeInfo.days + addonsDays;
  const id = uuid();
  const now = nowSec();
  // New: goes to cart
  await exec(env.DB, 'INSERT INTO orders (id,user_id,type,type_name,base_price,addons_json,addons_price,total_price,days,status,customer_note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, user.id, type, typeInfo.name, typeInfo.price, JSON.stringify(validAddons), addonsPrice, total, days, 'cart', note, now, now]);
  await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)',
    [uuid(), user.id, 'add_to_cart','order',id, JSON.stringify({type,total}), now]);
  return json({ok:true, order:{id, type, type_name:typeInfo.name, total_price:total, days, status:'cart'}},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
