import { MESSAGES } from './i18n.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];

/** Első érintés attribúció: a landoláskor kapott UTM/gclid paramétereket elmentjük a session idejére. */
function captureAttribution() {
  const params = new URLSearchParams(location.search);
  let stored = {};
  try { stored = JSON.parse(sessionStorage.getItem('yep-attr') || '{}'); } catch (_) { /* noop */ }
  const fresh = {};
  ATTR_KEYS.forEach((k) => { const v = params.get(k); if (v) fresh[k] = v.slice(0, 200); });
  if (!stored.source_url) {
    fresh.source_url = location.href.slice(0, 2048);
    fresh.referrer = (document.referrer || '').slice(0, 2048) || null;
  }
  const merged = { ...stored, ...fresh };
  try { sessionStorage.setItem('yep-attr', JSON.stringify(merged)); } catch (_) { /* noop */ }
  return merged;
}

export function initForm({ config, lang }) {
  const form = document.getElementById('quote-form');
  if (!form) return;
  const msgs = MESSAGES[lang] || MESSAGES.hu;
  const status = document.getElementById('form-status');
  const success = document.getElementById('form-success');
  const submitBtn = form.querySelector('button[type="submit"]');
  const attribution = captureAttribution();
  const startedAt = Date.now(); // a szerveroldali „túl gyors beküldés” szűréshez

  const fieldWrap = (input) => input.closest('.field, .check');
  const clear = (input) => fieldWrap(input)?.classList.remove('is-invalid');
  form.querySelectorAll('input, select, textarea').forEach((i) => {
    i.addEventListener('input', () => { clear(i); status.textContent = ''; status.classList.remove('is-error'); });
    i.addEventListener('change', () => clear(i));
  });

  const validate = () => {
    const errors = [];
    const v = (n) => form.elements[n].value.trim();
    if (v('last_name').length < 2) errors.push([form.elements.last_name, msgs.required]);
    if (v('first_name').length < 2) errors.push([form.elements.first_name, msgs.required]);
    if (v('company').length < 2) errors.push([form.elements.company, msgs.required]);
    if (!EMAIL_RE.test(v('email'))) errors.push([form.elements.email, msgs.email]);
    if (v('phone').replace(/\D/g, '').length < 6) errors.push([form.elements.phone, msgs.phone]);
    if (v('project_intro').length < 3) errors.push([form.elements.project_intro, msgs.required]);
    if (!form.elements.consent.checked) errors.push([form.elements.consent, msgs.consent]);
    return errors;
  };

  const setLoading = (on) => {
    submitBtn.classList.toggle('is-loading', on);
    submitBtn.disabled = on;
  };

  const showError = (text) => {
    status.classList.add('is-error');
    status.innerHTML = '';
    status.append(`${text} `);
    const a = document.createElement('a');
    a.href = `mailto:${config.email}`;
    a.textContent = config.email;
    status.appendChild(a);
  };

  const showSuccess = () => {
    success.hidden = false;
    form.classList.add('is-sent');
    success.querySelector('h3')?.focus?.();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('is-error');

    // honeypot: robotok kitöltik → csendben „siker” (nincs átirányítás, nincs Lead)
    if (form.elements.website.value) { showSuccess(); return; }

    const errors = validate();
    if (errors.length) {
      errors.forEach(([input]) => fieldWrap(input)?.classList.add('is-invalid'));
      status.classList.add('is-error');
      status.textContent = errors[0][1];
      errors[0][0].focus();
      return;
    }

    const v = (n) => form.elements[n].value.trim();
    const payload = {
      name: `${v('last_name')} ${v('first_name')}`.trim().slice(0, 120),
      last_name: v('last_name').slice(0, 60),
      first_name: v('first_name').slice(0, 60),
      email: v('email').slice(0, 254),
      phone: v('phone').slice(0, 40),
      company: v('company').slice(0, 120),
      service: v('service').slice(0, 80) || null,
      project_intro: v('project_intro').slice(0, 300),
      consent: true,
      user_agent: navigator.userAgent.slice(0, 512),
      language: (navigator.language || '').slice(0, 16) || null,
      source_url: attribution.source_url || location.href.slice(0, 2048),
      referrer: attribution.referrer || null,
    };
    ATTR_KEYS.forEach((k) => { payload[k] = attribution[k] || null; });

    setLoading(true);
    status.textContent = msgs.sending;

    // két csatorna párhuzamosan: Supabase (mentés) + /api/contact (e-mail a Resenden át).
    // Ha legalább az egyik sikerül, az ajánlatkérés nem veszett el → siker.
    const saveToSupabase = async () => {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/${config.table}`, {
        method: 'POST',
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.json()).message || ''; } catch (_) { /* noop */ }
        throw new Error(`Supabase ${res.status} ${detail}`);
      }
    };
    const sendEmail = async () => {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, lang, startedAt, website: form.elements.website.value }),
      });
      if (!res.ok) throw new Error(`E-mail ${res.status}`);
    };

    try {
      const [db, mail] = await Promise.allSettled([saveToSupabase(), sendEmail()]);
      if (db.status === 'rejected') console.error('[yep] supabase save failed', db.reason);
      if (mail.status === 'rejected') console.error('[yep] e-mail notification failed', mail.reason);
      if (db.status === 'rejected' && mail.status === 'rejected') throw new Error('both channels failed');
      status.textContent = '';
      // Meta Pixel Lead: a köszönőoldal küldi el, csak ha ez a jelző ott van (közvetlen megnyitás / frissítés nem számít leadnek)
      try { sessionStorage.setItem('yep-lead-pending', '1'); } catch (_) { /* noop */ }
      try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'quote_request_submitted' }); } catch (_) { /* noop */ }
      location.assign(lang === 'en' ? '/koszonjuk?lang=en' : '/koszonjuk');
    } catch (err) {
      console.error('[yep] quote request failed', err);
      showError(msgs.error);
    } finally {
      setLoading(false);
    }
  });
}
