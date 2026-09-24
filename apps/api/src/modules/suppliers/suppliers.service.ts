import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { suppliers, supplierInvoices, supplierInvoiceLines, supplierPayments, products, users, ledgerEntries } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { randomUUID } from 'crypto';
import { accountingSvc } from '../accounting/accounting.service.js';

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
    return db.transaction(async (tx) => {
      // Same reason as removeInvoice(): payments cascade-delete with the supplier but
      // their ledger/accounting postings need voiding explicitly.
      const paidRows = await tx
        .select({ id: supplierPayments.id })
        .from(supplierPayments)
        .where(eq(supplierPayments.supplierId, id));
      const paymentIds = paidRows.map((p) => p.id);
      if (paymentIds.length > 0) {
        await tx.delete(ledgerEntries).where(
          and(inArray(ledgerEntries.referenceId, paymentIds), eq(ledgerEntries.refType, 'SUPPLIER_PAYMENT')),
        );
        await accountingSvc.voidByRef(sellerId, 'SUPPLIER_PAYMENT', paymentIds, tx);
      }

      const [row] = await tx
        .delete(suppliers)
        .where(and(eq(suppliers.id, id), eq(suppliers.sellerId, sellerId)))
        .returning({ id: suppliers.id });
      if (!row) throw new AppError('Supplier not found', 404);
    });
  }

  // ── Invoices ──────────────────────────────────────────────────────────────

  async listInvoices(supplierId: string, sellerId: string) {
    const rows = await db.execute<{
      id: string; supplier_id: string; seller_id: string;
      total_amount: string; paid_amount: string;
      description: string; invoice_date: string; created_at: string;
      invoice_number: string | null; payment_method: string | null; due_date: string | null;
      lines: Array<{
        id: string; productId: string | null; productName: string;
        quantity: number; unitPrice: string; notes: string | null;
      }>;
    }>(sql`
      SELECT
        si.id, si.supplier_id, si.seller_id, si.total_amount, si.paid_amount,
        si.description, si.invoice_date, si.created_at,
        si.invoice_number, si.payment_method, si.due_date,
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
      id:            r.id,
      supplierId:    r.supplier_id,
      sellerId:      r.seller_id,
      totalAmount:   Number(r.total_amount),
      paidAmount:    Number(r.paid_amount),
      outstanding:   Number(r.total_amount) - Number(r.paid_amount),
      description:   r.description,
      invoiceDate:   r.invoice_date,
      invoiceNumber: r.invoice_number ?? null,
      paymentMethod: r.payment_method ?? null,
      dueDate:       r.due_date ?? null,
      createdAt:     r.created_at,
      lines:         (r.lines ?? []).map((l) => ({
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
      chassisNumber?: string;
      engineNumber?: string;
      color?: string;
      modelYear?: number;
      vehicleCondition?: 'NEW' | 'USED';
      registrationNumber?: string;
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
              .set({
                stock:              sql`${products.stock} + ${line.quantity}`,
                ...(line.chassisNumber      && { chassisNumber:      line.chassisNumber }),
                ...(line.engineNumber       && { engineNumber:       line.engineNumber }),
                ...(line.color              && { color:              line.color }),
                ...(line.modelYear          && { modelYear:          line.modelYear }),
                ...(line.vehicleCondition   && { vehicleCondition:   line.vehicleCondition }),
                ...(line.registrationNumber && { registrationNumber: line.registrationNumber }),
              })
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

  // ── Payments (partial, recorded over time) ──────────────────────────────────

  async listPayments(invoiceId: string, sellerId: string) {
    const invoice = await db.query.supplierInvoices.findFirst({
      where: and(eq(supplierInvoices.id, invoiceId), eq(supplierInvoices.sellerId, sellerId)),
      columns: { id: true },
    });
    if (!invoice) throw new AppError('Invoice not found', 404);

    const rows = await db
      .select({
        id: supplierPayments.id, amount: supplierPayments.amount, method: supplierPayments.method,
        note: supplierPayments.note, paidOn: supplierPayments.paidOn, createdAt: supplierPayments.createdAt,
        recordedByName: users.name,
      })
      .from(supplierPayments)
      .leftJoin(users, eq(users.id, supplierPayments.recordedBy))
      .where(eq(supplierPayments.invoiceId, invoiceId))
      .orderBy(desc(supplierPayments.paidOn), desc(supplierPayments.createdAt));

    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  async recordPayment(invoiceId: string, sellerId: string, actorId: string | undefined, body: {
    amount: number; method?: string; note?: string; paidOn?: string;
  }) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          id: supplierInvoices.id, supplierId: supplierInvoices.supplierId,
          totalAmount: supplierInvoices.totalAmount, paidAmount: supplierInvoices.paidAmount,
          description: supplierInvoices.description, supplierName: suppliers.name,
        })
        .from(supplierInvoices)
        .innerJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
        .where(and(eq(supplierInvoices.id, invoiceId), eq(supplierInvoices.sellerId, sellerId)));
      if (!row) throw new AppError('Invoice not found', 404);

      const outstanding = Number(row.totalAmount) - Number(row.paidAmount);
      // Round-trip through paisas to sidestep float drift on the boundary check.
      const outstandingPaisas = Math.round(outstanding * 100);
      const amountPaisas      = Math.round(body.amount * 100);
      if (amountPaisas <= 0) throw new AppError('Amount must be greater than zero', 400);
      if (amountPaisas > outstandingPaisas) {
        throw new AppError(`Amount exceeds the remaining balance of PKR ${outstanding.toFixed(2)}`, 400);
      }

      const paidOn = body.paidOn ?? new Date().toISOString().slice(0, 10);

      const [payment] = await tx.insert(supplierPayments).values({
        invoiceId, supplierId: row.supplierId, sellerId,
        amount:  String(body.amount),
        method:  body.method ?? null,
        note:    body.note ?? null,
        paidOn,
        recordedBy: actorId ?? null,
      }).returning();

      const [updatedInvoice] = await tx
        .update(supplierInvoices)
        .set({ paidAmount: sql`${supplierInvoices.paidAmount} + ${body.amount}` })
        .where(eq(supplierInvoices.id, invoiceId))
        .returning();

      // Real cash leaving the shop — post it to the cash book / double-entry books,
      // the same way expenses.service.ts posts an expense (Dr Purchase Expense / Cr Cash).
      const memo = `Supplier payment — ${row.supplierName}${row.description ? ` (${row.description})` : ''}`;
      await tx.insert(ledgerEntries).values({
        sellerId,
        type: 'DEBIT',
        category: 'PURCHASE',
        amount: String(body.amount),
        description: memo,
        date: new Date(paidOn),
        referenceId: payment!.id,
        refType: 'SUPPLIER_PAYMENT',
      });
      await accountingSvc.postSupplierPaymentEntry(sellerId, { paymentId: payment!.id, amount: body.amount, memo, userId: actorId }, tx);

      return {
        payment: { ...payment!, amount: Number(payment!.amount) },
        invoice: { ...updatedInvoice!, totalAmount: Number(updatedInvoice!.totalAmount), paidAmount: Number(updatedInvoice!.paidAmount) },
      };
    });
  }

  async removePayment(paymentId: string, sellerId: string) {
    return db.transaction(async (tx) => {
      const [payment] = await tx
        .select({ id: supplierPayments.id, invoiceId: supplierPayments.invoiceId, amount: supplierPayments.amount })
        .from(supplierPayments)
        .where(and(eq(supplierPayments.id, paymentId), eq(supplierPayments.sellerId, sellerId)));
      if (!payment) throw new AppError('Payment not found', 404);

      await tx.delete(supplierPayments).where(eq(supplierPayments.id, paymentId));

      const [updatedInvoice] = await tx
        .update(supplierInvoices)
        .set({ paidAmount: sql`GREATEST(0, ${supplierInvoices.paidAmount} - ${payment.amount})` })
        .where(eq(supplierInvoices.id, payment.invoiceId))
        .returning();

      // Undo the cash-book / double-entry postings made when this payment was recorded.
      await tx.delete(ledgerEntries).where(
        and(eq(ledgerEntries.referenceId, paymentId), eq(ledgerEntries.refType, 'SUPPLIER_PAYMENT')),
      );
      await accountingSvc.voidByRef(sellerId, 'SUPPLIER_PAYMENT', paymentId, tx);

      return { ...updatedInvoice!, totalAmount: Number(updatedInvoice!.totalAmount), paidAmount: Number(updatedInvoice!.paidAmount) };
    });
  }

  async removeInvoice(id: string, sellerId: string) {
    return db.transaction(async (tx) => {
      // supplier_payments cascade-deletes with the invoice, but their ledger/accounting
      // postings don't — void those first or the cash book keeps a phantom outflow.
      const paidRows = await tx
        .select({ id: supplierPayments.id })
        .from(supplierPayments)
        .where(eq(supplierPayments.invoiceId, id));
      const paymentIds = paidRows.map((p) => p.id);
      if (paymentIds.length > 0) {
        await tx.delete(ledgerEntries).where(
          and(inArray(ledgerEntries.referenceId, paymentIds), eq(ledgerEntries.refType, 'SUPPLIER_PAYMENT')),
        );
        await accountingSvc.voidByRef(sellerId, 'SUPPLIER_PAYMENT', paymentIds, tx);
      }

      const [row] = await tx
        .delete(supplierInvoices)
        .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.sellerId, sellerId)))
        .returning({ id: supplierInvoices.id });
      if (!row) throw new AppError('Invoice not found', 404);
    });
  }
}
