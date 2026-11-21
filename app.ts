import http from 'node:http';
import { sendJson, sendError } from './src/httpx.ts';
import { handleRest } from './src/rest.ts';

export function createApp() {
  return http.createServer(async (req, res) => {
    const url = req.url || '/';

    if (url === '/healthz' && req.method === 'GET') {
      sendJson(res, 200, { ok: true });
      return;
    }

    // Auth check
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      sendError(res, 401, 'Unauthorized');
      return;
    }

    if (url.startsWith('/api/v3')) {
      const parts = url.split('/').filter(p => p !== '');
      // parts[0] is 'api', parts[1] is 'v3'
      await handleRest(req, res, parts.slice(2));
      return;
    }

    sendError(res, 404, 'Not Found');
  });
}
