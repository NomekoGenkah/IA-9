import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static, self-contained build (no backend). `base` matches the GitHub Pages
// path: https://<user>.github.io/IA-9/ . Override with VITE_BASE if needed.
export default defineConfig({
  base: process.env.VITE_BASE || '/IA-9/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
