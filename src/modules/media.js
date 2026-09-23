import manifest from '../media.manifest.json';
import { MESSAGES } from './i18n.js';

const get = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), manifest);

export function getMedia(path) {
  return get(path);
}

/** Kitölti a [data-media] slotokat a manifest alapján. A nem-hero videók lazy módon (data-src) töltődnek. */
export function applyMedia({ lang = 'hu' } = {}) {
  const msgs = MESSAGES[lang] || MESSAGES.hu;
  document.querySelectorAll('[data-media]').forEach((el) => {
    const src = get(el.dataset.media);
    const entry = get(el.dataset.media.split('.').slice(0, -1).join('.'));
    if (el.tagName === 'VIDEO' && entry && entry.todo) { replaceWithTodo(el, msgs.todoVideo); return; }
    const poster = el.dataset.poster ? get(el.dataset.poster) : null;

    if (el.tagName === 'VIDEO') {
      if (poster) el.poster = poster;
      if (!src) return;
      // data-eager: azonnal betölt, de nem indul el (a hero videót a betöltő animáció indítja el a függöny előtt)
      if (el.hasAttribute('autoplay') || el.hasAttribute('data-eager')) el.src = src;
      else el.dataset.src = src;
      // ha a videó nem játszható (hiányzó fájl, nem támogatott kodek), a poszter marad képként
      el.addEventListener('error', () => {
        if (!poster) return;
        const img = document.createElement('img');
        img.src = poster;
        img.alt = '';
        img.loading = 'lazy';
        el.replaceWith(img);
      }, { once: true });
    } else if (el.tagName === 'IMG') {
      if (src) el.src = src;
      el.addEventListener('error', () => { el.style.visibility = 'hidden'; }, { once: true });
    }
  });
}

/** Sárga „Videó kell” csempe a még hiányzó videók helyére; a kártya nem nyit modalt. */
function replaceWithTodo(el, label) {
  const tile = document.createElement('div');
  tile.className = 'todo-media';
  tile.setAttribute('role', 'note');
  tile.innerHTML = `<div class="todo-media__in"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 8.5 4 5l14.5 2.2-.9 3.3H3Zm0 1.5h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9Zm4.4-3.6 2.9.4.6-2.1-2.9-.4-.6 2.1Zm4.9.7 2.9.5.6-2.1-2.9-.5-.6 2.1Z"/></svg><span class="todo-media__label">${label}</span></div>`;
  const card = el.closest('[data-open-video]');
  el.replaceWith(tile);
  if (card) {
    card.classList.add('is-todo');
    card.removeAttribute('data-open-video');
    card.removeAttribute('data-cursor');
  }
}
