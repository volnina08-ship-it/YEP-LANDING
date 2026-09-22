# YEP Content – PPC landing page

Sötét, filmes, animált landing page ajánlatkérő űrlappal. A hirdetési (PPC) forgalom ide érkezik, a cél az ajánlatkérés.

**Stack:** Vite · vanilla JS · GSAP 3 (ScrollTrigger + SplitText) · Supabase (REST, RLS) · saját hosztolt betűk (Sora, Covered By Your Grace)

## Indítás

```bash
npm install
npm run dev        # fejlesztői szerver
npm run build      # produkciós build → dist/
npm run preview    # a build megtekintése
```

Deploy: bármilyen statikus hoszt (Vercel, Netlify, Cloudflare Pages). Build parancs `npm run build`, kimeneti mappa `dist`.

## Média – a Dropbox referenciák beemelése

Az oldal most generált, sötét **placeholder** képekkel és loopokkal fut (`public/media/placeholders`). A valódi anyagok beemelése két parancs:

```bash
npm run media:fetch   # letölti és kicsomagolja a Dropbox mappát → public/media/source
npm run media         # ffmpeg: webre optimalizál + slotok kiosztása + src/media.manifest.json
```

Feltétel: `ffmpeg` és `ffprobe` a gépen (macOS: `brew install ffmpeg`).

Mit csinál a `npm run media`?

- videó → h264 mp4, max 1080p, `faststart`, hang megtartva, poszter jpg (`public/media/video/`)
- fotó → jpg, max 2000 px (`public/media/photo/`)
- fekvő videók sorrendben: **hero**, **showreel**, majd a 4 **projekt**; álló (9:16) videók: **social** csík
- álló fotók: **rólunk**, **vélemény**; fekvő fotók: **szolgáltatás** kártyák, **CTA**; a maradék a **galériába**
- amire nem jut anyag, ott marad a placeholder

Kézi kiosztás: nevezd át a `public/media/media.map.example.json` fájlt `media.map.json`-ra és írd bele a fájlneveket. Videó slotnál **YouTube/Vimeo URL** is adható (a modal beágyazva játssza le). Nagy videókat érdemes külső tárhelyre tenni (Supabase Storage, R2, Bunny) – a manifestben abszolút URL is használható.

## Ajánlatkérő űrlap – Supabase

- Projekt: `https://qelmzmzpicsdaiagitsa.supabase.co`, tábla: `public.quote_requests`
- Séma és RLS: `supabase/migrations/0001_quote_requests.sql` (a projektre már alkalmazva)
- A publikus kulcs csak **beszúrni** tud (RLS), olvasni a Supabase dashboardon (Table Editor) vagy bejelentkezett felhasználóként lehet
- Mezők: név, e-mail, telefon, cég, érdeklődés (select), keret (select), **projekt bevezető (1 sor)**, üzenet, hozzájárulás
- Automatikusan mentett attribúció: `utm_*`, `gclid`, `fbclid`, forrás URL, referrer, nyelv, user agent
- `status` oszlop a belső követéshez: `new → contacted → quoted → won / lost`
- Spam ellen: honeypot mező + DB-szintű ellenőrzések (hossz, e-mail formátum)
- Sikeres küldéskor `dataLayer.push({ event: 'quote_request_submitted' })` – Google Tag Manager triggerhez / Ads konverzióhoz

E-mail értesítés új ajánlatkérésről: Supabase → Database Webhooks → `insert` a `quote_requests` táblán → Resend / Make / Zapier.

## Beállítások

`src/config.js` – vagy `.env` (minta: `.env.example`):

| Kulcs | Mire való |
| --- | --- |
| `bookingUrl` / `VITE_BOOKING_URL` | Időpontfoglaló (pl. Calendly). Üresen az „Időpontot foglalok” gombok az űrlapra görgetnek |
| `email` / `VITE_CONTACT_EMAIL` | Kapcsolati e-mail (űrlap mellett + hibaüzenetben) |
| `links.about`, `links.projects` | „Tovább a rólunkhoz”, „Összes projekt” célja (üresen a link elrejtődik) |
| `socials.*` | Instagram / LinkedIn / YouTube (üresen elrejtődik) |

Nyelv: az oldal magyar, `?lang=en` paraméterrel angol (`src/modules/i18n.js`). A választás a böngészőben megjegyződik.

## Szerkezet

```
index.html                 – teljes oldal (szövegek 1:1 a design szerint)
src/styles/main.css        – design rendszer, szekciók, reszponzív
src/modules/animations.js  – preloader, hero intro, scroll reveal-ek, split headline-ok, szekció átmenetek
src/modules/ui.js          – nav, teljes képernyős menü, videó modal, lazy autoplay, PLAY kurzor
src/modules/form.js        – validáció, attribúció, Supabase insert
src/modules/media.js       – manifest → [data-media] slotok
src/media.manifest.json    – az aktuális média kiosztás (generált)
scripts/build-media.mjs    – média pipeline
scripts/fetch-dropbox.sh   – Dropbox letöltés
public/logo.svg            – a kézírásos YEP logó (SVG path, bármikor cserélhető)
```

## Megjegyzések

- A logó a design alapján újrarajzolt vektor; ha megvan az eredeti SVG/PNG, elég a `public/logo.svg` cseréje (fehér, átlátszó háttér).
- A hero két gombja a brief szerint: „Ajánlatot kérek” (űrlap) és „További info” (görget). Az „Időpontot foglalok” / „E-mail árajánlatot kérek” gombpár a fejlécben és a CTA szekcióban van.
- A mozgás szándékosan visszafogott: csak szöveg-, szekció- és scroll-alapú animációk vannak, a videók nem mozognak.
