#!/usr/bin/env node
/**
 * YEP Content – média pipeline
 *
 *  1) Tedd a Dropbox-ból letöltött fájlokat a media-source mappába (a repo gyökerében)
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
const SRC = path.join(ROOT, 'media-source');
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

const HAS_FFPROBE = has('ffprobe');

function probe(file) {
  if (HAS_FFPROBE) {
    const json = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]));
    const v = (json.streams || []).find((s) => s.codec_type === 'video');
    if (!v || !v.width || !v.height) return null;
    let { width: w, height: h } = v;
    const side = (v.side_data_list || []).find((d) => d.rotation != null);
    const rot = Math.abs(Number(v.tags?.rotate ?? side?.rotation ?? 0)) % 180;
    if (rot === 90) [w, h] = [h, w];
    return { w, h, duration: Number(json.format?.duration || 0), portrait: h > w, square: Math.abs(h - w) / Math.max(w, h) < 0.08 };
  }
  // ffprobe nélkül: az ffmpeg -i kimenetéből olvassuk ki a méretet, hosszt és forgatást
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file], { encoding: 'utf8', maxBuffer: 16e6 });
  const txt = (r.stderr || '') + (r.stdout || '');
  const dim = /Video:.*?\s(\d{2,5})x(\d{2,5})/.exec(txt);
  if (!dim) return null;
  let w = Number(dim[1]), h = Number(dim[2]);
  const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(txt);
  const duration = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0;
  const rotM = /rotation of (-?\d+(?:\.\d+)?)/.exec(txt) || /rotate\s*:\s*(-?\d+)/.exec(txt);
  const rot = rotM ? Math.abs(Number(rotM[1])) % 180 : 0;
  if (rot === 90) [w, h] = [h, w];
  return { w, h, duration, portrait: h > w, square: Math.abs(h - w) / Math.max(w, h) < 0.08 };
}

function encodeVideo(file, slug, info, opts = {}) {
  // opts (media.map.json objektum forma): start (mp), duration (mp), mute (bool), crf, maxHeight
  const suffix = [opts.start != null ? `s${opts.start}` : '', opts.duration != null ? `d${opts.duration}` : '', opts.mute ? 'm' : ''].filter(Boolean).join('-');
  const name = suffix ? `${slug}-${suffix}` : slug;
  const out = path.join(OUT_VIDEO, `${name}.mp4`);
  const poster = path.join(OUT_VIDEO, `${name}.jpg`);
  const maxH = opts.maxHeight || 1080;
  if (!DRY && (FORCE || !newer(out, file))) {
    console.log(`  ▶  ${path.basename(file)}  →  video/${name}.mp4`);
    const scale = info.portrait ? `scale='min(${maxH},iw)':-2` : `scale=-2:'min(${maxH},ih)'`;
    const args = ['-y', '-loglevel', 'error'];
    if (opts.start != null) args.push('-ss', String(opts.start));
    args.push('-i', file);
    if (opts.duration != null) args.push('-t', String(opts.duration));
    args.push('-vf', scale, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(opts.crf || 23), '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
    if (opts.mute) args.push('-an'); else args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');
    args.push(out);
    run('ffmpeg', args);
  }
  if (!DRY && (FORCE || !newer(poster, file)) && fs.existsSync(out)) {
    const dur = opts.duration != null ? opts.duration : info.duration;
    const ss = Math.min(1.5, Math.max(0, dur / 4)).toFixed(2);
    run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-i', out, '-frames:v', '1', '-q:v', '3', poster]);
  }
  return { video: `/media/video/${name}.mp4`, poster: `/media/video/${name}.jpg`, portrait: info.portrait, duration: info.duration };
}

function encodePhoto(file, slug, info, opts = {}) {
  // opts (media.map.json objektum forma): cropTop – a kép tetejéből levágott hányad (0–1), pl. 0.25
  const suffix = opts.cropTop ? `-ct${Math.round(opts.cropTop * 100)}` : '';
  const name = `${slug}${suffix}`;
  const out = path.join(OUT_PHOTO, `${name}.jpg`);
  if (!DRY && (FORCE || !newer(out, file))) {
    console.log(`  ▣  ${path.basename(file)}  →  photo/${name}.jpg`);
    const vf = [];
    if (opts.cropTop) vf.push(`crop=iw:ih*${(1 - opts.cropTop).toFixed(3)}:0:ih*${opts.cropTop.toFixed(3)}`);
    vf.push("scale='min(2000,iw)':'min(2000,ih)':force_original_aspect_ratio=decrease");
    run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', vf.join(','), '-q:v', '3', out]);
  }
  const portrait = opts.cropTop ? info.h * (1 - opts.cropTop) > info.w : info.portrait;
  return { image: `/media/photo/${name}.jpg`, portrait, square: info.square };
}

/* ------------------------------------------------------------------ */
if (!has('ffmpeg')) {
  console.error('✖ ffmpeg nem található a PATH-on. Telepítés: https://ffmpeg.org/download.html  (macOS: brew install ffmpeg)');
  process.exit(1);
}
if (!HAS_FFPROBE) console.log('ℹ ffprobe nincs a PATH-on, az ffmpeg kimenetéből olvasom a metaadatokat.');
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
    if (VIDEO_EXT.has(ext)) videos.push({ base, slug, src: f, info, video: null, poster: null, portrait: info.portrait, duration: info.duration });
    else photos.push({ base, slug, src: f, info, image: null, portrait: info.portrait, square: info.square });
  } catch (e) {
    console.warn(`  !  kihagyva: ${base} – ${e.message}`);
  }
}
console.log(`▸ ${videos.length} videó, ${photos.length} fotó a forrásban (csak a kiosztottak kerülnek kódolásra).`);

