import { env } from './config/env.js';
import app from './app.js';

const server = app.listen(env.PORT, () => {
  console.log(`API running on port ${env.PORT} [${env.NODE_ENV}]`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
