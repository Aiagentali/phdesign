import { getUserFromRequest, json, corsHeaders } from '../lib/auth.js';
export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشده‌اید'},401,corsHeaders(request));
  return json({user},200,corsHeaders(request));
}
export async function onRequestOptions({ request }) { return new Response(null,{headers:corsHeaders(request)}); }
