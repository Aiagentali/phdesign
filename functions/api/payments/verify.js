import { getUserFromRequest, json, corsHeaders, sanitize } from '../../lib/auth.js';
import { q, q1, exec, nowSec, uuid } from '../../lib/db.js';

// GET /api/payments/verify?payment_id=xxx
// تایید خودکار آنچین: تراکنش TRC20 USDT را در بلاکچین Tron جستجو میکند
// شروط: recipient = آدرس USDT_TRC20 فروشگاه، مبلغ >= crypto_amount، تازگی (< 48h)
const TRONGRID = 'https://api.trongrid.io';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return json({error:'وارد نشدهاید'},401,corsHeaders(request));
  const url = new URL(request.url);
  const pid = sanitize(url.searchParams.get('payment_id')||'',64);
  if (!pid) return json({error:'payment_id الزامی است'},400,corsHeaders(request));
  const pr = await q1(env.DB, 'SELECT * FROM payments WHERE id=? AND user_id=?', [pid, user.id]);
  const p = pr;
  if (!p) return json({error:'پرداخت یافت نشد'},404,corsHeaders(request));
  if (p.method!=='crypto') return json({error:'این پرداخت کریپتو نیست'},400,corsHeaders(request));
  if (p.status==='verified') return json({ok:true, status:'verified', already:true},200,corsHeaders(request));
  if (p.status==='rejected') return json({error:'این پرداخت رد شده — با پشتیبانی تماس بگیرید'},400,corsHeaders(request));
  if (!p.crypto_amount) return json({error:'مبلغ کریپتو قفل نشده'},400,corsHeaders(request));

  // payment_info
  const srow = await q1(env.DB, 'SELECT value FROM settings WHERE key=?', ['payment_info']);
  let info = {}; try { info = JSON.parse(srow.value); } catch {}
  const addr = info.crypto_addresses?.USDT_TRC20;
  if (!addr || addr.startsWith('TXXXX')) return json({error:'آدرس USDT تنظیم نشده'},400,corsHeaders(request));

  try {
    // 1) اگر tx_hash ثبت شده: مستقیم چک کن
    if (p.tx_hash) {
      const r = await checkTx(env, p.tx_hash, addr, p.crypto_amount);
      if (r.ok) return finishVerify(env, p, r, request);
      return json({ok:false, status:'pending', message:'تراکنش هنوز دیده نشد — چند دقیقه دیگر دوباره بررسی کنید', detail:r.message},200,corsHeaders(request));
    }
    // 2) جستجو در آخرین تراکنشهای آدرس
    const r = await scanRecent(env, addr, p.crypto_amount, p.created_at);
    if (r.ok) return finishVerify(env, p, r, request);
    return json({ok:false, status:'pending', message:'واریزی با این مبلغ هنوز ثبت نشده — بعد از ارسال تراکنش دوباره بزنید', detail:r.message},200,corsHeaders(request));
  } catch(e) {
    return json({ok:false, status:'error', message:'خطا در اتصال به بلاکچین — بعدا تلاش کنید', detail:e.message},200,corsHeaders(request));
  }
}

async function checkTx(env, txHash, addr, needAmount) {
  const r = await fetch(`${TRONGRID}/v1/accounts/${addr}/transactions/trc20?limit=50&only_to=true&search_internal=false`, { headers: { 'accept': 'application/json' } });
  if (!r.ok) return { ok:false, message:'trongrid:'+r.status };
  const j = await r.json();
  const txs = j.data||[];
  for (const t of txs) {
    if (t.transaction_id !== txHash) continue;
    if ((t.token_info?.address||'') !== 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t') continue;
    const amt = Number(t.value)/1e6;
    if (amt + 0.02 >= needAmount) return { ok:true, tx_hash:txHash };
    return { ok:false, message:`مبلغ تراکنش ${amt} است ولی ${needAmount} لازم است` };
  }
  return { ok:false, message:'تراکنش در واریزهای اخیر آدرس پیدا نشد' };
}

async function scanRecent(env, addr, needAmount, afterTs) {
  // آخرین transfer های USDT از/به آدرس فروشگاه
  const since = Math.max(0, (afterTs - 3600) * 1000);
  const r = await fetch(`${TRONGRID}/v1/accounts/${addr}/transactions/trc20?limit=50&only_to=true&min_timestamp=${since}`, { headers: { 'accept': 'application/json' } });
  if (!r.ok) return { ok:false, message:'trongrid:'+r.status };
  const j = await r.json();
  const txs = j.data||[];
  for (const t of txs) {
    if ((t.token_info?.address||'') !== 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t') continue;
    const amt = Number(t.value)/1e6;
    if (Math.abs(amt - needAmount) < 0.021) {
      return { ok:true, tx_hash: t.transaction_id };
    }
  }
  return { ok:false, message:`آخرین ۵۰ واریز بررسی شد — مبلغ ${needAmount} یافت نشد (میزان واریز دقیق مهم است)` };
}

async function finishVerify(env, p, r, request) {
  const now = nowSec();
  await exec(env.DB, 'UPDATE payments SET status=?, tx_hash=?, verified_at=? WHERE id=?', ['pending_admin', r.tx_hash||p.tx_hash, now, p.id]);
  // auto-verify: مستقیم verified میکنیم چون بلاکچین گواهی میدهد
  await exec(env.DB, 'UPDATE payments SET status=?, verified_at=? WHERE id=?', ['verified', now, p.id]);
  // order status
  const sums = await q(env.DB, 'SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE order_id=? AND status=?', [p.order_id, 'verified']);
  const verifiedSum = sums.results?.[0]?.s || 0;
  const o = await q1(env.DB, 'SELECT total_price FROM orders WHERE id=?', [p.order_id]);
  if (o) {
    if (verifiedSum >= o.total_price) await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['completed', now, p.order_id]);
    else await exec(env.DB, 'UPDATE orders SET status=?, updated_at=? WHERE id=?', ['reviewing', now, p.order_id]);
  }
  await exec(env.DB, 'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)',
    [uuid(), p.user_id, 'auto_verify_onchain','payment',p.id, JSON.stringify({tx:r.tx_hash, amount:p.crypto_amount}), now]);
  return json({ok:true, status:'verified', tx_hash:r.tx_hash},200,corsHeaders(request));
}
