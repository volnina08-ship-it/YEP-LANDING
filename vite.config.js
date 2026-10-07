import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  server: { host: true },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: {
      // oldalak: a landing, a betöltő-előnézet (/loader-preview.html) és a köszönőoldal (/koszonjuk)
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        loaderPreview: fileURLToPath(new URL('./loader-preview.html', import.meta.url)),
        thanks: fileURLToPath(new URL('./koszonjuk.html', import.meta.url)),
      },
      output: {
        manualChunks: { gsap: ['gsap', 'gsap/ScrollTrigger', 'gsap/SplitText'] },
      },
    },
  },
});
