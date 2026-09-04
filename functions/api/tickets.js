import { getUserFromRequest, json, corsHeaders, sanitize } from '../lib/auth.js';
import { q, q1, exec, nowSec, uuid } from '../lib/db.js';

// GET list my tickets, POST create ticket
export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشده‌اید'},401,corsHeaders(request));
  const isAdmin = ['admin','superadmin'].includes(user.role);
  const rows = isAdmin
    ? (await q(env.DB, 'SELECT t.*, u.name as user_name FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY t.updated_at DESC')).results
    : (await q(env.DB, 'SELECT * FROM tickets WHERE user_id=? ORDER BY updated_at DESC', [user.id])).results;
  for (const t of rows) {
    const msgs = await q(env.DB, 'SELECT m.*, u.name as sender_name FROM ticket_messages m JOIN users u ON u.id=m.sender_id WHERE ticket_id=? ORDER BY created_at ASC', [t.id]);
    t.messages = msgs.results||[];
  }
  return json({tickets: rows},200,corsHeaders(request));
}
export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشده‌اید'},401,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'نامعتبر'},400,corsHeaders(request)); }
  const subject = sanitize(body.subject,120);
  const message = sanitize(body.message,2000);
  const orderId = body.order_id ? sanitize(body.order_id,64) : null;
  if (!subject || !message) return json({error:'موضوع و پیام الزامی است'},400,corsHeaders(request));
  const tid = uuid();
  const now = nowSec();
  await exec(env.DB, 'INSERT INTO tickets (id,user_id,order_id,subject,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', [tid, user.id, orderId, subject, 'open', now, now]);
  await exec(env.DB, 'INSERT INTO ticket_messages (id,ticket_id,sender_id,sender_role,body,created_at) VALUES (?,?,?,?,?,?)', [uuid(), tid, user.id, user.role, message, now]);
  return json({ok:true, ticket:{id:tid, subject, status:'open'}},200,corsHeaders(request));
}
export async function onRequestPut({ request, env }) {
  // Add message to ticket: {ticket_id, message}
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشده‌اید'},401,corsHeaders(request));
  let body; try { body = await request.json(); } catch { return json({error:'نامعتبر'},400,corsHeaders(request)); }
  const tid = sanitize(body.ticket_id,64);
  const msg = sanitize(body.message,2000);
  if (!tid || !msg) return json({error:'پارامتر نامعتبر'},400,corsHeaders(request));
  const ticket = await q1(env.DB, 'SELECT * FROM tickets WHERE id=?', [tid]);
  if (!ticket) return json({error:'تیکت یافت نشد'},404,corsHeaders(request));
  const isAdmin = ['admin','superadmin'].includes(user.role);
  if (ticket.user_id !== user.id && !isAdmin) return json({error:'دسترسی ندارید'},403,corsHeaders(request));
  await exec(env.DB, 'INSERT INTO ticket_messages (id,ticket_id,sender_id,sender_role,body,created_at) VALUES (?,?,?,?,?,?)', [uuid(), tid, user.id, user.role, msg, nowSec()]);
  await exec(env.DB, 'UPDATE tickets SET status=?, updated_at=? WHERE id=?', [isAdmin?'answered':'open', nowSec(), tid]);
  return json({ok:true},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
