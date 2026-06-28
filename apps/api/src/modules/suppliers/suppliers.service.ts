import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { suppliers, supplierInvoices } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { randomUUID } from 'crypto';

export class SuppliersService {
  async list(sellerId: string) {
    const rows = await db.execute<{
      id: string; name: string; phone: string | null; address: string | null;
      iban: string | null; notes: string | null; created_at: string;
      invoice_count: number; total_amount: string; paid_amount: string;
    }>(sql`
      SELECT
        s.id, s.name, s.phone, s.address, s.iban, s.notes, s.created_at,
        COUNT(si.id)::int                              AS invoice_count,
        COALESCE(SUM(si.total_amount::numeric), 0)::text AS total_amount,
        COALESCE(SUM(si.paid_amount::numeric),  0)::text AS paid_amount
      FROM suppliers s
      LEFT JOIN supplier_invoices si ON si.supplier_id = s.id
      WHERE s.seller_id = ${sellerId}
      GROUP BY s.id, s.name, s.phone, s.address, s.iban, s.notes, s.created_at
      ORDER BY s.name ASC
    `);

    return rows.map((r) => ({
      id:           r.id,
      name:         r.name,
      phone:        r.phone,
      address:      r.address,
      iban:         r.iban,
      notes:        r.notes,
      createdAt:    r.created_at,
      invoiceCount: r.invoice_count,
      totalAmount:  Number(r.total_amount),
      paidAmount:   Number(r.paid_amount),
      outstanding:  Number(r.total_amount) - Number(r.paid_amount),
    }));
  }

  async create(sellerId: string, body: { name: string; phone?: string; address?: string; iban?: string; notes?: string }) {
    const [row] = await db
      .insert(suppliers)
      .values({ id: randomUUID(), sellerId, ...body })
      .returning();
    return row;
  }

  async update(id: string, sellerId: string, body: { name?: string; phone?: string; address?: string; iban?: string; notes?: string }) {
    const [row] = await db
      .update(suppliers)
      .set(body)
      .where(and(eq(suppliers.id, id), eq(suppliers.sellerId, sellerId)))
      .returning();
    if (!row) throw new AppError('Supplier not found', 404);
    return row;
  }

  async remove(id: string, sellerId: string) {
    const [row] = await db
      .delete(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.sellerId, sellerId)))
      .returning({ id: suppliers.id });
    if (!row) throw new AppError('Supplier not found', 404);
  }

  // ── Invoices ──────────────────────────────────────────────────────────────

  async listInvoices(supplierId: string, sellerId: string) {
    const rows = await db
      .select()
      .from(supplierInvoices)
      .where(and(eq(supplierInvoices.supplierId, supplierId), eq(supplierInvoices.sellerId, sellerId)))
      .orderBy(supplierInvoices.invoiceDate);

    return rows.map((r) => ({
      ...r,
      totalAmount: Number(r.totalAmount),
      paidAmount:  Number(r.paidAmount),
      outstanding: Number(r.totalAmount) - Number(r.paidAmount),
    }));
  }

  async createInvoice(sellerId: string, body: {
    supplierId: string; totalAmount: number; paidAmount?: number;
    description: string; invoiceDate: string;
  }) {
    const sup = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, body.supplierId), eq(suppliers.sellerId, sellerId)),
    });
    if (!sup) throw new AppError('Supplier not found', 404);

    const [row] = await db
      .insert(supplierInvoices)
      .values({
        id: randomUUID(),
        sellerId,
        supplierId:  body.supplierId,
        totalAmount: String(body.totalAmount),
        paidAmount:  String(body.paidAmount ?? 0),
        description: body.description,
        invoiceDate: body.invoiceDate,
      })
      .returning();
    return row;
  }

  async updateInvoicePaid(id: string, sellerId: string, paidAmount: number) {
    const [row] = await db
      .update(supplierInvoices)
      .set({ paidAmount: String(paidAmount) })
      .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.sellerId, sellerId)))
      .returning();
    if (!row) throw new AppError('Invoice not found', 404);
    return { ...row, totalAmount: Number(row.totalAmount), paidAmount: Number(row.paidAmount) };
  }

  async removeInvoice(id: string, sellerId: string) {
    const [row] = await db
      .delete(supplierInvoices)
      .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.sellerId, sellerId)))
      .returning({ id: supplierInvoices.id });
    if (!row) throw new AppError('Invoice not found', 404);
  }
}
