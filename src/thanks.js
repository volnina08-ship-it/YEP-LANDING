// Köszönőoldal (/koszonjuk): betűtípus + közös stílus, nyelv a főoldal választása szerint.
import '@fontsource-variable/sora';
import './styles/main.css';
import { detectLang } from './modules/i18n.js';

const EN = {
  eyebrow: 'Request sent',
  title: 'Thank you, we got it!',
  text: "We'll be in touch shortly with the details. Questions in the meantime? Write to us: ",
  home: 'Back to the homepage',
};

const lang = detectLang();
document.documentElement.lang = lang;
document.documentElement.dataset.lang = lang;
if (lang === 'en') {
  document.title = 'Thank you! – YEP Content';
  document.querySelectorAll('[data-t]').forEach((el) => {
    const t = EN[el.dataset.t];
    if (t == null) return;
    const link = el.querySelector('a');
    el.textContent = t;
    if (link) el.appendChild(link);
  });
  document.querySelectorAll('[data-home], .thanks__logo').forEach((a) => { a.href = '/?lang=en'; });
}
