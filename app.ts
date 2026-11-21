import http from 'node:http';
import { sendJson, sendError } from './src/httpx';

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

    if (url.startsWith('/api/v3') && req.method === 'GET') {
      if (url === '/api/v3' || url === '/api/v3/') {
        res.setHeader('X-OAuth-Scopes', 'repo, read:org');
        sendJson(res, 200, { message: 'GitHub API v3' });
        return;
      }
      if (url === '/api/v3/meta') {
        sendJson(res, 200, { installed_version: '1.0.0' });
        return;
      }
    }

    sendError(res, 404, 'Not Found');
  });
}
