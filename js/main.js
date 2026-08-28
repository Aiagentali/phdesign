// PH Design — main.js (redesign v2)

// Theme
const html = document.documentElement;
const tg = document.getElementById('themeToggle');
(function(){ const t = localStorage.getItem('ph-theme') || 'dark'; html.setAttribute('data-theme', t); })();
if (tg) tg.addEventListener('click', () => {
  const c = html.getAttribute('data-theme');
  const n = c === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', n);
  localStorage.setItem('ph-theme', n);
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

// Form
const form = document.getElementById('contactForm');
if (form) form.addEventListener('submit', e => {
  e.preventDefault();
  const btn = form.querySelector('button');
  btn.textContent = '✓ ارسال شد';
  btn.style.background = 'var(--accent)';
  btn.style.color = '#07070A';
  setTimeout(() => { btn.textContent = 'ارسال پیام 🚀'; btn.style.background = ''; btn.style.color = ''; form.reset(); }, 3000);
});
