import http from 'node:http';
import { buildScenario } from './src/scenario.ts';
import { createBlob, createTree, createCommit } from './src/git.ts';

// --- Store ---
export interface Repo {
  id: number;
  owner: { login: string; id: number };
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  default_branch: string;
  createdAt: string;
  updatedAt: string;
  html_url: string;
  fork: boolean;
  refs: Map<string, string>;
  objects: Map<string, { type: string; bytes: Uint8Array }>;
  labels: Map<string, string>;
  issues: Issue[];
  pulls: Pull[];
}

export function repoJson(repo: Repo, host: string) {
  return {
    id: repo.id,
    node_id: `repo_${repo.id}`,
    name: repo.name,
    full_name: repo.full_name,
    owner: {
      login: repo.owner.login,
      id: repo.owner.id,
      avatar_url: `http://${host}/avatars/${repo.owner.login}`,
      type: 'User',
    },
    private: repo.private,
    description: repo.description,
    fork: repo.fork,
    html_url: repo.html_url,
    created_at: repo.createdAt,
    updated_at: repo.updatedAt,
    pushed_at: repo.updatedAt,
    default_branch: repo.default_branch,
    has_issues: true,
    has_pull_requests: true,
    open_issues_count: repo.issues.filter(i => i.state === 'open').length,
    size: 0,
    watchers_count: 0,
    stargazers_count: 0,
    language: null,
    url: `http://${host}/api/v3/repos/${repo.full_name}`,
  };
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  comments: Comment[];
  user: { login: string };
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  body: string;
  user: { login: string };
  createdAt: string;
}

export interface Pull {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  comments: Comment[];
  user: { login: string };
  createdAt: string;
  updatedAt: string;
  head: { ref: string };
  base: { ref: string };
  merged: boolean;
  mergeable: boolean;
}

export class Store {
  repos: Map<string, Repo> = new Map();
}

export const store = new Store();

// --- HTTP Utils ---
export function sendJson(res: http.ServerResponse, status: number, body: any, extraHeaders: Record<string, string> = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'X-GitHub-Request-Id': Math.random().toString(36).substring(2, 10),
    ...extraHeaders,
  });
  res.end(payload);
}

export function sendError(res: http.ServerResponse, status: number, message: string) {
  sendJson(res, status, { message });
}

// --- Pagination ---
export function paginate<T>(items: T[], page: number = 1, perPage: number = 30): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

