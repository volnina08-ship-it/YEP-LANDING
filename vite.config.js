import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  server: { host: true },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: {
      // két oldal: a landing + a betöltő-előnézet (/loader-preview.html)
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        loaderPreview: fileURLToPath(new URL('./loader-preview.html', import.meta.url)),
      },
      output: {
        manualChunks: { gsap: ['gsap', 'gsap/ScrollTrigger', 'gsap/SplitText'] },
      },
    },
  },
});
