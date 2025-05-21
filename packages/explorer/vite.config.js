import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  plugins: [vue(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname)
    }
  },
  build: {
    outDir: 'dist/client'
  }
});
