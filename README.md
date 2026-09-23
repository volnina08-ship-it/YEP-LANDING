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

## Média – a Dropbox referenciák

Az oldal a Dropbox referencia-mappából válogatott, webre optimalizált anyagokkal fut (`public/media/video`, `public/media/photo`). A kiosztást a `public/media/media.map.json` írja le, ezt szerkesztve cserélhető bármelyik slot.

| Slot | Forrás (Dropbox) |
| --- | --- |
| Hero háttérloop | `MERCAR_TVC_edit_5.mp4` első 21,5 mp, némítva |
| Showreel (modal) | `KIEG/UJ NYERS/yep showreel.mov` |
| Projekt: Dominik Szoboszlai | `Sport/2023_11_19_Szoboszlai_EB_v3.mov` (álló) |
| Projekt: FBC | `Restaurant/domPerignon_product_v2.mp4` (álló) – cserélendő, ha van FBC-anyag |
| Projekt: Clark | `Documentary/Kimpton - Trailer 1st Episode - v5.mp4` – cserélendő a Clark-filmre |
| Projekt: Market Építő | `Construction:Interior/BudaPart projekt.mov` |
| Social csík (5) | Cupra 9:16, Bigfish vertical, TikTok (3), million roses, Szoboszlai díjátadó – 20 mp-es némított részletek |
| Rólunk / CTA | `KIEG/YEP BTS` werkfotók |
| Vélemény | `PHOTOS/Image/JodokCello_YepContent-88.jpg` (Al Habtoor lépcső) |
| Szolgáltatások, galéria | `PHOTOS/Cars`, `Product`, `Events`, `Hotel`, `Image`, `Restaurants`, `Architect` válogatás |
| Partner logók | `KIEG/Ref logók` fehér monokróm változatban (`public/media/clients`) |

Újrafuttatás / csere:

```bash
npm run media:fetch   # a teljes Dropbox mappa letöltése (kb. 17 GB!) – vagy csak a kellő fájlokat másold a public/media/source alá
npm run media         # ffmpeg: csak a media.map.json-ban kiosztott fájlokat kódolja, majd frissíti a src/media.manifest.json-t
```

Feltétel: `ffmpeg` és `ffprobe` a gépen (macOS: `brew install ffmpeg`).

A `media.map.json` videó bejegyzése lehet fájlnév, YouTube/Vimeo URL, vagy objektum: `{"file": "x.mp4", "start": 3, "duration": 15, "mute": true, "crf": 26, "maxHeight": 1080}` (vágás másodpercben, némítás, minőség). Amire nem jut anyag, ott a `public/media/placeholders` generált képei maradnak.

## Ajánlatkérő űrlap – Supabase

- Projekt: `https://qelmzmzpicsdaiagitsa.supabase.co`, tábla: `public.quote_requests`
- Séma és RLS: `supabase/migrations/0001_quote_requests.sql` (a projektre már alkalmazva)
- A publikus kulcs csak **beszúrni** tud (RLS), olvasni a Supabase dashboardon (Table Editor) vagy bejelentkezett felhasználóként lehet
- Mezők a referencia oldal űrlapjával megegyezően: vezetéknév, keresztnév, cégnév, email, telefonszám (mind kötelező) + **projekt bevezető (1 sor)**, hozzájárulás; a szolgáltatás-kártyák „Tovább” linkje rejtett mezőben elmenti, melyik kártyáról jött a lead
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

- A logó a yepcontent.info logójából vektorizált SVG: `public/logo.svg` (teljes, „YEP! Content Production”), `public/logo-mark.svg` (csak a sárga „YEP!”, navigáció és vízjel), `public/favicon.svg`.
- A hero két gombja a brief szerint: „Ajánlatot kérek” (űrlap) és „További info” (görget). Az „Időpontot foglalok” / „E-mail árajánlatot kérek” gombpár a fejlécben és a CTA szekcióban van.
- A mozgás szándékosan visszafogott: csak szöveg-, szekció- és scroll-alapú animációk vannak, a videók nem mozognak.
