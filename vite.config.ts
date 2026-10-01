import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Middleware plugin to rewrite /driver and /admin routes to their respective HTML files during local dev
function mpaDevRewrites() {
  return {
    name: 'mpa-dev-rewrites',
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        const url = req.url || '';
        if (url.startsWith('/admin') && !url.includes('.')) {
          req.url = '/admin.html';
        } else if (url.startsWith('/driver') && !url.includes('.')) {
          req.url = '/driver.html';
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'SUPABASE_']);

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    '';

  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    '';

  return {
    plugins: [react(), mpaDevRewrites()],
    build: {
      rollupOptions: {
        input: {
          passenger: resolve(import.meta.dirname, 'index.html'),
          driver: resolve(import.meta.dirname, 'driver.html'),
          admin: resolve(import.meta.dirname, 'admin.html'),
        },
      },
    },
    envPrefix: ['VITE_', 'SUPABASE_'],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  };
});
