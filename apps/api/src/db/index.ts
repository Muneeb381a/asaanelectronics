import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

// On DigitalOcean App Platform (not Vercel serverless anymore — one pool for
// the whole process lifetime, not one per invocation) a pool this small was
// forcing requests with many parallel queries (e.g. stats.getStats, 18-wide)
// to queue behind each other for a free connection. Measured directly:
// 18 concurrent queries against this DB took ~1970ms at max=5 vs ~1380ms at
// max=20 (and resting pool, not cold-connecting, would be faster still).
// The managed Postgres instance's own max_connections is 25 — keep headroom
// for more than one app replica and any admin/script connections.
const client = postgres(env.DATABASE_URL, { max: 10, idle_timeout: 20, connect_timeout: 10 });
export const db = drizzle({ client, schema });
