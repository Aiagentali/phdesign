import { json, corsHeaders } from '../lib/auth.js';
import { q1 } from '../lib/db.js';

export async function onRequestGet({ request, env }) {
  try {
    const pricing = await q1(env.DB, 'SELECT value FROM settings WHERE key=?', ['pricing']);
    const payInfo = await q1(env.DB, 'SELECT value FROM settings WHERE key=?', ['payment_info']);
    const terms = await q1(env.DB, 'SELECT value FROM settings WHERE key=?', ['payment_terms']);
    return json({
      pricing: pricing ? JSON.parse(pricing.value) : null,
      payment_info: payInfo ? JSON.parse(payInfo.value) : null,
      payment_terms: terms ? JSON.parse(terms.value) : {deposit_percent:50,allow_deposit:true,allow_full:true}
    }, 200, corsHeaders(request));
  } catch(e){
    return json({error:'خطای سرور'},500,corsHeaders(request));
  }
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
