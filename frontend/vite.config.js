import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, les appels /api sont redirigés vers le serveur Node.js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:4100' },
  },
});
