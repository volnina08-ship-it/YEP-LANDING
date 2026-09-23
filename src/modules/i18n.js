// HU az alap (a szövegek a HTML-ben vannak). EN: ?lang=en
const EN = {
  'nav.projects': 'Projects', 'nav.services': 'Services', 'nav.about': 'About', 'nav.contact': 'Contact', 'nav.book': 'Book a call',
  'hero.eyebrow': 'YEP Content', 'hero.l1': 'Bigger', 'hero.l2': 'stories for', 'hero.l3': 'stronger', 'hero.l4': 'brands',
  'hero.lead': 'Commercials, campaigns and social content, from concept to final cut.',
  'hero.cta1': 'Get a quote', 'hero.cta2': 'Learn more', 'hero.play1': 'Watch our', 'hero.play2': 'showreel',
  'stats.years': 'years of experience', 'stats.films': 'films', 'stats.brands': 'Hungarian brands', 'stats.intl': 'international brands',
  'marquee.1': 'Commercials', 'marquee.2': 'Social content', 'marquee.3': 'Campaign photography', 'marquee.4': 'TikTok', 'marquee.5': 'Events', 'marquee.6': 'Marketing', 'marquee.7': 'Animation',
  'about.eyebrow': "We don't just make videos.",
  'about.title': 'Content that keeps working for your brand in the long run.',
  'about.text': 'Good content is more than reach or clicks. It sets you apart, builds credibility and creates real business value.',
  'about.link': 'More about us',
  'services.eyebrow': 'Our services', 'services.title': 'Three fields. One mindset.',
  'services.note': 'Every platform is different, but the goal is the same: quality content that creates real value.',
  'services.1.title': 'Commercials & campaigns', 'services.1.text': "Big ideas, meticulous execution. A cinematic canvas for your brand's story.",
  'services.2.title': 'Social content', 'services.2.text': 'TikTok, Reels, Shorts. Fast, native, no compromises.',
  'services.3.title': 'Events', 'services.3.text': "Aftermovies, interviews, backstage. Your event doesn't end on site.",
  'services.more': 'More',
  'projects.eyebrow': 'Featured projects', 'projects.title': "A few stories we're proud of.", 'projects.all': 'All projects',
  'projects.1.sub': 'Social film', 'projects.2.sub': 'Commercial', 'projects.3.sub': 'Image film', 'projects.4.sub': 'Documentary',
  'gallery.eyebrow': 'Photo',
  'quote.text': '“YEP delivered a level of quality you rarely see in Hungary. A creative, professional and reliable team.”',
  'cta.eyebrow': 'Next step', 'cta.title': "Got a project? Let's talk.",
  'cta.text': 'Book a 30-minute consultation or request a quote by e-mail.',
  'cta.book': 'Book a call', 'cta.mail': 'Request a quote by e-mail',
  'form.eyebrow': 'Quote', 'form.title': 'Request a quote.',
  'form.text': "Tell us briefly about your project and we'll get back to you with a tailored offer.",
  'form.p1': 'Commercials, social content, events', 'form.p2': 'From concept to final cut', 'form.p3': 'Budapest – Hungary',
  'form.lastname': 'Last name *', 'form.firstname': 'First name *', 'form.company': 'Company *', 'form.email': 'Email *', 'form.phone': 'Phone *',
  'form.intro': 'What is the project about? *',
  'form.intro.ph': 'E.g. a brand film for a new product, October',
  'form.consent': 'I agree that YEP Content may process my data for the purpose of this quote request.',
  'form.submit': 'Request a quote',
  'form.success.title': 'Thank you, we got it!',
  'form.success.text': "We'll be in touch shortly with the details. Meanwhile, take a look at our work.",
  'form.success.link': 'Projects',
};

export const MESSAGES = {
  hu: {
    required: 'Kérjük, töltsd ki ezt a mezőt.',
    email: 'Kérjük, adj meg egy érvényes e-mail címet.',
    phone: 'Kérjük, adj meg egy telefonszámot.',
    consent: 'Az adatkezelési hozzájárulás szükséges a küldéshez.',
    sending: 'Küldés…',
    error: 'Hiba történt a küldés közben. Próbáld újra, vagy írj nekünk:',
    showreel: 'Showreel',
    todoVideo: 'Videó kell',
  },
  en: {
    required: 'Please fill in this field.',
    email: 'Please enter a valid e-mail address.',
    phone: 'Please enter a phone number.',
    consent: 'Consent is required to send the request.',
    sending: 'Sending…',
    error: 'Something went wrong. Please try again or e-mail us:',
    showreel: 'Showreel',
    todoVideo: 'Video needed',
  },
};

const META = {
  en: {
    title: 'YEP Content – Bigger stories for stronger brands',
    description: 'Commercials, campaigns and social content, from concept to final cut. Request a quote from the YEP Content team.',
  },
};

export function detectLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'hu') {
    try { localStorage.setItem('yep-lang', q); } catch (_) { /* noop */ }
    return q;
  }
  try { return localStorage.getItem('yep-lang') === 'en' ? 'en' : 'hu'; } catch (_) { return 'hu'; }
}

export function initI18n() {
  const lang = detectLang();
  const root = document.documentElement;
  root.lang = lang;
  root.dataset.lang = lang;

  // nyelvváltó linkek: megtartjuk a meglévő query paramétereket (UTM stb.)
  document.querySelectorAll('[data-lang-link]').forEach((a) => {
    const url = new URL(location.href);
    url.searchParams.set('lang', a.dataset.langLink);
    url.hash = '';
    a.href = url.pathname + url.search;
    a.classList.toggle('is-active', a.dataset.langLink === lang);
  });

  if (lang === 'en') {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const t = EN[el.dataset.i18n];
      if (t != null) el.textContent = t;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const t = EN[el.dataset.i18nPh];
      if (t != null) el.placeholder = t;
    });
    document.title = META.en.title;
    const d = document.querySelector('meta[name="description"]');
    if (d) d.content = META.en.description;
    document.querySelector('.modal__close')?.setAttribute('aria-label', 'Close');
  }
  return lang;
}
