import type { IncomingMessage, ServerResponse } from 'node:http';

let handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let initError: unknown = null;

try {
  const mod = await import('../src/app.js');
  handler = mod.default;
} catch (err) {
  initError = err;
}

export default function (req: IncomingMessage, res: ServerResponse) {
  if (initError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'App initialization failed',
      message: String(initError),
      stack: (initError as any)?.stack,
    }));
    return;
  }
  handler!(req, res);
}
