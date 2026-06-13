import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In `vite dev`, serve the Vercel-style serverless function at /api/draft-application
// so the form-draft works locally. Needs ANTHROPIC_API_KEY in the dev server's env:
//   set -a; . ../.env; set +a; npm run dev
// (In production, Vercel runs app/api/*.js natively — this middleware is dev-only.)
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/draft-application', async (req, res) => {
        const send = (code, obj) => {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(obj));
        };
        if (req.method !== 'POST') return send(405, { error: 'POST only' });
        try {
          const chunks = [];
          for await (const c of req) chunks.push(c); // resolves immediately if body already ended
          req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
          const mod = await import('../api/draft-application.js');
          await mod.default(req, { status: (c) => ({ json: (o) => send(c, o) }) });
        } catch (e) {
          send(500, { error: String(e?.message || e) });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  server: { fs: { allow: ['..'] } },
});
