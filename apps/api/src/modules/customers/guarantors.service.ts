import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';

export interface GuarantorRecord {
  phone:         string;
  name:          string | null;
  relation:      string | null;
  customerCount: number;
  activeCount:   number;
  defaultedCount: number;
  customers: Array<{
    id:    string;
    name:  string;
    phone: string;
    installmentStatus: string | null;
  }>;
}

export class GuarantorsService {
  async list(sellerId: string, search?: string): Promise<GuarantorRecord[]> {
    // Union both guarantor slots to get all guarantors, then aggregate
    const rows = await db.execute<{
      phone: string;
      name:  string | null;
      relation: string | null;
      customer_count: number;
      active_count: number;
      defaulted_count: number;
      customers: string; // JSON
    }>(sql`
      WITH guarantor_links AS (
        SELECT
          c.id            AS customer_id,
          c.name          AS customer_name,
          c.phone         AS customer_phone,
          c.guarantor_phone   AS g_phone,
          c.guarantor_name    AS g_name,
          c.guarantor_relation AS g_relation
        FROM customers c
        WHERE c.seller_id = ${sellerId}
          AND c.deleted_at IS NULL
          AND c.guarantor_phone IS NOT NULL
          AND c.guarantor_phone <> ''

        UNION ALL

        SELECT
          c.id            AS customer_id,
          c.name          AS customer_name,
          c.phone         AS customer_phone,
          c.guarantor2_phone   AS g_phone,
          c.guarantor2_name    AS g_name,
          c.guarantor2_relation AS g_relation
        FROM customers c
        WHERE c.seller_id = ${sellerId}
          AND c.deleted_at IS NULL
          AND c.guarantor2_phone IS NOT NULL
          AND c.guarantor2_phone <> ''
      ),
      with_status AS (
        SELECT
          gl.*,
          (
            SELECT i.status
            FROM installments i
            WHERE i.customer_id = gl.customer_id
              AND i.deleted_at IS NULL
            ORDER BY i.created_at DESC
            LIMIT 1
          ) AS inst_status
        FROM guarantor_links gl
      )
      SELECT
        g_phone                                                    AS phone,
        MAX(g_name)                                                AS name,
        MAX(g_relation)                                            AS relation,
        COUNT(*)::int                                              AS customer_count,
        COUNT(*) FILTER (WHERE inst_status = 'ACTIVE')::int       AS active_count,
        COUNT(*) FILTER (WHERE inst_status = 'DEFAULTED')::int    AS defaulted_count,
        json_agg(json_build_object(
          'id',                customer_id,
          'name',              customer_name,
          'phone',             customer_phone,
          'installmentStatus', inst_status
        ) ORDER BY customer_name)::text AS customers
      FROM with_status
      ${search
        ? sql`WHERE LOWER(g_phone) LIKE ${'%' + search.toLowerCase() + '%'}
           OR LOWER(g_name)  LIKE ${'%' + search.toLowerCase() + '%'}`
        : sql``}
      GROUP BY g_phone
      ORDER BY defaulted_count DESC, customer_count DESC
    `);

    return rows.map((r) => ({
      phone:          r.phone,
      name:           r.name,
      relation:       r.relation,
      customerCount:  r.customer_count,
      activeCount:    r.active_count,
      defaultedCount: r.defaulted_count,
      customers:      JSON.parse(r.customers) as GuarantorRecord['customers'],
    }));
  }
}
