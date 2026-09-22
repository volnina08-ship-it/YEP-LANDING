#!/usr/bin/env node
/**
 * YEP Content – média pipeline
 *
 *  1) Tedd a Dropbox-ból letöltött fájlokat a public/media/source mappába
 *     (vagy futtasd: npm run media:fetch – ez letölti és kicsomagolja a megosztott mappát)
 *  2) npm run media
 *       → ffmpeg-gel webre optimalizál: videó h264 mp4 (max 1080p, faststart) + poszter jpg,
 *         fotó max 2000px jpg  →  public/media/video, public/media/photo
 *       → automatikusan kiosztja a slotokat (hero, showreel, projektek, social, galéria, …)
 *       → megírja a src/media.manifest.json fájlt (ezt olvassa az oldal)
 *
 *  Kézi hozzárendelés: public/media/media.map.json  (részletek: README.md)
 *  Opciók:  --force  (mindent újrakódol)   --dry  (csak kiosztás, kódolás nélkül)
 *  Függőség: ffmpeg + ffprobe a PATH-on  (macOS: brew install ffmpeg)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'public/media/source');
const OUT_VIDEO = path.join(ROOT, 'public/media/video');
const OUT_PHOTO = path.join(ROOT, 'public/media/photo');
const BASE_MANIFEST = path.join(ROOT, 'public/media/placeholders/manifest.json');
const MANIFEST = path.join(ROOT, 'src/media.manifest.json');
const MAP_FILE = path.join(ROOT, 'public/media/media.map.json');
const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry');

const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv', '.mts']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.heic', '.heif']);

const has = (bin) => spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
const run = (bin, args) => {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64e6 });
  if (r.status !== 0) throw new Error(`${bin} hiba: ${(r.stderr || '').trim().split('\n').pop()}`);
  return r.stdout;
};
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'media';
const newer = (out, src) => fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs;
const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === '__MACOSX') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function probe(file) {
  const json = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]));
  const v = (json.streams || []).find((s) => s.codec_type === 'video');
  if (!v || !v.width || !v.height) return null;
  let { width: w, height: h } = v;
  const side = (v.side_data_list || []).find((d) => d.rotation != null);
  const rot = Math.abs(Number(v.tags?.rotate ?? side?.rotation ?? 0)) % 180;
  if (rot === 90) [w, h] = [h, w];
  return { w, h, duration: Number(json.format?.duration || 0), portrait: h > w, square: Math.abs(h - w) / Math.max(w, h) < 0.08 };
}

function encodeVideo(file, slug, info) {
  const out = path.join(OUT_VIDEO, `${slug}.mp4`);
  const poster = path.join(OUT_VIDEO, `${slug}.jpg`);
  if (!DRY && (FORCE || !newer(out, file))) {
    console.log(`  ▶  ${path.basename(file)}  →  video/${slug}.mp4`);
    const scale = info.portrait ? "scale=-2:'min(1920,ih)'" : "scale='min(1920,iw)':-2";
    run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', out]);
  }
  if (!DRY && (FORCE || !newer(poster, file)) && fs.existsSync(out)) {
    const ss = Math.min(1.5, Math.max(0, info.duration / 4)).toFixed(2);
    run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-i', out, '-frames:v', '1', '-q:v', '3', poster]);
  }
  return { video: `/media/video/${slug}.mp4`, poster: `/media/video/${slug}.jpg`, portrait: info.portrait, duration: info.duration };
}

function encodePhoto(file, slug, info) {
  const out = path.join(OUT_PHOTO, `${slug}.jpg`);
  if (!DRY && (FORCE || !newer(out, file))) {
    console.log(`  ▣  ${path.basename(file)}  →  photo/${slug}.jpg`);
    run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', "scale='min(2000,iw)':'min(2000,ih)':force_original_aspect_ratio=decrease", '-q:v', '3', out]);
  }
  return { image: `/media/photo/${slug}.jpg`, portrait: info.portrait, square: info.square };
}

/* ------------------------------------------------------------------ */
if (!has('ffmpeg') || !has('ffprobe')) {
  console.error('✖ ffmpeg/ffprobe nem található a PATH-on. Telepítés: https://ffmpeg.org/download.html  (macOS: brew install ffmpeg)');
  process.exit(1);
}
if (!fs.existsSync(SRC)) {
  console.error(`✖ Nincs forrásmappa: ${path.relative(ROOT, SRC)}\n  Futtasd: npm run media:fetch   vagy másold ide a fájlokat.`);
  process.exit(1);
}
fs.mkdirSync(OUT_VIDEO, { recursive: true });
fs.mkdirSync(OUT_PHOTO, { recursive: true });

console.log('▸ Forrás beolvasása…');
const videos = [];
const photos = [];
const usedSlugs = new Set();
for (const f of walk(SRC).sort((a, b) => a.localeCompare(b, 'hu'))) {
  const ext = path.extname(f).toLowerCase();
  if (!VIDEO_EXT.has(ext) && !IMAGE_EXT.has(ext)) continue;
  const base = path.basename(f);
  let slug = slugify(path.basename(f, ext));
  for (let i = 2; usedSlugs.has(slug); i++) slug = `${slugify(path.basename(f, ext))}-${i}`;
  usedSlugs.add(slug);
  try {
    const info = probe(f);
    if (!info) throw new Error('nem olvasható videó/kép stream');
    if (VIDEO_EXT.has(ext)) videos.push({ base, slug, ...encodeVideo(f, slug, info) });
    else photos.push({ base, slug, ...encodePhoto(f, slug, info) });
  } catch (e) {
    console.warn(`  !  kihagyva: ${base} – ${e.message}`);
  }
}
console.log(`▸ ${videos.length} videó, ${photos.length} fotó feldolgozva.`);