/* ------------------------------------------------------------------ */
const manifest = JSON.parse(fs.readFileSync(BASE_MANIFEST, 'utf8'));
const map = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};
const report = [];

// név szerinti keresés: ugyanaz a forrásfájl több slotra is kiosztható (pl. hero loop + teljes film), csak megjelöljük használtnak
const findByName = (pool, name) => {
  const n = String(name).toLowerCase();
  const item = pool.find((x) => x.base.toLowerCase() === n || x.slug === slugify(name) || x.slug === slugify(path.parse(name).name));
  if (item) item.used = true;
  return item || null;
};
const takeVideo = (pref) => {
  const order = pref === 'portrait' ? [(v) => v.portrait, () => true] : [(v) => !v.portrait, () => true];
  for (const t of order) { const i = videos.findIndex((v) => !v.used && t(v)); if (i >= 0) return videos.splice(i, 1)[0]; }
  return null;
};
const takePhoto = (pref) => {
  const tests = {
    portrait: [(p) => p.portrait && !p.square, (p) => p.square, () => true],
    landscape: [(p) => !p.portrait && !p.square, (p) => p.square, () => true],
    square: [(p) => p.square, (p) => !p.portrait, () => true],
  }[pref];
  for (const t of tests) { const i = photos.findIndex((p) => !p.used && t(p)); if (i >= 0) return photos.splice(i, 1)[0]; }
  return null;
};
const setVideo = (slot, target, item, from) => {
  if (!item) return;
  delete target.todo;
  if (isUrl(item)) { target.url = item; report.push([slot, item, from]); return; }
  if (!item.video) Object.assign(item, encodeVideo(item.src, item.slug, item.info));
  Object.assign(target, { video: item.video, poster: item.poster, portrait: item.portrait, url: '' });
  report.push([slot, item.base, from]);
};
const setPhoto = (slot, target, item, from) => {
  if (!item) return;
  if (!item.image) Object.assign(item, encodePhoto(item.src, item.slug, item.info));
  target.image = item.image;
  report.push([slot, item.base, from]);
};

// 1) kézi kiosztás (media.map.json) – először, hogy a poolokból kikerüljenek
const mapVideo = (v) => {
  if (isUrl(v)) return v;
  const spec = typeof v === 'object' && v ? v : { file: v };
  if (isUrl(spec.file)) return spec.file;
  const item = findByName(videos, spec.file);
  if (!item) return null;
  if (spec.start != null || spec.duration != null || spec.mute || spec.crf || spec.maxHeight) {
    return { ...item, ...encodeVideo(item.src, item.slug, item.info, spec) };
  }
  return item;
};
const mapPhoto = (p) => {
  const spec = typeof p === 'object' && p ? p : { file: p };
  const item = findByName(photos, spec.file);
  if (!item) return null;
  if (spec.cropTop) return { ...item, ...encodePhoto(item.src, item.slug, item.info, spec) };
  return item;
};
if (map.hero) setVideo('hero', manifest.hero, mapVideo(map.hero), 'map');
if (map.showreel) setVideo('showreel', manifest.showreel, mapVideo(map.showreel), 'map');
// null a térképben = szándékosan üres slot: sárga „Videó kell” elem jelenik meg az oldalon, nincs automatikus kiosztás
const setTodo = (slot, target) => { Object.assign(target, { video: null, poster: null, url: '', todo: true }); report.push([slot, '(videó kell – sárga placeholder)', 'map']); };
(map.projects || []).forEach((v, i) => { if (!manifest.projects[i]) return; if (v === null) setTodo(`projects[${i}]`, manifest.projects[i]); else if (v) setVideo(`projects[${i}]`, manifest.projects[i], mapVideo(v), 'map'); });
(map.social || []).forEach((v, i) => { if (!manifest.social[i]) return; if (v === null) setTodo(`social[${i}]`, manifest.social[i]); else if (v) setVideo(`social[${i}]`, manifest.social[i], mapVideo(v), 'map'); });
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
const unused = [...videos, ...photos].filter((x) => !x.video && !x.image).length;
if (unused) console.log(`\n  ${unused} forrásfájl nem került az oldalra (nem lett kódolva).`);
console.log(`\n✔ Manifest kész: ${path.relative(ROOT, MANIFEST)}${DRY ? '  (dry run – kódolás nélkül)' : ''}`);
