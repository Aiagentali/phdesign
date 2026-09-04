// PH Design — main.js (redesign v2)

// Theme
const html = document.documentElement;
const tg = document.getElementById('themeToggle');
(function(){ let t = 'dark'; try { t = localStorage.getItem('ph-theme') || 'dark'; } catch(e) {} html.setAttribute('data-theme', t); })();
if (tg) tg.addEventListener('click', () => {
  const c = html.getAttribute('data-theme');
  const n = c === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', n);
  try { localStorage.setItem('ph-theme', n); } catch(e) {}
});

// Mobile nav
const burger = document.getElementById('navBurger');
const links = document.getElementById('navLinks');
if (burger && links) {
  burger.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}

// Nav scroll
const nav = document.getElementById('nav');
if (nav) window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

// Reveal on scroll
const obs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('v'); obs.unobserve(e.target); }
}), { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// Skill bars
const sbs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) {
    const w = e.target.getAttribute('data-w');
    if (w) e.target.style.width = w + '%';
    else e.target.style.width = '90%';
    sbs.unobserve(e.target);
  }
}), { threshold: 0.4 });
document.querySelectorAll('.skill-fill').forEach(b => sbs.observe(b));


// ---- Header auth: login/register <-> avatar ----
(function(){
  const token = (()=>{ try{ return localStorage.getItem('token'); }catch(e){ return null; } })();
  const authWrap = document.getElementById('navAuth');
  if(!authWrap) return;
  function guestUI(){
    authWrap.innerHTML = '<a href="login.html" class="nav-auth-btn primary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> ورود / ثبت‌نام</a>';
  }
  function userUI(role){
    let panelHref='panel.html';
    if(role==='admin') panelHref='admin.html';
    if(role==='superadmin') panelHref='superadmin.html';
    const name = (()=>{ try{ return JSON.parse(localStorage.getItem('user')||'{}').name||''; }catch(e){return '';} })();
    authWrap.innerHTML = '<div style="position:relative"><a href="'+panelHref+'" class="nav-avatar" id="navAvatar" title="'+(name||'پنل من')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg></a><div class="nav-avatar-menu" id="navAvatarMenu"><a href="'+panelHref+'">📦 پنل من</a><a href="#" id="navLogout2">🚪 خروج</a></div></div>';
    const av=document.getElementById('navAvatar');
    const menu=document.getElementById('navAvatarMenu');
    if(av && menu){
      let open=false;
      av.addEventListener('click', (e)=>{
        // on mobile, toggle menu instead of direct nav
        if(window.innerWidth<900){
          e.preventDefault(); open=!open; menu.classList.toggle('open', open);
        }
      });
      document.addEventListener('click', (e)=>{
        if(!authWrap.contains(e.target)){ menu.classList.remove('open'); open=false; }
      });
    }
    const lo=document.getElementById('navLogout2');
    if(lo) lo.addEventListener('click', (e)=>{ e.preventDefault(); try{ localStorage.removeItem('token'); localStorage.removeItem('user'); }catch(e){} location.reload(); });
  }
  if(!token){ guestUI(); return; }
  // verify token is still valid (silent)
  let role=null;
  try{ const u=JSON.parse(localStorage.getItem('user')||'null'); if(u && u.role) role=u.role; }catch(e){}
  if(role){ userUI(role); }
  // background verify
  fetch('/api/auth/me', {headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(j=>{
    if(j && j.user){ try{ localStorage.setItem('user', JSON.stringify(j.user)); }catch(e){} userUI(j.user.role); }
    else { localStorage.removeItem('token'); localStorage.removeItem('user'); guestUI(); }
  }).catch(()=>{ if(role) userUI(role); else guestUI(); });
})();


// ---- Auth modal (popup) - Linear + PH bronze ----
(function(){
  // inject modal HTML once
  if(document.getElementById('authOverlay')) return;
  const html = `<div class="auth-overlay" id="authOverlay" aria-hidden="true">
  <div class="auth-modal" role="dialog" aria-modal="true">
    <button class="auth-close" id="authClose" aria-label="بستن">✕</button>
    <div class="auth-modal-head">
      <div class="auth-modal-logo"><img src="assets/logo.png?v=2" alt=""><span dir="ltr"><span style="font-weight:400;color:var(--text)">web</span><b>PH</b></span></div>
      <h2 id="authTitle">خوش آمدید</h2>
      <p id="authSub">برای ادامه وارد شوید یا ثبت‌نام کنید</p>
    </div>
    <div class="auth-tabs">
      <button class="auth-tab on" data-tab="login">ورود</button>
      <button class="auth-tab" data-tab="register">ثبت‌نام</button>
    </div>
    <form class="auth-form on" id="formLogin" autocomplete="on">
      <div class="auth-field"><label>ایمیل</label><input type="email" id="loginEmail" placeholder="you@example.com" required dir="ltr"></div>
      <div class="auth-field"><label>رمز عبور</label><input type="password" id="loginPass" placeholder="••••••••" required dir="ltr"></div>
      <div class="auth-row"><label><input type="checkbox" id="rememberMe"> مرا به خاطر بسپار</label><a id="forgotLink">فراموشی رمز؟</a></div>
      <button type="submit" class="auth-btn" id="btnLogin">ورود →</button>
      <div class="auth-msg" id="loginMsg"></div>
      <div class="auth-divider">یا</div>
      <div class="auth-alt">حساب ندارید؟ <b id="goRegister">ثبت‌نام کنید</b></div>
    </form>
    <form class="auth-form" id="formRegister" autocomplete="on">
      <div class="auth-field"><label>نام و نام خانوادگی</label><input type="text" id="regName" placeholder="علی حسینی" required></div>
      <div class="auth-field"><label>ایمیل</label><input type="email" id="regEmail" placeholder="you@example.com" required dir="ltr"></div>
      <div class="auth-field"><label>شماره موبایل (اختیاری)</label><input type="tel" id="regPhone" placeholder="0912..." dir="ltr"></div>
      <div class="auth-field"><label>رمز عبور (حداقل ۶ کاراکتر)</label><input type="password" id="regPass" placeholder="••••••••" required dir="ltr"></div>
      <button type="submit" class="auth-btn" id="btnRegister">ساخت حساب →</button>
      <div class="auth-msg" id="regMsg"></div>
      <div class="auth-divider">یا</div>
      <div class="auth-alt">قبلاً ثبت‌نام کرده‌اید؟ <b id="goLogin">وارد شوید</b></div>
    </form>
    <form class="auth-form" id="formForgot" autocomplete="off">
      <div class="auth-field"><label>ایمیل</label><input type="email" id="forgotEmail" placeholder="you@example.com" required dir="ltr"></div>
      <button type="submit" class="auth-btn" id="btnForgot">ارسال لینک بازیابی →</button>
      <div class="auth-msg" id="forgotMsg"></div>
      <div class="auth-divider">یا</div>
      <div class="auth-alt"><b id="backToLogin">بازگشت به ورود</b></div>
    </form>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const overlay=document.getElementById('authOverlay');
  const closeBtn=document.getElementById('authClose');
  const tabs=document.querySelectorAll('.auth-tab');
  const forms={login:document.getElementById('formLogin'), register:document.getElementById('formRegister'), forgot:document.getElementById('formForgot')};
  const title=document.getElementById('authTitle'), sub=document.getElementById('authSub');
  function setTab(t){
    tabs.forEach(x=>x.classList.toggle('on', x.dataset.tab===t));
    Object.keys(forms).forEach(k=> forms[k].classList.toggle('on', k===t));
    if(t==='login'){ title.textContent='خوش آمدید'; sub.textContent='برای ادامه وارد شوید'; }
    else if(t==='register'){ title.textContent='ساخت حساب'; sub.textContent='کمتر از ۳۰ ثانیه تا پنل شما'; }
    else { title.textContent='بازیابی رمز'; sub.textContent='لینک بازیابی به ایمیل شما ارسال می‌شود'; }
    document.querySelectorAll('.auth-msg').forEach(m=>{ m.className='auth-msg'; m.textContent=''; });
  }
  tabs.forEach(b=> b.addEventListener('click', ()=> setTab(b.dataset.tab)));
  document.getElementById('goRegister').addEventListener('click', ()=> setTab('register'));
  document.getElementById('goLogin').addEventListener('click', ()=> setTab('login'));
  document.getElementById('forgotLink').addEventListener('click', ()=> setTab('forgot'));
  document.getElementById('backToLogin').addEventListener('click', ()=> setTab('login'));
  function open(tab='login'){ setTab(tab); overlay.classList.add('open'); overlay.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; setTimeout(()=>{ const inp=overlay.querySelector('.auth-form.on input'); if(inp) inp.focus(); },80); }
  function close(){ overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && overlay.classList.contains('open')) close(); });
  function showMsg(id, text, ok){
    const el=document.getElementById(id);
    el.textContent=text; el.className='auth-msg show '+(ok?'ok':'err');
  }
  async function apiPost(path, body){
    const r=await fetch(path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error||'خطا');
    return j;
  }
  document.getElementById('formLogin').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const btn=document.getElementById('btnLogin'); btn.disabled=true; btn.textContent='در حال ورود...';
    try{
      const j=await apiPost('/api/auth/login', {email:document.getElementById('loginEmail').value.trim(), password:document.getElementById('loginPass').value});
      localStorage.setItem('token', j.token); localStorage.setItem('user', JSON.stringify(j.user));
      showMsg('loginMsg','ورود موفق — در حال انتقال...', true);
      setTimeout(()=>{ close(); location.reload(); },600);
    }catch(err){ showMsg('loginMsg', err.message, false); } finally{ btn.disabled=false; btn.textContent='ورود →'; }
  });
  document.getElementById('formRegister').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const btn=document.getElementById('btnRegister'); btn.disabled=true; btn.textContent='در حال ساخت...';
    try{
      const j=await apiPost('/api/auth/register', {name:document.getElementById('regName').value.trim(), email:document.getElementById('regEmail').value.trim(), phone:document.getElementById('regPhone').value.trim(), password:document.getElementById('regPass').value});
      localStorage.setItem('token', j.token); localStorage.setItem('user', JSON.stringify(j.user));
      showMsg('regMsg','حساب ساخته شد — خوش آمدید ✓', true);
      setTimeout(()=>{ close(); location.reload(); },600);
    }catch(err){ showMsg('regMsg', err.message, false); } finally{ btn.disabled=false; btn.textContent='ساخت حساب →'; }
  });
  document.getElementById('formForgot').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const btn=document.getElementById('btnForgot'); btn.disabled=true; btn.textContent='در حال ارسال...';
    try{
      const j=await apiPost('/api/auth/forgot', {email:document.getElementById('forgotEmail').value.trim()});
      showMsg('forgotMsg', j.message||'اگر ایمیل وجود داشته باشد، لینک ارسال شد', true);
    }catch(err){ showMsg('forgotMsg', err.message, false); } finally{ btn.disabled=false; btn.textContent='ارسال لینک بازیابی →'; }
  });
  window.PHAuth={open, close, setTab};
  // if URL has ?auth=login or register, auto open
  try{
    const u=new URL(location.href);
    if(u.searchParams.get('auth')) open(u.searchParams.get('auth')==='register'?'register':'login');
    if(location.pathname.endsWith('login.html')||location.pathname.endsWith('register.html')){
      // redirect old direct visits to popup
      open(location.pathname.includes('register')?'register':'login');
      history.replaceState(null,'',location.pathname.replace('login.html','').replace('register.html',''));
    }
  }catch(e){}
})();

// Form — honest submit: opens the visitor's email client with prefilled message (no fake success)
const form = document.getElementById('contactForm');
if (form) form.addEventListener('submit', e => {
  e.preventDefault();
  const btn = form.querySelector('button');
  const fd = new FormData(form);
  const fields = {};
  fd.forEach((v, k) => fields[k] = String(v).replace(/[\u0000-\u001f<>]/g, '').slice(0, 500));
  const subject = encodeURIComponent('پیام از وب‌سایت PH Web');
  const body = encodeURIComponent(
    'نام: ' + (fields.name || '') + '\n' +
    'ایمیل: ' + (fields.email || '') + '\n' +
    'پیام:\n' + (fields.message || fields.text || '')
  );
  window.location.href = 'mailto:a.pourhoseini1384@gmail.com?subject=' + subject + '&body=' + body;
  btn.textContent = '✓ ایمیل باز شد';
  btn.style.background = 'var(--accent)';
  btn.style.color = '#07070A';
  setTimeout(() => { btn.textContent = 'ارسال پیام 🚀'; btn.style.background = ''; btn.style.color = ''; }, 3000);
});
