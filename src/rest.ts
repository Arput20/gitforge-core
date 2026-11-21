import http from 'node:http';
import { sendJson, sendError } from './httpx.ts';
import { store, Repo } from './store.ts';

export async function handleRest(req: http.IncomingMessage, res: http.ServerResponse, urlParts: string[]) {
  const method = req.method;
  const path = urlParts.join('/');

  if (method === 'GET' && path === 'user/repos') {
    const repos = Array.from(store.repos.values());
    sendJson(res, 200, repos);
    return;
  }

  if (method === 'POST' && path === 'user/repos') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const repo: Repo = {
          id: Date.now(),
          owner: 'viewer', // Should be derived from token
          name: data.name,
          description: data.description || '',
          private: data.private || false,
          defaultBranch: 'main',
          createdAt: new Date().toISOString(),
          refs: new Map(),
          objects: new Map(),
          labels: new Map(),
          issues: [],
          pulls: [],
        };
        store.repos.set(`${repo.owner}/${repo.name}`, repo);
        sendJson(res, 201, repo);
      } catch {
        sendError(res, 400, 'Malformed JSON');
      }
    });
    return;
  }

  if (method === 'GET' && path.startsWith('repos/')) {
    const parts = path.split('/');
    if (parts.length === 3) {
      const repo = store.repos.get(`${parts[1]}/${parts[2]}`);
      if (repo) {
        sendJson(res, 200, repo);
      } else {
        sendError(res, 404, 'Not Found');
      }
      return;
    }
  }

  sendError(res, 404, 'Not Found');
}
