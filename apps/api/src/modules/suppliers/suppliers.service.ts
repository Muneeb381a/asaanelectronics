import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { suppliers, supplierInvoices, supplierInvoiceLines, products } from '../../db/schema.js';
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
    const rows = await db.execute<{
      id: string; supplier_id: string; seller_id: string;
      total_amount: string; paid_amount: string;
      description: string; invoice_date: string; created_at: string;
      lines: Array<{
        id: string; productId: string | null; productName: string;
        quantity: number; unitPrice: string; notes: string | null;
      }>;
    }>(sql`
      SELECT
        si.id, si.supplier_id, si.seller_id, si.total_amount, si.paid_amount,
        si.description, si.invoice_date, si.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id',          sil.id,
              'productId',   sil.product_id,
              'productName', sil.product_name,
              'quantity',    sil.quantity,
              'unitPrice',   sil.unit_price,
              'notes',       sil.notes
            )
          ) FILTER (WHERE sil.id IS NOT NULL),
          '[]'::json
        ) AS lines
      FROM supplier_invoices si
      LEFT JOIN supplier_invoice_lines sil ON sil.invoice_id = si.id
      WHERE si.supplier_id = ${supplierId} AND si.seller_id = ${sellerId}
      GROUP BY si.id
      ORDER BY si.invoice_date, si.created_at
    `);

    return rows.map((r) => ({
      id:          r.id,
      supplierId:  r.supplier_id,
      sellerId:    r.seller_id,
      totalAmount: Number(r.total_amount),
      paidAmount:  Number(r.paid_amount),
      outstanding: Number(r.total_amount) - Number(r.paid_amount),
      description: r.description,
      invoiceDate: r.invoice_date,
      createdAt:   r.created_at,
      lines:       (r.lines ?? []).map((l) => ({
        id:          l.id,
        productId:   l.productId,
        productName: l.productName,
        quantity:    Number(l.quantity),
        unitPrice:   Number(l.unitPrice),
      })),
    }));
  }

  async createInvoice(sellerId: string, body: {
    supplierId: string;
    totalAmount?: number;
    paidAmount?: number;
    description?: string;
    invoiceDate: string;
    lines?: Array<{
      productId?: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
    }>;
  }) {
    const sup = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, body.supplierId), eq(suppliers.sellerId, sellerId)),
    });
    if (!sup) throw new AppError('Supplier not found', 404);

    const lines = body.lines ?? [];
    const hasLines = lines.length > 0;

    const totalAmount = hasLines
      ? lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
      : (body.totalAmount ?? 0);

    const description = body.description?.trim() ||
      (hasLines ? lines.map((l) => `${l.productName} ×${l.quantity}`).join(', ') : '');

    if (!hasLines && !description && !body.totalAmount) {
      throw new AppError('Provide line items or a description with total amount', 400);
    }

    if (hasLines) {
      return db.transaction(async (tx) => {
        const [invoice] = await tx
          .insert(supplierInvoices)
          .values({
            id: randomUUID(),
            sellerId,
            supplierId:  body.supplierId,
            totalAmount: String(totalAmount),
            paidAmount:  String(body.paidAmount ?? 0),
            description,
            invoiceDate: body.invoiceDate,
          })
          .returning();

        await tx.insert(supplierInvoiceLines).values(
          lines.map((l) => ({
            id:          randomUUID(),
            invoiceId:   invoice!.id,
            sellerId,
            productId:   l.productId ?? null,
            productName: l.productName,
            quantity:    l.quantity,
            unitPrice:   String(l.unitPrice),
            notes:       l.notes ?? null,
          })),
        );

        for (const line of lines) {
          if (line.productId) {
            await tx
              .update(products)
              .set({ stock: sql`${products.stock} + ${line.quantity}` })
              .where(and(eq(products.id, line.productId), eq(products.sellerId, sellerId)));
          }
        }

        return invoice!;
      });
    }

    const [row] = await db
      .insert(supplierInvoices)
      .values({
        id: randomUUID(),
        sellerId,
        supplierId:  body.supplierId,
        totalAmount: String(totalAmount),
        paidAmount:  String(body.paidAmount ?? 0),
        description,
        invoiceDate: body.invoiceDate,
      })
      .returning();
    return row!;
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
