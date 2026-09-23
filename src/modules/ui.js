import gsap from 'gsap';
import { getMedia } from './media.js';
import { MESSAGES } from './i18n.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = () => navigator.connection?.saveData === true;

export function initUI({ config, lang }) {
  const msgs = MESSAGES[lang] || MESSAGES.hu;
  document.getElementById('year').textContent = String(new Date().getFullYear());

  initLinks(config);
  initNav();
  initMenu();
  initTimecodes();
  initLazyVideos();
  initModal(msgs);
  initCursor();
  initPreselect();
}

/* ---------- links from config ---------- */
function initLinks(config) {
  document.querySelectorAll('[data-booking]').forEach((a) => {
    if (config.bookingUrl) {
      a.href = config.bookingUrl;
      a.target = '_blank';
      a.rel = 'noopener';
    }
  });
  document.querySelectorAll('[data-ext]').forEach((a) => {
    const url = config.links?.[a.dataset.ext];
    if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
    else a.style.display = 'none';
  });
  document.querySelectorAll('[data-social]').forEach((a) => {
    const url = config.socials?.[a.dataset.social];
    if (url) a.href = url;
    else a.style.display = 'none';
  });
  document.querySelectorAll('[data-mailto]').forEach((a) => {
    a.href = `mailto:${config.email}`;
    const t = a.querySelector('[data-mailto-text]');
    if (t) t.textContent = config.email;
  });
}

/* ---------- nav state ---------- */
function initNav() {
  const nav = document.getElementById('nav');
  let ticking = false;
  const update = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}

/* ---------- fullscreen menu ---------- */
function initMenu() {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  const setOpen = (open) => {
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('is-locked', open);
  };
  burger.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false); });
}

/* ---------- timecode tickers (text-only animation) ---------- */
function initTimecodes() {
  const tc = document.getElementById('timecode');
  const recs = document.querySelectorAll('[data-tc]');
  if (!tc && !recs.length) return;
  const pad = (n) => String(n).padStart(2, '0');
  const start = performance.now();
  let lastFrame = -1;
  const tick = (now) => {
    const t = (now - start) / 1000;
    const frame = Math.floor(t * 25);
    if (frame !== lastFrame) {
      lastFrame = frame;
      const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60), f = frame % 25;
      if (tc) tc.textContent = `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
      if (f === 0) recs.forEach((r) => { r.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`; });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- lazy autoplay videos (in view → play, out of view → pause) ---------- */
function initLazyVideos() {
  const videos = document.querySelectorAll('video[data-autoplay]');
  if (!videos.length) return;
  const allowAutoplay = !reduceMotion() && !saveData();
  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) {
        if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
        if (allowAutoplay) v.play().catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { rootMargin: '200px 0px' });
  videos.forEach((v) => io.observe(v));

  // hero video: pause when scrolled out (saves battery)
  const hero = document.querySelector('.hero__video');
  if (hero) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) hero.play().catch(() => {}); else hero.pause();
    }, { threshold: 0.05 }).observe(hero);
  }
}

/* ---------- video modal ---------- */
function initModal(msgs) {
  const modal = document.getElementById('video-modal');
  const player = document.getElementById('modal-player');
  const caption = document.getElementById('modal-caption');
  const closeBtn = modal.querySelector('.modal__close');
  let lastFocus = null;

  const embedUrl = (url) => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace('www.', '');
      if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0`;
      if (host.endsWith('youtube.com')) {
        const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
        return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      }
      if (host.endsWith('vimeo.com')) {
        const id = u.pathname.split('/').filter(Boolean).pop();
        return `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0`;
      }
    } catch (_) { /* noop */ }
    return url;
  };

  const open = (key, trigger) => {
    const entry = getMedia(key);
    if (!entry || entry.todo) return;
    lastFocus = trigger;
    player.innerHTML = '';
    player.classList.toggle('is-portrait', entry.portrait === true);
    if (entry.url) {
      const f = document.createElement('iframe');
      f.src = embedUrl(entry.url);
      f.allow = 'autoplay; fullscreen; picture-in-picture';
      f.allowFullscreen = true;
      f.title = entry.title || 'Video';
      player.appendChild(f);
    } else if (entry.video) {
      const v = document.createElement('video');
      v.src = entry.video;
      if (entry.poster) v.poster = entry.poster;
      v.controls = true; v.autoplay = true; v.playsInline = true;
      player.appendChild(v);
      v.play().catch(() => {});
    }
    const title = entry.title || msgs.showreel;
    caption.textContent = entry.sub ? `${title} — ${entry.sub}` : title;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    closeBtn.focus();
  };
  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    setTimeout(() => { player.innerHTML = ''; }, 400);
    lastFocus?.focus?.();
  };

  document.querySelectorAll('[data-open-video]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); open(el.dataset.openVideo, el); });
    if (el.tagName !== 'BUTTON') {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el.dataset.openVideo, el); } });
    }
  });
  modal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });
}

/* ---------- "PLAY" cursor badge over video cards (desktop only) ---------- */
function initCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || reduceMotion()) return;
  const cursor = document.getElementById('cursor');
  const toX = gsap.quickTo(cursor, 'x', { duration: 0.28, ease: 'power3' });
  const toY = gsap.quickTo(cursor, 'y', { duration: 0.28, ease: 'power3' });
  window.addEventListener('mousemove', (e) => { toX(e.clientX); toY(e.clientY); }, { passive: true });
  document.querySelectorAll('[data-cursor="play"]').forEach((el) => {
    el.addEventListener('mouseenter', () => cursor.classList.add('is-play'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('is-play'));
  });
}

/* ---------- service card "Tovább" → preselect the service in the form ---------- */
function initPreselect() {
  const select = document.querySelector('#quote-form [name="service"]');
  if (!select) return;
  document.querySelectorAll('[data-preselect]').forEach((a) => {
    a.addEventListener('click', () => { select.value = a.dataset.preselect; });
  });
}
