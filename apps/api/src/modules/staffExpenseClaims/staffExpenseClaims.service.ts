import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { staffExpenseClaims, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { ExpensesService } from '../expenses/expenses.service.js';

const expensesSvc = new ExpensesService();

type Category = 'RENT' | 'SALARY' | 'UTILITY' | 'PURCHASE' | 'MAINTENANCE' | 'TRANSPORT' | 'OTHER';

export class StaffExpenseClaimsService {
  async list(sellerId: string, staffId?: string) {
    return db
      .select({
        id:              staffExpenseClaims.id,
        staffId:         staffExpenseClaims.staffId,
        staffName:       users.name,
        category:        staffExpenseClaims.category,
        amount:          staffExpenseClaims.amount,
        description:     staffExpenseClaims.description,
        claimDate:       staffExpenseClaims.claimDate,
        receiptImageUrl: staffExpenseClaims.receiptImageUrl,
        status:          staffExpenseClaims.status,
        approvedAmount:  staffExpenseClaims.approvedAmount,
        ownerNote:       staffExpenseClaims.ownerNote,
        createdAt:       staffExpenseClaims.createdAt,
      })
      .from(staffExpenseClaims)
      .leftJoin(users, eq(staffExpenseClaims.staffId, users.id))
      .where(and(eq(staffExpenseClaims.sellerId, sellerId), ...(staffId ? [eq(staffExpenseClaims.staffId, staffId)] : [])))
      .orderBy(desc(staffExpenseClaims.createdAt));
  }

  async create(sellerId: string, staffId: string, body: {
    category: Category; amount: number; description?: string; claimDate?: string; receiptImageUrl?: string;
  }) {
    if (!body.amount || body.amount <= 0) throw new AppError('Amount must be greater than 0', 400);

    const [row] = await db.insert(staffExpenseClaims).values({
      sellerId,
      staffId,
      category:        body.category,
      amount:          String(body.amount),
      description:     body.description?.trim() || null,
      claimDate:       body.claimDate ? new Date(body.claimDate) : new Date(),
      receiptImageUrl: body.receiptImageUrl ?? null,
    }).returning();
    return row!;
  }

  async approve(id: string, sellerId: string, approvedById: string, body: { approvedAmount?: number; ownerNote?: string }) {
    const claim = await db.query.staffExpenseClaims.findFirst({
      where: and(eq(staffExpenseClaims.id, id), eq(staffExpenseClaims.sellerId, sellerId)),
    });
    if (!claim) throw new AppError('Claim not found', 404);
    if (claim.status !== 'PENDING') throw new AppError('Claim already reviewed', 400);

    const finalAmount = body.approvedAmount ?? Number(claim.amount);
    if (finalAmount <= 0) throw new AppError('Approved amount must be greater than 0', 400);

    // Reuses the real expense-creation path so an approved claim shows up in
    // P&L / expense reports exactly like any other expense — not a shadow
    // ledger only visible on this claims screen.
    const expense = await expensesSvc.create(sellerId, {
      category:    claim.category,
      amount:      finalAmount,
      description: `Staff expense claim${claim.description ? `: ${claim.description}` : ''} (claimed by staff)`,
      date:        claim.claimDate.toISOString(),
    });

    const [row] = await db.update(staffExpenseClaims)
      .set({
        status:         'APPROVED',
        approvedAmount: String(finalAmount),
        ownerNote:      body.ownerNote?.trim() || null,
        expenseId:      expense.id,
        approvedById,
        approvedAt:     new Date(),
      })
      .where(eq(staffExpenseClaims.id, id))
      .returning();
    return row!;
  }

  async reject(id: string, sellerId: string, approvedById: string, ownerNote?: string) {
    const claim = await db.query.staffExpenseClaims.findFirst({
      where: and(eq(staffExpenseClaims.id, id), eq(staffExpenseClaims.sellerId, sellerId)),
    });
    if (!claim) throw new AppError('Claim not found', 404);
    if (claim.status !== 'PENDING') throw new AppError('Claim already reviewed', 400);

    const [row] = await db.update(staffExpenseClaims)
      .set({ status: 'REJECTED', ownerNote: ownerNote?.trim() || null, approvedById, approvedAt: new Date() })
      .where(eq(staffExpenseClaims.id, id))
      .returning();
    return row!;
  }
}
