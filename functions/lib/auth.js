// Portable auth helpers - Web Crypto only (no deps)
const JWT_SECRET_FALLBACK = "phweb-dev-secret-change-me";

function b64urlEncode(bytes) {
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlDecode(str) {
  str = str.replace(/-/g,'+').replace(/_/g,'/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c=>c.charCodeAt(0));
}
function getSecret(env){ return env.JWT_SECRET || JWT_SECRET_FALLBACK; }

export async function hmacSign(data, secret){
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

export async function createJWT(payload, env, expSec= 60*60*24*7){
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({alg:"HS256",typ:"JWT"})));
  const now = Math.floor(Date.now()/1000);
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify({...payload, iat:now, exp: now+expSec})));
  const sig = await hmacSign(`${header}.${body}`, getSecret(env));
  return `${header}.${body}.${sig}`;
}
export async function verifyJWT(token, env){
  const parts = token.split(".");
  if(parts.length!==3) return null;
  const [h,b,sig] = parts;
  const expected = await hmacSign(`${h}.${b}`, getSecret(env));
  if(sig !== expected) return null;
  try{
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(b)));
    if(payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  }catch{ return null; }
}

export async function hashPassword(password){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = b64urlEncode(salt);
  // PBKDF2
  const keyMat = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", salt, iterations: 120000, hash:"SHA-256"}, keyMat, 256);
  const hashB64 = b64urlEncode(new Uint8Array(bits));
  return `${saltB64}$${hashB64}`;
}
export async function verifyPassword(password, stored){
  const [saltB64, hashB64] = stored.split("$");
  if(!saltB64||!hashB64) return false;
  const salt = b64urlDecode(saltB64);
  const keyMat = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", salt, iterations:120000, hash:"SHA-256"}, keyMat, 256);
  const check = b64urlEncode(new Uint8Array(bits));
  return check === hashB64;
}

export function json(data, status=200, headers={}){
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8', ...headers}});
}
export function corsHeaders(req){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
export async function getUserFromRequest(req, env){
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers.get('Cookie')||'').match(/token=([^;]+)/)?.[1];
  if(!token) return null;
  const payload = await verifyJWT(token, env);
  if(!payload) return null;
  const { q1 } = await import('./db.js');
  return q1(env.DB, 'SELECT id,email,name,role FROM users WHERE id=?', [payload.uid]);
}
export function sanitize(s, max=500){ return String(s||'').replace(/[\u0000-\u001F<>]/g,'').slice(0,max).trim(); }