/* ------------------------------------------------------------------ */
const manifest = JSON.parse(fs.readFileSync(BASE_MANIFEST, 'utf8'));
const map = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};
const report = [];

const findByName = (pool, name) => {
  const n = String(name).toLowerCase();
  const i = pool.findIndex((x) => x.base.toLowerCase() === n || x.slug === slugify(name) || x.slug === slugify(path.parse(name).name));
  return i >= 0 ? pool.splice(i, 1)[0] : null;
};
const takeVideo = (pref) => {
  const order = pref === 'portrait' ? [(v) => v.portrait, () => true] : [(v) => !v.portrait, () => true];
  for (const t of order) { const i = videos.findIndex(t); if (i >= 0) return videos.splice(i, 1)[0]; }
  return null;
};
const takePhoto = (pref) => {
  const tests = {
    portrait: [(p) => p.portrait && !p.square, (p) => p.square, () => true],
    landscape: [(p) => !p.portrait && !p.square, (p) => p.square, () => true],
    square: [(p) => p.square, (p) => !p.portrait, () => true],
  }[pref];
  for (const t of tests) { const i = photos.findIndex(t); if (i >= 0) return photos.splice(i, 1)[0]; }
  return null;
};
const setVideo = (slot, target, item, from) => {
  if (!item) return;
  if (isUrl(item)) { target.url = item; report.push([slot, item, from]); return; }
  Object.assign(target, { video: item.video, poster: item.poster, portrait: item.portrait, url: '' });
  report.push([slot, item.base, from]);
};
const setPhoto = (slot, target, item, from) => {
  if (!item) return;
  target.image = item.image;
  report.push([slot, item.base, from]);
};

// 1) kézi kiosztás (media.map.json) – először, hogy a poolokból kikerüljenek
const mapVideo = (v) => (isUrl(v) ? v : findByName(videos, v));
const mapPhoto = (p) => findByName(photos, p);
if (map.hero) setVideo('hero', manifest.hero, mapVideo(map.hero), 'map');
if (map.showreel) setVideo('showreel', manifest.showreel, mapVideo(map.showreel), 'map');
(map.projects || []).forEach((v, i) => { if (v && manifest.projects[i]) setVideo(`projects[${i}]`, manifest.projects[i], mapVideo(v), 'map'); });
(map.social || []).forEach((v, i) => { if (v && manifest.social[i]) setVideo(`social[${i}]`, manifest.social[i], mapVideo(v), 'map'); });
if (map.about) setPhoto('about', manifest.about, mapPhoto(map.about), 'map');
if (map.testimonial) setPhoto('testimonial', manifest.testimonial, mapPhoto(map.testimonial), 'map');
if (map.cta) setPhoto('cta', manifest.cta, mapPhoto(map.cta), 'map');
(map.services || []).forEach((p, i) => { if (p && manifest.services[i]) setPhoto(`services[${i}]`, manifest.services[i], mapPhoto(p), 'map'); });
(map.gallery || []).forEach((p, i) => { if (p && manifest.gallery[i]) setPhoto(`gallery[${i}]`, manifest.gallery[i], mapPhoto(p), 'map'); });

// 2) automatikus kiosztás a maradékból
const filled = (t) => report.some(([s]) => s === t);
if (!filled('hero')) setVideo('hero', manifest.hero, takeVideo('landscape'), 'auto');
if (!filled('showreel')) {
  const v = takeVideo('landscape');
  if (v) setVideo('showreel', manifest.showreel, v, 'auto');
  else if (filled('hero') && manifest.hero.video) { Object.assign(manifest.showreel, { video: manifest.hero.video, poster: manifest.hero.poster }); report.push(['showreel', '(= hero)', 'auto']); }
}
manifest.projects.forEach((p, i) => { if (!filled(`projects[${i}]`)) setVideo(`projects[${i}]`, p, takeVideo('landscape'), 'auto'); });
manifest.social.forEach((s, i) => { if (!filled(`social[${i}]`)) { const v = videos.find((x) => x.portrait) ? takeVideo('portrait') : null; setVideo(`social[${i}]`, s, v, 'auto'); } });
if (!filled('about')) setPhoto('about', manifest.about, takePhoto('portrait'), 'auto');
if (!filled('testimonial')) setPhoto('testimonial', manifest.testimonial, takePhoto('portrait'), 'auto');
manifest.services.forEach((s, i) => { if (!filled(`services[${i}]`)) setPhoto(`services[${i}]`, s, takePhoto('landscape'), 'auto'); });
if (!filled('cta')) setPhoto('cta', manifest.cta, takePhoto('landscape'), 'auto');
const galleryPref = ['portrait', 'landscape', 'square', 'landscape', 'portrait', 'landscape', 'landscape', 'square'];
manifest.gallery.forEach((g, i) => { if (!filled(`gallery[${i}]`)) setPhoto(`gallery[${i}]`, g, takePhoto(galleryPref[i] || 'landscape'), 'auto'); });

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log('\n▸ Slot kiosztás:');
report.forEach(([slot, file, from]) => console.log(`  ${slot.padEnd(14)} ← ${file}${from === 'map' ? '   (map)' : ''}`));
const unused = [...videos.map((v) => v.base), ...photos.map((p) => p.base)];
if (unused.length) console.log(`\n  Kiosztatlan (nem került az oldalra): ${unused.join(', ')}`);
console.log(`\n✔ Manifest kész: ${path.relative(ROOT, MANIFEST)}${DRY ? '  (dry run – kódolás nélkül)' : ''}`);
