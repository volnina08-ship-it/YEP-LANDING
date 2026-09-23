/*  Betöltő animáció: a YEP! logó ecsetvonásonként „felfestődik”.
 *  Három változat (a config.loader vagy a ?loader=1|2|3 URL-paraméter választja):
 *    brush  (1) – tiszta, irányított ecsetvonások olvasási sorrendben
 *    dry    (2) – száraz ecset: tépett szélek, külön bepattanó fröccsenések, a végén „megszárad” a festék
 *    sketch (3) – vékony kontúr rajzolódik végig, aztán vonásonként telik fel festékkel
 *  A logó vektorai a src/logo-data.js-ből jönnek (public/logo.svg-ből generálva).
 */
import gsap from 'gsap';
import { MARK_VIEWBOX, TEXT_VIEWBOX, MARK_PARTS, OUTLINE_ORDER, SPECKLES, TEXT, STROKES } from '../logo-data.js';

export const LOADER_VARIANTS = ['brush', 'dry', 'sketch'];

const YELLOW = '#fdde28';
const GROW = 0.9; // a csempék ennyivel átfednek, hogy az élsimítás ne rajzoljon hajszálvékony varratot a találkozásoknál
const grown = (s) => ({ ...s, x: s.x - GROW, y: s.y - GROW, w: s.w + GROW * 2, h: s.h + GROW * 2 });
const WET = '#dcb60f';
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

const make = (tag, attrs = {}, parent = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (parent) parent.appendChild(n);
  return n;
};

// egy csempe kezdő állapota a festés iránya szerint
const tileStart = (s) => {
  switch (s.dir) {
    case 'down': return { x: s.x, y: s.y, width: s.w, height: 0 };
    case 'right': return { x: s.x, y: s.y, width: 0, height: s.h };
    case 'left': return { x: s.x + s.w, y: s.y, width: 0, height: s.h };
    case 'diag': return { x: s.x, y: s.y, width: 0, height: 0 };
    default: return { x: s.x + s.w / 2, y: s.y + s.h / 2, width: 0, height: 0 }; // pop
  }
};
const tileEnd = (s) => ({ x: s.x, y: s.y, width: s.w, height: s.h });
const tileLen = (s) => (s.dir === 'down' ? s.h : s.dir === 'diag' ? Math.hypot(s.w, s.h) : s.dir === 'pop' ? Math.max(s.w, s.h) : s.w);

