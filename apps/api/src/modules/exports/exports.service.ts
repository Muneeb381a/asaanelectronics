import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, payments, products, expenses, cashSales } from '../../db/schema.js';

export class ExportsService {
  async getFullBackup(sellerId: string) {
    const [
      customersData,
      installmentsData,
      productsData,
      expensesData,
    ] = await Promise.all([
      db.select({
        id: customers.id, name: customers.name, phone: customers.phone,
        area: customers.area, cnicMasked: customers.cnicMasked, address: customers.address,
        tags: customers.tags, dob: customers.dob, createdAt: customers.createdAt,
      }).from(customers)
        .where(and(eq(customers.sellerId, sellerId), isNull(customers.deletedAt))),

      db.select({
        id: installments.id, invoiceNumber: installments.invoiceNumber,
        customerId: installments.customerId, productId: installments.productId,
        totalAmount: installments.totalAmount, downPayment: installments.downPayment,
        monthly: installments.monthly, months: installments.months,
        remaining: installments.remaining, status: installments.status,
        startDate: installments.startDate, paymentFrequency: installments.paymentFrequency,
        createdAt: installments.createdAt,
      }).from(installments)
        .where(isNull(installments.deletedAt)),

      db.select({
        id: products.id, name: products.name, category: products.category,
        brand: products.brand, model: products.model, price: products.price,
        installmentPrice: products.installmentPrice, purchasePrice: products.purchasePrice,
        stock: products.stock, minStock: products.minStock, serial: products.serial,
        warrantyMonths: products.warrantyMonths,
      }).from(products)
        .where(and(eq(products.sellerId, sellerId), isNull(products.deletedAt))),

      db.select({
        id: expenses.id, category: expenses.category, amount: expenses.amount,
        description: expenses.description, date: expenses.date, createdAt: expenses.createdAt,
      }).from(expenses)
        .where(eq(expenses.sellerId, sellerId)),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      sellerId,
      customers:    customersData,
      installments: installmentsData,
      products:     productsData,
      expenses:     expensesData,
    };
  }
}
