import '@fontsource-variable/sora';
import '@fontsource/covered-by-your-grace';
import './styles/main.css';

import { config } from './config.js';
import { initI18n } from './modules/i18n.js';
import { applyMedia } from './modules/media.js';
import { initUI } from './modules/ui.js';
import { initForm } from './modules/form.js';
import { initAnimations } from './modules/animations.js';

const lang = initI18n();   // szövegek nyelv szerint (a splitting előtt kell)
applyMedia({ lang });      // média slotok kitöltése a manifestből (null slot → „Videó kell” csempe)
initUI({ config, lang });  // nav, menü, modal, lazy videók, kurzor
initForm({ config, lang }); // ajánlatkérő → Supabase
initAnimations();          // GSAP: preloader, hero, scroll reveal-ek
