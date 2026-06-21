import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

// Vercel serverless: each invocation gets its own pool; keep small to avoid saturating DB connections
const client = postgres(env.DATABASE_URL, { max: 5, idle_timeout: 20, connect_timeout: 10 });
export const db = drizzle({ client, schema });