/** Felépíti az inline SVG-t a konténerbe. Visszaadja az animálandó elemeket. */
export function mountLogo(container, variant = 'brush') {
  const id = `lf${++uid}`;
  const [mx, my, mw] = MARK_VIEWBOX.split(' ').map(Number);
  const [tx, ty, tw, th] = TEXT_VIEWBOX.split(' ').map(Number);
  const pad = 2;
  const viewBox = `${mx - pad} ${my - pad} ${mw + pad * 2} ${ty + th - my + pad * 2}`;
  const region = { x: 0, y: 0, width: 320, height: 200 }; // userSpace régió, ami mindent lefed

  const svg = make('svg', { viewBox, class: `lf lf--${variant}`, 'aria-hidden': 'true', focusable: 'false' });
  const defs = make('defs', {}, svg);

  if (variant === 'dry') {
    const f = make('filter', { id: `${id}-rough`, filterUnits: 'userSpaceOnUse', ...region, 'color-interpolation-filters': 'sRGB' }, defs);
    make('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.05 0.11', numOctaves: 2, seed: 4, result: 'n' }, f);
    make('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 6, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
  }

  // a jel maszkja: csempénként egy téglalap, ami a vonás irányában nő
  const mask = make('mask', { id: `${id}-m`, maskUnits: 'userSpaceOnUse', ...region }, defs);
  const tileG = make('g', variant === 'dry' ? { filter: `url(#${id}-rough)` } : {}, mask);
  const strokes = STROKES.map(grown);
  const tiles = strokes.map((s) => ({ s, rect: make('rect', { fill: '#fff', ...tileStart(s) }, tileG) }));
  const all = make('rect', { ...region, fill: '#fff', opacity: 0 }, mask); // biztonsági záró fade: ami kimaradt, az is megjelenik

  // a „CONTENT PRODUCTION” felirat maszkja: balról jobbra végigsöpör
  const wmask = make('mask', { id: `${id}-w`, maskUnits: 'userSpaceOnUse', ...region }, defs);
  const wrect = make('rect', { x: tx - 2, y: ty - 2, width: 0, height: th + 4, fill: '#fff' }, wmask);

  const mark = make('g', { class: 'lf__mark', fill: variant === 'dry' ? WET : YELLOW, mask: `url(#${id}-m)` }, svg);
  MARK_PARTS.forEach((parts) => make('path', { d: parts.join('') }, mark));

  let speckles = [];
  if (variant === 'dry') {
    const sg = make('g', { class: 'lf__speckles', fill: WET }, svg);
    speckles = SPECKLES.map((sp) => ({ sp, el: make('path', { d: sp.d }, sg) }));
  } else {
    SPECKLES.forEach((sp) => make('path', { d: sp.d }, mark));
  }

  let outlines = [];
  if (variant === 'sketch') {
    const og = make('g', { class: 'lf__outline', fill: 'none', stroke: YELLOW, 'stroke-width': 0.9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    outlines = OUTLINE_ORDER.flatMap((i) => MARK_PARTS[i]).map((d) => make('path', { d, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, og));
  }

  const text = make('g', { class: 'lf__text', fill: '#fff', mask: `url(#${id}-w)` }, svg);
  TEXT.forEach((d) => make('path', { d }, text));

  container.appendChild(svg);
  return { svg, variant, strokes, tiles, all, wrect, wordWidth: tw + 4, mark, speckles, outlines };
}

/** GSAP timeline a felfestéshez. opts.paused: alapból true (előnézethez); a betöltőben false, hogy a fő timeline-ba fűzhető legyen. */
export function logoTimeline(m, opts = {}) {
  const tl = gsap.timeline({ paused: opts.paused ?? true });
  const { variant } = m;

  // csempék felfestése: minden vonás a hossza szerinti ideig tart, egymást átfedve indulnak
  const paint = (at, { stagger, speed, ease }) => {
    let t = at; const starts = []; let end = 0;
    m.tiles.forEach(({ s, rect }) => {
      const dur = (0.2 + tileLen(s) * 0.0022) * speed;
      starts.push({ t, dur });
      tl.to(rect, { attr: tileEnd(s), duration: dur, ease: s.dir === 'pop' ? 'back.out(2)' : ease }, t);
      end = Math.max(end, t + dur);
      t += stagger;
    });
    return { starts, end };
  };

  let end = 0;
  if (variant === 'brush') {
    end = paint(0, { stagger: 0.09, speed: 1, ease: 'power2.inOut' }).end;
  } else if (variant === 'dry') {
    const r = paint(0, { stagger: 0.08, speed: 1.15, ease: 'power3.out' });
    end = r.end;
    // a fröccsenések akkor pattannak be, amikor az ecset épp ott jár
    m.speckles.forEach(({ sp, el }) => {
      let i = m.strokes.findIndex((s) => sp.cx >= s.x && sp.cx <= s.x + s.w && sp.cy >= s.y && sp.cy <= s.y + s.h);
      if (i < 0) i = m.strokes.length - 1;
      const s = m.strokes[i]; const st = r.starts[i];
      const frac = s.dir === 'down' ? (sp.cy - s.y) / s.h : s.dir === 'right' ? (sp.cx - s.x) / s.w : s.dir === 'left' ? (s.x + s.w - sp.cx) / s.w : 0.5;
      gsap.set(el, { scale: 0, svgOrigin: `${sp.cx} ${sp.cy}` });
      tl.to(el, { scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, st.t + st.dur * Math.min(1, Math.max(0, frac)) + Math.random() * 0.08);
    });
    // a festék „megszárad”: mélyebb sárgából a márkasárgába
    tl.to([m.mark, ...m.speckles.map((x) => x.el)], { fill: YELLOW, duration: 0.8, ease: 'power1.inOut' }, end - 0.35);
  } else {
    // skicc: vékony kontúr végigrajzolása
    const lens = m.outlines.map((p) => p.getTotalLength());
    const max = Math.max(...lens) || 1;
    let t = 0; let sketchEnd = 0;
    m.outlines.forEach((p, i) => {
      const dur = 0.18 + 0.75 * (lens[i] / max);
      tl.to(p, { attr: { 'stroke-dashoffset': 0 }, duration: dur, ease: 'power1.inOut' }, t);
      sketchEnd = Math.max(sketchEnd, t + dur);
      t += 0.09;
    });
    end = paint(sketchEnd - 0.35, { stagger: 0.07, speed: 0.85, ease: 'power2.inOut' }).end;
    tl.to(m.outlines, { opacity: 0, duration: 0.4 }, end - 0.2);
  }

  tl.to(m.all, { attr: { opacity: 1 }, duration: 0.3 }, end - 0.15);
  tl.to(m.wrect, { attr: { width: m.wordWidth }, duration: 0.55, ease: 'power3.inOut' }, end - 0.05);
  return tl;
}
