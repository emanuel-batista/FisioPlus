import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.task'],
  server: {
    port: 3000,
    open: true
  }
});
