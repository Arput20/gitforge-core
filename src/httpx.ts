import http from 'node:http';

export const API_PREFIX = '/api/v3';

export interface GitHubResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

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
