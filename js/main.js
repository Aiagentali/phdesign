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
    if(lo) lo.addEventListener('click', (e)=>{ e.preventDefault(); try{ localStorage.removeItem('token'); localStorage.removeItem('user'); }catch(e){} location.href='login.html'; });
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
