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
