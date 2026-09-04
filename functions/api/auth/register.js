import { hashPassword, verifyPassword, createJWT, json, corsHeaders, sanitize } from '../lib/auth.js';
import { q1, exec, nowSec, uuid } from '../lib/db.js';

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
  let body;
  try { body = await request.json(); } catch { return json({error:'درخواست نامعتبر'},400,corsHeaders(request)); }
  const name = sanitize(body.name, 60);
  const email = sanitize(body.email, 100).toLowerCase();
  const phone = sanitize(body.phone, 20);
  const password = String(body.password||'');

  if (!name || !email || !password) return json({error:'نام، ایمیل و رمز الزامی است'},400,corsHeaders(request));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'ایمیل نامعتبر'},400,corsHeaders(request));
  if (password.length < 6) return json({error:'رمز حداقل ۶ کاراکتر'},400,corsHeaders(request));

  const exists = await q1(env.DB, 'SELECT id FROM users WHERE email=?', [email]);
  if (exists) return json({error:'این ایمیل قبلاً ثبت شده'},409,corsHeaders(request));

  const id = uuid();
  const hash = await hashPassword(password);
  // First user with superadmin email gets superadmin role
  const role = (email === 'a.pourhoseini1384@gmail.com') ? 'superadmin' : 'customer';
  await exec(env.DB, 'INSERT INTO users (id,email,phone,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?,?)', [id,email,phone,name,hash,role,nowSec()]);
  await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,created_at) VALUES (?,?,?,?,?,?)', [uuid(), id, 'register', 'user', id, nowSec()]);

  const token = await createJWT({uid:id, role, email}, env);
  return json({ok:true, token, user:{id,email,name,role}},200, {...corsHeaders(request), 'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`});
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
