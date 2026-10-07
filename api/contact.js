/**
 * Ajánlatkérő űrlap → e-mail értesítés a Resend API-n keresztül (Vercel Function, POST /api/contact).
 * A beküldést a kliens a Supabase-be is elmenti; ez a végpont csak az e-mailt küldi.
 *
 * Spam-védelem (RESEND-FORM-GUIDE.md alapján):
 *  1. honeypot mező ("website") – ha ki van töltve, csendben sikert jelzünk, de nem küldünk
 *  2. kitöltési idő – 3 mp-nél gyorsabb beküldés gyanús
 *  3. IP-alapú rate limit (5 üzenet / 10 perc / példány)
 *
 * Környezeti változók (Vercel → Settings → Environment Variables, módosítás után Redeploy):
 *  RESEND_API_KEY      – Resend API kulcs (Sending access)
 *  CONTACT_TO_EMAIL    – címzett, alapból info@yepcontent.com
 *  CONTACT_FROM_EMAIL  – feladó, KÖTELEZŐEN Resendben hitelesített domainről
 */

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const rate = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = rate.get(ip);
  if (!entry || entry.reset < now) {
    rate.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'invalid_json' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'invalid_json' });

  const lastName = str(body.last_name, 60);
  const firstName = str(body.first_name, 60);
  const company = str(body.company, 120);
  const email = str(body.email, 254);
  const phone = str(body.phone, 40);
  const intro = str(body.project_intro, 300);
  const service = str(body.service, 80);
  const consent = body.consent === true;
  const honeypot = str(body.website, 200);
  const startedAt = typeof body.startedAt === 'number' ? body.startedAt : 0;

  // 1. honeypot – a botnak sikert jelzünk, de nem küldünk semmit
  if (honeypot) return res.status(200).json({ ok: true });

  // 2. túl gyors kitöltés
  if (!startedAt || Date.now() - startedAt < 3000) {
    return res.status(429).json({ ok: false, error: 'too_fast' });
  }

  // 3. rate limit
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  // validáció – ugyanazok a szabályok, mint a kliensen (src/modules/form.js)
  if (
    lastName.length < 2 || firstName.length < 2 || company.length < 2 ||
    !EMAIL_RE.test(email) || phone.replace(/\D/g, '').length < 6 ||
    intro.length < 3 || !consent
  ) {
    return res.status(422).json({ ok: false, error: 'validation' });
  }

  const name = `${lastName} ${firstName}`;
  const attr = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']
    .map((k) => [k, str(body[k], 200)])
    .filter(([, v]) => v);
  const sourceUrl = str(body.source_url, 2048);
  const referrer = str(body.referrer, 2048);
  const lang = str(body.lang, 8);

  const rows = [
    ['Név', name],
    ['Cégnév', company],
    ['E-mail', email],
    ['Telefon', phone],
    ['Miről szól a projekt?', intro],
    service && ['Szolgáltatás', service],
    lang && ['Nyelv', lang.toUpperCase()],
    sourceUrl && ['Oldal', sourceUrl],
    referrer && ['Honnan jött', referrer],
    ...attr,
  ].filter(Boolean);

  const text = ['Új ajánlatkérés érkezett a YEP Content weboldalról', '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `IP: ${ip}`].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p style="margin:0 0 16px"><strong>Új ajánlatkérés érkezett a YEP Content weboldalról</strong></p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
${rows.map(([k, v]) => `<tr><td style="color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('\n')}
</table>
<p style="margin:16px 0 0;color:#888;font-size:12px">A „Válasz” gombbal közvetlenül a kitöltőnek írhatsz. IP: ${esc(ip)}</p>
</div>`;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL || 'info@yepcontent.com';
  const from = process.env.CONTACT_FROM_EMAIL || 'YEP Content weboldal <noreply@web.kzhdigital.com>';

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL_ENV) {
      console.info('[contact] RESEND_API_KEY nincs beállítva – fejlesztői módban csak naplózzuk:\n' + text);
      return res.status(200).json({ ok: true, dev: true });
    }
    console.error('[contact] RESEND_API_KEY missing');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email, // a „Válasz” gombra a kitöltő címe jön be
        subject: `Új ajánlatkérés – ${name} (${company})`,
        text,
        html,
      }),
    });
    if (!r.ok) {
      console.error('[contact] Resend error', r.status, await r.text());
      return res.status(502).json({ ok: false, error: 'send_failed' });
    }
    const data = await r.json().catch(() => ({}));
    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('[contact] Resend request failed', err);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
}
