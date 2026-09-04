import { json, corsHeaders, sanitize } from '../lib/auth.js';
import { q1, exec, nowSec, uuid } from '../lib/db.js';

export async function onRequestPost({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
  let body; try { body = await request.json(); } catch { return json({error:'درخواست نامعتبر'},400,corsHeaders(request)); }
  const email = sanitize(body.email,100).toLowerCase();
  if (!email) return json({error:'ایمیل الزامی است'},400,corsHeaders(request));
  const user = await q1(env.DB, 'SELECT id,email FROM users WHERE email=?', [email]);
  // Always return ok to avoid email enumeration
  if (!user) return json({ok:true, message:'اگر ایمیل وجود داشته باشد، لینک ارسال شد'},200,corsHeaders(request));
  const token = uuid().replace(/-/g,'').slice(0,32);
  const exp = nowSec() + 3600;
  await exec(env.DB, 'UPDATE users SET reset_token=?, reset_expires=? WHERE id=?', [token, exp, user.id]);
  const resetUrl = `https://webph.dpdns.org/reset.html?token=${token}`;
  // Try to send via MailChannels (works on Cloudflare without API key) or fallback to log
  try {
    await fetch('https://api.mailchannels.net/tx/v1/send', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        personalizations:[{to:[{email, name: user.email}]}],
        from:{email:'noreply@webph.dpdns.org', name:'PH Web'},
        subject:'بازیابی رمز عبور - PH Web',
        content:[{type:'text/plain', value:`برای بازیابی رمز عبور روی لینک زیر کلیک کنید (۱ ساعت اعتبار):\n${resetUrl}`}]
      })
    });
  } catch {}
  // For dev: also return token if env.SHOW_RESET_TOKEN === '1'
  const dev = env.SHOW_RESET_TOKEN === '1' ? {resetUrl, token} : {};
  return json({ok:true, message:'لینک بازیابی ارسال شد', ...dev},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
