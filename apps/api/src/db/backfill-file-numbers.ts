import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

async function main() {
  console.log('Backfilling file numbers for existing customers...');

  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        LPAD(ROW_NUMBER() OVER (PARTITION BY seller_id ORDER BY created_at ASC)::text, 4, '0') AS fn
      FROM customers
    )
    UPDATE customers c
    SET file_number = r.fn
    FROM ranked r
    WHERE c.id = r.id AND c.file_number IS NULL
    RETURNING c.id
  `);

  console.log(`✓ Backfilled ${result.length} customers with file numbers`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
