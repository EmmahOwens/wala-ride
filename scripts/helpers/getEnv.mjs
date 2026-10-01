import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export function getSupabaseCredentials() {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const envCandidates = [
      path.join(rootDir, '.env.local'),
      path.join(rootDir, '.env'),
    ];

    let envServiceKey = null;
    let envAnonKey = null;

    for (const envFile of envCandidates) {
      if (fs.existsSync(envFile)) {
        try {
          const content = fs.readFileSync(envFile, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const k = trimmed.substring(0, eqIdx).trim();
            const v = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!url && (k === 'VITE_SUPABASE_URL' || k === 'SUPABASE_URL')) {
              url = v;
            }
            if (k === 'SUPABASE_SERVICE_ROLE_KEY') {
              envServiceKey = v;
            } else if (k === 'VITE_SUPABASE_ANON_KEY' || k === 'SUPABASE_ANON_KEY') {
              if (!envAnonKey) envAnonKey = v;
            }
          }
        } catch (_err) {
          // Ignore read errors
        }
      }
    }
    if (!key) {
      key = envServiceKey || envAnonKey;
    }
  }

  return {
    url: url || 'http://127.0.0.1:54321',
    key: key || '',
  };
}
