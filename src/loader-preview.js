// Betöltő-előnézet: a három felfestődő logó egymás mellett, újrajátszással és lassítással.
import '@fontsource-variable/sora';
import gsap from 'gsap';
import { mountLogo, logoTimeline } from './modules/loader.js';

let speed = 1;
const cards = Array.from(document.querySelectorAll('.card')).map((card) => {
  const mount = mountLogo(card.querySelector('.mount'), card.dataset.variant);
  const tl = logoTimeline(mount, { paused: true });
  const screen = card.querySelector('.screen');
  const replay = () => tl.timeScale(speed).restart();
  screen.addEventListener('click', replay);
  screen.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); replay(); } });
  return { tl, replay };
});

document.querySelectorAll('[data-speed]').forEach((b) => {
  b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('is-on', x === b));
    cards.forEach(({ tl }) => tl.timeScale(speed));
  });
});
document.getElementById('replay-all').addEventListener('click', () => {
  cards.forEach(({ replay }, i) => gsap.delayedCall(i * 0.6, replay));
});

// indítás egymás után, hogy külön-külön is látszódjanak
cards.forEach(({ tl }, i) => gsap.delayedCall(0.4 + i * 0.7, () => tl.timeScale(speed).play(0)));
window.__loaderCards = cards; // előnézeti/teszt hozzáférés
