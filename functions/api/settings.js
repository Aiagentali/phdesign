import { json, corsHeaders } from '../lib/auth.js';
import { q1 } from '../lib/db.js';

export async function onRequestGet({ request, env }) {
  try {
    // Public-ish: pricing and payment_info - no auth required for payment info (needed for shop & panel)
    // But require at least valid token for pricing? For now allow public
    const pricing = await q1(env.DB, 'SELECT value FROM settings WHERE key=?', ['pricing']);
    const payInfo = await q1(env.DB, 'SELECT value FROM settings WHERE key=?', ['payment_info']);
    return json({
      pricing: pricing ? JSON.parse(pricing.value) : null,
      payment_info: payInfo ? JSON.parse(payInfo.value) : null
    }, 200, corsHeaders(request));
  } catch(e){
    return json({error:'خطای سرور'},500,corsHeaders(request));
  }
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
