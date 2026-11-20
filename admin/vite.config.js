import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The shop server hosts the built app (website + admin panel) at the root (see server/index.js).
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { port: 5173 },
});
