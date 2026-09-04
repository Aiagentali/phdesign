import { hashPassword, json, corsHeaders, sanitize } from '../lib/auth.js';
import { q1, exec, nowSec } from '../lib/db.js';

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
  let body; try { body = await request.json(); } catch { return json({error:'درخواست نامعتبر'},400,corsHeaders(request)); }
  const token = sanitize(body.token,64);
  const password = String(body.password||'');
  if (!token || !password) return json({error:'توکن و رمز جدید الزامی است'},400,corsHeaders(request));
  if (password.length < 6) return json({error:'رمز حداقل ۶ کاراکتر'},400,corsHeaders(request));
  const user = await q1(env.DB, 'SELECT id, reset_expires FROM users WHERE reset_token=?', [token]);
  if (!user) return json({error:'توکن نامعتبر'},400,corsHeaders(request));
  if (user.reset_expires < nowSec()) return json({error:'توکن منقضی شده'},400,corsHeaders(request));
  const hash = await hashPassword(password);
  await exec(env.DB, 'UPDATE users SET password_hash=?, reset_token=NULL, reset_expires=NULL WHERE id=?', [hash, user.id]);
  return json({ok:true, message:'رمز با موفقیت تغییر کرد'},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
