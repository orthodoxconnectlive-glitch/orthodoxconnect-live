import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, UserConfig, Plugin } from 'vite';
import worker from './src/worker';
import { getDevD1Database } from './src/dev-d1';

function cloudflareWorkerDevPlugin(): Plugin {
  return {
    name: 'cloudflare-worker-dev-middleware',
    configureServer(server) {
      const devD1 = getDevD1Database();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        try {
          const host = req.headers.host || 'localhost:3000';
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const fullUrl = `${protocol}://${host}${req.url}`;

          // Read body for non-GET/HEAD methods
          let bodyBuffer: Buffer | undefined = undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            if (chunks.length > 0) {
              bodyBuffer = Buffer.concat(chunks);
            }
          }

          // Build web Request for Cloudflare Worker
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value !== undefined) {
              if (Array.isArray(value)) {
                value.forEach((v) => headers.append(key, v));
              } else {
                headers.set(key, String(value));
              }
            }
          }

          const webRequest = new Request(fullUrl, {
            method: req.method || 'GET',
            headers,
            body: bodyBuffer,
            // @ts-ignore
            duplex: 'half',
          });

          const env = {
            DB: devD1,
            BUNNY_LIBRARY_ID: process.env.VITE_BUNNY_LIBRARY_ID || '713265',
            BUNNY_API_KEY: process.env.VITE_BUNNY_API_KEY || '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd',
            BUNNY_CDN_HOST: process.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net',
          };

          const executionCtx = {
            waitUntil(_promise: Promise<any>) {},
            passThroughOnException() {},
          };

          const response = await worker.fetch(webRequest, env, executionCtx);

          // Write Worker Response to Node http Response
          res.statusCode = response.status;
          response.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });

          const responseBuffer = await response.arrayBuffer();
          res.end(Buffer.from(responseBuffer));
        } catch (err: any) {
          console.error('[Worker Dev Middleware Error]:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Internal Dev Server Error' }));
          }
        }
      });
    },
  };
}

export default defineConfig((): UserConfig => {
  return {
    base: '/',
    build: {
      outDir: 'dist',
    },
    plugins: [react(), tailwindcss(), cloudflareWorkerDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
