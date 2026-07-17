import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

// The repo to analyze and where its .planmap store lives. Defaults to the bundled
// sample org so the app opens to a populated map (A8); override to point at your own.
const repoRoot = process.env.PLANMAP_REPO ?? join(here, '..', '..', 'examples', 'sample-org');
const storeRoot = process.env.PLANMAP_STORE ?? repoRoot;

/**
 * Serves the PlanMap API from the dev server. The request handler is loaded via
 * Vite's SSR module runner (not a static import) so the engine and ts-morph run as
 * real Node modules instead of being bundled into the config.
 */
function planmapApi(): PluginOption {
  return {
    name: 'planmap-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/')) {
          next();
          return;
        }
        server
          .ssrLoadModule('/server/handler.ts')
          .then((mod) => mod.handle(req, res, { repoRoot, storeRoot }))
          .catch((err) => {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), planmapApi()],
  server: { port: 5173 },
});
