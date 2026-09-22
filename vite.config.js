import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: { gsap: ['gsap', 'gsap/ScrollTrigger', 'gsap/SplitText'] },
      },
    },
  },
});
