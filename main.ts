import { createApp } from './app.ts';
import { createServer } from 'node:http';

const envUrl = (process.env.MAKEFUN_ENV_URL || '').replace(/\/+$/, '');
if (!envUrl) {
  process.stderr.write('[entry] MAKEFUN_ENV_URL is not set\n');
  process.exit(1);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function register(port: number) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${envUrl}/register`, {
        method: 'POST',
        body: JSON.stringify({ port }),
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 200 || res.status === 409) return;
    } catch {}
    await sleep(Math.min(2000, 250 * 2 ** attempt));
  }
}

async function pollDone() {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${envUrl}/done`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const { done } = await res.json() as { done: boolean };
        if (done) return;
      }
    } catch {}
    await sleep(Math.min(2000, 250 * 2 ** attempt));
  }
}

async function run() {
  const app = createApp(envUrl);
  const server = createServer(app);
  server.listen(0);
  const { port } = server.address() as { port: number };

  await register(port);
  await pollDone();
  server.close();
  process.exit(0);
}

run().catch(() => process.exit(1));
