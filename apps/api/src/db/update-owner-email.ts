import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client, { schema });

async function main() {
  const OLD_EMAIL = 'muneeb12@email.com';
  const NEW_EMAIL = 'saeedaltaf4@yahoo.com';

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, OLD_EMAIL),
    columns: { id: true, name: true, email: true, role: true },
  });

  if (!existing) {
    console.log(`No user found with email: ${OLD_EMAIL}`);
    await client.end();
    return;
  }

  console.log('Found:', existing);

  const conflict = await db.query.users.findFirst({
    where: eq(schema.users.email, NEW_EMAIL),
    columns: { id: true, name: true, email: true, role: true },
  });

  if (conflict) {
    console.log(`ERROR: ${NEW_EMAIL} is already in use by:`, conflict);
    await client.end();
    return;
  }

  await db.update(schema.users)
    .set({ email: NEW_EMAIL })
    .where(eq(schema.users.email, OLD_EMAIL));

  console.log(`✓ Email updated: ${OLD_EMAIL} → ${NEW_EMAIL}`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
