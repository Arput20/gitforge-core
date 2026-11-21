import { createApp } from './app.ts';
import { createServer } from 'node:http';

const envUrl = (process.env.MAKEFUN_ENV_URL || '').replace(/\/+$/, '');
if (!envUrl) {
  process.stderr.write('[entry] Error: MAKEFUN_ENV_URL is not set\n');
  process.exit(1);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function register(port: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`${envUrl}/register`, {
        method: 'POST',
        body: JSON.stringify({ port }),
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 200 || res.status === 409) {
        process.stdout.write(`[entry] registered on port ${port}\n`);
        return;
      }
    } catch (e) {
      process.stderr.write(`[entry] register attempt ${attempt + 1} failed: ${e}\n`);
    }
    await sleep(Math.min(2000, 250 * 2 ** attempt));
  }
  throw new Error('Failed to register');
}

async function pollDone() {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${envUrl}/done`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const { done } = await res.json() as { done: boolean };
        if (done) {
          process.stdout.write('[entry] done signal received\n');
          return;
        }
      }
    } catch {}
    await sleep(Math.min(2000, 250 * 2 ** attempt));
  }
}

async function run() {
  const app = createApp(envUrl);
  const server = createServer(app);
  
  // Timeout guard for startup
  const startupTimeout = setTimeout(() => {
    process.stderr.write('[entry] Startup timeout\n');
    process.exit(1);
  }, 10000);
  
  server.listen(0);
  const { port } = server.address() as { port: number };
  
  clearTimeout(startupTimeout);
  process.stdout.write(`[entry] listening on port ${port}\n`);

  await register(port);
  await pollDone();
  server.close();
  process.exit(0);
}

run().catch((e) => {
  process.stderr.write(`[entry] Fatal error: ${e}\n`);
  process.exit(1);
});
