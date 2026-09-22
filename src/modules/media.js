import manifest from '../media.manifest.json';

const get = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), manifest);

export function getMedia(path) {
  return get(path);
}

/** Kitölti a [data-media] slotokat a manifest alapján. A nem-hero videók lazy módon (data-src) töltődnek. */
export function applyMedia() {
  document.querySelectorAll('[data-media]').forEach((el) => {
    const src = get(el.dataset.media);
    const poster = el.dataset.poster ? get(el.dataset.poster) : null;

    if (el.tagName === 'VIDEO') {
      if (poster) el.poster = poster;
      if (!src) return;
      if (el.hasAttribute('autoplay')) el.src = src;
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
