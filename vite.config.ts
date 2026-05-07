import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { handler } from './netlify/functions/api';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'netlify-functions-emulator',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/')) {
              try {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const body = await new Promise<string>((resolve) => {
                  let data = '';
                  req.on('data', chunk => data += chunk);
                  req.on('end', () => resolve(data));
                });

                const event: any = {
                  httpMethod: req.method,
                  path: req.url,
                  rawUrl: `http://${req.headers.host}${req.url}`,
                  headers: req.headers,
                  body,
                  queryStringParameters: Object.fromEntries(url.searchParams)
                };

                const result: any = await handler(event, {} as any);
                
                res.statusCode = result.statusCode || 200;
                Object.entries(result.headers || {}).forEach(([key, val]) => {
                  res.setHeader(key, val as string);
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(result.body);
                return;
              } catch (error) {
                console.error('Function execution error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Internal server error' }));
                return;
              }
            }
            next();
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
