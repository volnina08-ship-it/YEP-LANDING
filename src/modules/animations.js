import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { config } from '../config.js';
import { mountLogo, logoTimeline, LOADER_VARIANTS } from './loader.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });
if (typeof window !== 'undefined') window.__yep = { gsap, ScrollTrigger };

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

export async function initAnimations() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { await document.fonts.ready; } catch (_) { /* noop */ }

  if (reduce) {
    revealEverything();
    return;
  }

  try {
    intro();
    scrollReveals();
    splitHeadings();
    sectionMoments();
    progressBar();
  } catch (err) {
    console.error('[yep] animations failed, revealing content', err);
    revealEverything();
  }
}

/* ---------- preloader + hero intro ---------- */
// melyik betöltő fusson: ?loader=1|2|3 (vagy a név) felülírja a config.loader beállítást, és mindig lejátssza
function loaderVariant() {
  const q = new URLSearchParams(location.search).get('loader');
  if (q) {
    const byNum = LOADER_VARIANTS[Number(q) - 1];
    if (byNum) return byNum;
    if (LOADER_VARIANTS.includes(q)) return q;
  }
  return LOADER_VARIANTS.includes(config.loader) ? config.loader : 'classic';
}

function intro() {
  const loader = $('#loader');
  const variant = loaderVariant();
  const forced = new URLSearchParams(location.search).has('loader');
  const seen = (() => { try { return sessionStorage.getItem('yep-seen') === '1'; } catch (_) { return false; } })();
  try { sessionStorage.setItem('yep-seen', '1'); } catch (_) { /* noop */ }
  const play = !seen || forced;

  gsap.set('.hero__title .line__in', { yPercent: 112 });
  gsap.set('.hero__video', { opacity: 0, scale: 1.06, transformOrigin: '50% 50%' });

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  // a hero videó nem autoplay: a betöltő végén, kicsivel a függöny felcsúszása előtt indul, hogy az elejétől látsszon
  const playHero = () => { const v = $('.hero__video'); if (v && v.tagName === 'VIDEO') v.play().catch(() => {}); };

  if (play && variant !== 'classic') {
    loader.classList.add('is-paint');
    const mount = mountLogo($('#loader-mark'), variant);
    tl.add(logoTimeline(mount, { paused: false }))
      .add(playHero, '+=0.15')
      .to(loader, { yPercent: -100, duration: 0.95, ease: 'expo.inOut' }, '+=0.15')
      .set(loader, { display: 'none' });
  } else if (play) {
    tl.to('.loader__logo img', { opacity: 1, duration: 0.7, ease: 'power2.out' })
      .to('.loader__bar span', { scaleX: 1, duration: 1.0, ease: 'power3.inOut' }, '-=0.35')
      .to('.loader__logo img', { opacity: 0, y: -12, duration: 0.35, ease: 'power2.in' }, '+=0.1')
      .add(playHero, '-=0.15')
      .to(loader, { yPercent: -100, duration: 0.95, ease: 'expo.inOut' }, '<+0.15')
      .set(loader, { display: 'none' });
  } else {
    playHero();
    tl.to(loader, { opacity: 0, duration: 0.35 }).set(loader, { display: 'none' });
  }
  if (typeof window !== 'undefined') window.__yep.intro = tl;

  tl.to('.hero__video', { opacity: 1, scale: 1, duration: 1.8, ease: 'power2.out' }, play ? '-=0.75' : '<')
    .from('[data-hero="eyebrow"]', { y: 18, opacity: 0, duration: 0.8 }, '<+0.15')
    .to('.hero__title .line__in', { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.09 }, '<+0.05')
    .from('[data-hero="lead"]', { y: 22, opacity: 0, duration: 0.9 }, '<+0.4')
    .from('[data-hero="actions"] .btn', { y: 18, opacity: 0, duration: 0.8, stagger: 0.08 }, '<+0.15')
    .from('[data-hero="play"]', { x: 24, opacity: 0, duration: 0.9 }, '<')
    .from('[data-hero="bottom"]', { y: 16, opacity: 0, duration: 0.9, onStart: countUp }, '<+0.1')
    .from('#nav', { y: -16, opacity: 0, duration: 0.9 }, '<');
}