// --- Rest Handler ---
async function handleRest(req: http.IncomingMessage, res: http.ServerResponse, urlParts: string[], envUrl: string) {
  const method = req.method;
  const path = urlParts.join('/');
  const urlObj = new URL(req.url!, 'http://localhost');
  const page = parseInt(urlObj.searchParams.get('page') || '1');
  const perPage = parseInt(urlObj.searchParams.get('per_page') || '30');
  const host = req.headers.host || 'localhost';

  if (path === '') {
    sendJson(res, 200, {}, { 'X-OAuth-Scopes': 'repo, read:org' });
    return;
  }

  if (path === 'meta') {
    sendJson(res, 200, { installed_version: '1.0.0' });
    return;
  }

  if (method === 'GET' && path === 'user/repos') {
    const repos = Array.from(store.repos.values());
    const totalPages = Math.ceil(repos.length / perPage);
    const headers: Record<string, string> = {};
    if (page < totalPages) {
        const nextUrl = `http://${host}/api/v3/user/repos?per_page=${perPage}&page=${page + 1}`;
        headers['Link'] = `<${nextUrl}>; rel="next"`;
    }
    const reposJson = repos.map(r => repoJson(r, host));
    sendJson(res, 200, paginate(reposJson, page, perPage), headers);
    return;
  }

  if (method === 'POST' && path === 'user/repos') {
    const data = await consumeJson(req);
    const login = buildScenario().viewer.login;
    const repo: Repo = {
      id: Date.now(),
      owner: { login: login, id: 1 },
      name: data.name,
      full_name: `${login}/${data.name}`,
      description: data.description || '',
      private: data.private || false,
      default_branch: 'main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      html_url: `http://${host}/repos/${login}/${data.name}`,
      fork: false,
      refs: new Map(),
      objects: new Map(),
      labels: new Map(),
      issues: [],
      pulls: [],
    };

    store.repos.set(`${repo.owner.login}/${repo.name}`, repo);
    sendJson(res, 201, repoJson(repo, host));
    return;
  }

  if (path.startsWith('repos/')) {
    const parts = path.split('/');
    const owner = parts[1];
    const repoName = parts[2];
    const repo = store.repos.get(`${owner}/${repoName}`);
    
    if (!repo) {
      sendError(res, 404, 'Repository not found');
      return;
    }

    const subPath = parts.slice(3).join('/');

    // Contents
    if (subPath.startsWith('contents')) {
        const filePath = parts.slice(4).join('/');
        
        if (method === 'GET') {
            const object = repo.objects.get(filePath);
            if (!object) return sendError(res, 404, 'File not found');
            sendJson(res, 200, {
                name: filePath.split('/').pop(),
                path: filePath,
                type: object.type,
                content: Buffer.from(object.bytes).toString('base64'),
                encoding: 'base64'
            });
            return;
        }
        
        if (method === 'PUT') {
            const data = await consumeJson(req);
            const content = Buffer.from(data.content, 'base64');
            const blob = createBlob(content);
            repo.objects.set(blob.sha, { type: 'blob', bytes: blob.bytes });
            
            const tree = createTree([{ mode: '100644', name: filePath.split('/').pop()!, sha: blob.sha }]);
            repo.objects.set(tree.sha, { type: 'tree', bytes: tree.bytes });

            const parentSha = repo.refs.get('main') || null;
            const commit = createCommit(tree.sha, parentSha, data.message, { name: 'user', email: 'user@example.com', date: `${Math.floor(Date.now() / 1000)} +0000` });
            repo.objects.set(commit.sha, { type: 'commit', bytes: commit.bytes });
            repo.refs.set('main', commit.sha);

            sendJson(res, 201, {
                content: { name: filePath.split('/').pop(), path: filePath, sha: blob.sha, size: content.length, type: 'file', encoding: 'base64', content: data.content },
                commit: { sha: commit.sha, message: data.message, author: { name: 'user', email: 'user@example.com', date: new Date().toISOString() }, committer: { name: 'user', email: 'user@example.com', date: new Date().toISOString() } }
            });
            return;
        }

        if (method === 'DELETE') {
            repo.objects.delete(filePath);
            sendJson(res, 200, { message: 'File deleted' });
            return;
        }
    }
    // Labels
    else if (subPath.startsWith('labels')) {
        if (method === 'GET') {
            const labels = Array.from(repo.labels.entries()).map(([name, color]) => ({ name, color }));
            sendJson(res, 200, paginate(labels, page, perPage));
            return;
        } else if (method === 'POST') {
            const data = await consumeJson(req);
            repo.labels.set(data.name, data.color);
            sendJson(res, 201, { name: data.name, color: data.color });
            return;
        }
    }
    // Issues
    else if (subPath.startsWith('issues')) {
        if (method === 'GET') {
            sendJson(res, 200, paginate(repo.issues, page, perPage));
            return;
        } else if (method === 'POST') {
            const data = await consumeJson(req);
            const issue: Issue = {
                id: Date.now(),
                number: repo.issues.length + 1,
                title: data.title,
                body: data.body || '',
                state: 'open',
                labels: data.labels || [],
                comments: [],
                user: { login: 'user' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            repo.issues.push(issue);
            sendJson(res, 201, issue);
            return;
        }
    }
    // Pulls
    else if (subPath.startsWith('pulls')) {
        if (method === 'GET') {
            sendJson(res, 200, paginate(repo.pulls, page, perPage));
            return;
        } else if (method === 'POST') {
            const data = await consumeJson(req);
            const pull: Pull = {
                id: Date.now(),
                number: repo.pulls.length + 1,
                title: data.title,
                body: data.body || '',
                state: 'open',
                labels: [],
                comments: [],
                user: { login: 'user' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                head: { ref: data.head },
                base: { ref: data.base },
                merged: false,
                mergeable: true
            };
            repo.pulls.push(pull);
            sendJson(res, 201, pull);
            return;
        } else if (method === 'PUT') {
             const pullNumber = parseInt(parts[4]);
             const pull = repo.pulls.find(p => p.number === pullNumber);
             if (!pull) return sendError(res, 404, 'Pull not found');
             
             const data = await consumeJson(req);
             if (data.state) pull.state = data.state;
             sendJson(res, 200, pull);
             return;
        }
    }
    else if (parts.length === 3) {
      sendJson(res, 200, repoJson(repo, host));
      return;
    }
  }

  sendError(res, 404, 'Not Found');
}

async function consumeJson(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(new Error('Malformed JSON'));
            }
        });
        req.on('error', reject);
    });
}

// --- App ---
export function createApp(envUrl: string) {
  const server = http.createServer(async (req, res) => {
    req.on('error', (err) => {
      console.error('Request error:', err);
      if (!res.writableEnded) res.destroy();
    });
    res.on('error', (err) => {
      console.error('Response error:', err);
    });

    try {
        const urlObj = new URL(req.url!, 'http://localhost');
        const path = urlObj.pathname;

        if (path === '/healthz' && req.method === 'GET') {
          sendJson(res, 200, { ok: true });
          return;
        }

        // Auth check
        const auth = req.headers['authorization'];
        if (!auth || !auth.startsWith('Bearer ')) {
          sendError(res, 401, 'Unauthorized');
          return;
        }

        if (path.startsWith('/api/v3')) {
          const parts = path.split('/').filter(p => p !== '');
          await handleRest(req, res, parts.slice(2), envUrl);
          return;
        }

        sendError(res, 404, 'Not Found');
    } catch (e) {
        console.error('Handler error:', e);
        if (!res.writableEnded) {
            sendError(res, 500, 'Internal Server Error');
        }
    }
  });

  server.on('clientError', (err, socket) => {
    console.error('Client error:', err);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  return server;
}
