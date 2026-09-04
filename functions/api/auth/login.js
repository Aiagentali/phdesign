import { verifyPassword, createJWT, json, corsHeaders, sanitize } from '../../lib/auth.js';
import { q1 } from '../../lib/db.js';

export async function onRequestPost({ request, env }) {
  try {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
    let body; try { body = await request.json(); } catch { return json({error:'درخواست نامعتبر'},400,corsHeaders(request)); }
    const email = sanitize(body.email,100).toLowerCase();
    const password = String(body.password||'');
    if (!email || !password) return json({error:'ایمیل و رمز الزامی است'},400,corsHeaders(request));
    const user = await q1(env.DB, 'SELECT id,email,name,role,password_hash FROM users WHERE email=?', [email]);
    if (!user) return json({error:'ایمیل یا رمز اشتباه است'},401,corsHeaders(request));
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return json({error:'ایمیل یا رمز اشتباه است'},401,corsHeaders(request));
    const token = await createJWT({uid:user.id, role:user.role, email:user.email}, env);
    return json({ok:true, token, user:{id:user.id,email:user.email,name:user.name,role:user.role}},200,{...corsHeaders(request),'Set-Cookie':`token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`});
  } catch(e){
    return json({error:'خطای سرور: '+(e.message||String(e)), stack:String(e.stack||'').slice(0,800)},500,corsHeaders(request));
  }
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
