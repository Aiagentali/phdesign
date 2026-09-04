export async function onRequestGet({ request, env }) {
  return new Response(JSON.stringify({ok:true, hasDB: !!env.DB, time: Date.now()}), {headers:{'Content-Type':'application/json'}});
}