function countUp() {
  $$('.count').forEach((el) => {
    const target = Number(el.dataset.count) || 0;
    const obj = { v: 0 };
    gsap.to(obj, { v: target, duration: 1.9, ease: 'power3.out', onUpdate: () => { el.textContent = String(Math.round(obj.v)); } });
  });
}

/* ---------- scroll reveals ---------- */
function scrollReveals() {
  $$('[data-reveal]').forEach((el) => {
    const type = el.dataset.reveal;
    const stagger = el.closest('[data-stagger]');
    const delay = stagger ? Array.from(stagger.children).indexOf(el) * 0.1 : 0;

    if (type === 'clip') {
      const media = el.querySelector('img, video');
      gsap.set(el, { clipPath: 'inset(100% 0% 0% 0%)', webkitClipPath: 'inset(100% 0% 0% 0%)' });
      if (media) gsap.set(media, { scale: 1.16, transformOrigin: '50% 50%' });
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      tl.to(el, { clipPath: 'inset(0% 0% 0% 0%)', webkitClipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.out', delay });
      if (media) tl.to(media, { scale: 1, duration: 1.7, ease: 'power3.out', clearProps: 'transform' }, '<');
      tl.set(el, { clearProps: 'clipPath,webkitClipPath' });
      return;
    }

    if (type === 'script') {
      gsap.set(el, { clipPath: 'inset(-15% 100% -15% -5%)' });
      gsap.to(el, {
        clipPath: 'inset(-15% -5% -15% -5%)', duration: 1.5, ease: 'power3.inOut',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
      return;
    }

    gsap.set(el, { opacity: 0, y: 36 });
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', delay,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onComplete: () => gsap.set(el, { clearProps: 'transform' }),
    });
  });
}

/* ---------- headings: masked line reveal ---------- */
function splitHeadings() {
  $$('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 110, duration: 1.15, ease: 'expo.out', stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      },
    });
  });
}

/* ---------- section-level moments ---------- */
function sectionMoments() {
  // testimonial: yellow wipe reveals the section
  const wipe = $('.quote__wipe');
  if (wipe) {
    gsap.set(wipe, { scaleY: 1, transformOrigin: 'bottom' });
    gsap.to(wipe, {
      scaleY: 0, duration: 1.25, ease: 'expo.inOut',
      scrollTrigger: { trigger: '.quote', start: 'top 72%', once: true },
    });
  }

  // CTA watermark fades in
  const wm = $('.watermark');
  if (wm) {
    gsap.to(wm, { opacity: 0.045, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: '.cta', start: 'top 70%', once: true } });
  }

  // hairline rules (section tops) draw in
  $$('.section__head, .hero__bottom').forEach((el) => {
    if (!el.classList.contains('hero__bottom')) return;
  });
}

/* ---------- scroll progress ---------- */
function progressBar() {
  const bar = $('#progress');
  if (!bar) return;
  gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.4 } });
}

/* ---------- fallback: show everything ---------- */
function revealEverything() {
  gsap.set('#loader', { display: 'none' });
  const v = $('.hero__video'); if (v && v.tagName === 'VIDEO') v.play().catch(() => {});
  gsap.set('.hero__video', { opacity: 1, scale: 1 });
  gsap.set('.hero__title .line__in', { yPercent: 0 });
  gsap.set('[data-hero], [data-reveal], #nav', { opacity: 1, clearProps: 'transform,clipPath' });
  gsap.set('.watermark', { opacity: 0.045 });
  gsap.set('.quote__wipe', { scaleY: 0 });
  $$('.count').forEach((el) => { el.textContent = el.dataset.count; });
}
