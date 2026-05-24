import 'dotenv/config';
import { createHash, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';

const { sellers, users, customers, products, installments, payments } = schema;

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client, { schema });

const PEPPER = process.env['CNIC_HASH_PEPPER'] ?? 'dev-pepper';

function hashCnic(cnic: string) {
  return createHash('sha256').update(cnic + PEPPER).digest('hex');
}
function maskCnic(cnic: string) {
  const clean = cnic.replace(/-/g, '');
  return `XXXXX-XXXXXXX-${clean.slice(-1)}`;
}

async function main() {
  console.log('Seeding database…');

  const existing = await db.query.sellers.findFirst({ where: eq(sellers.shopName, 'City Electronics') });
  if (existing) {
    console.log('Seed data already exists. Skipping.');
    await client.end();
    return;
  }

  // ── Seller ────────────────────────────────────────────────────────────────
  const sellerId = randomUUID();
  await db.insert(sellers).values({
    id: sellerId,
    shopName: 'City Electronics',
    phone: '0321-4567890',
    address: 'Hall Road, Lahore',
    plan: 'BASIC',
  }).onConflictDoNothing();

  // ── Users ─────────────────────────────────────────────────────────────────
  const ownerPw  = await bcrypt.hash('password123', 12);
  const staffPw  = await bcrypt.hash('password123', 12);

  const ownerId = randomUUID();
  const staffId = randomUUID();

  await db.insert(users).values([
    { id: ownerId, name: 'Ahmad Ali', email: 'owner@city.pk', password: ownerPw, role: 'SELLER_OWNER', sellerId },
    { id: staffId, name: 'Bilal Khan', email: 'staff@city.pk', password: staffPw, role: 'SELLER_STAFF', sellerId },
  ]).onConflictDoNothing();

  // ── Products ──────────────────────────────────────────────────────────────
  const productData = [
    { name: 'Samsung 55" 4K Smart TV', price: '145000', stock: 8, serial: 'SAM-TV-55-001' },
    { name: 'LG 16 cu ft Refrigerator', price: '98000', stock: 5, serial: 'LG-REF-16-002' },
    { name: 'iPhone 15 128GB', price: '210000', stock: 12, serial: null },
    { name: 'Haier Washing Machine 8kg', price: '72000', stock: 6, serial: 'HAI-WM-8-004' },
    { name: 'Dell Laptop Core i5', price: '135000', stock: 4, serial: 'DELL-I5-005' },
    { name: 'Sony 43" Full HD TV', price: '89000', stock: 10, serial: 'SONY-43-006' },
    { name: 'Orient AC 1.5 Ton', price: '95000', stock: 7, serial: null },
    { name: 'Xiaomi Redmi Note 12', price: '45000', stock: 20, serial: null },
  ];

  const productIds: string[] = [];
  for (const p of productData) {
    const id = randomUUID();
    productIds.push(id);
    await db.insert(products).values({ id, sellerId, ...p }).onConflictDoNothing();
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  const customerData = [
    { name: 'Muhammad Usman', cnic: '35202-1234567-1', phone: '0300-1111111', address: 'Gulberg III, Lahore', guarantorName: 'Tariq Usman', guarantorPhone: '0301-2222222' },
    { name: 'Ayesha Siddiqui', cnic: '42101-7654321-2', phone: '0311-3333333', address: 'DHA Phase 5, Karachi', guarantorName: null, guarantorPhone: null },
    { name: 'Imran Hussain', cnic: '61101-9876543-3', phone: '0322-4444444', address: 'G-9, Islamabad', guarantorName: 'Asif Hussain', guarantorPhone: '0333-5555555' },
    { name: 'Sana Malik', cnic: '35201-1122334-4', phone: '0345-6666666', address: 'Saddar, Rawalpindi', guarantorName: null, guarantorPhone: null },
    { name: 'Farhan Ahmed', cnic: '35302-5544332-5', phone: '0300-7777777', address: 'Model Town, Lahore', guarantorName: 'Zafar Ahmed', guarantorPhone: '0312-8888888' },
    { name: 'Nadia Rehman', cnic: '42201-3344556-6', phone: '0332-9999999', address: 'North Nazimabad, Karachi', guarantorName: null, guarantorPhone: null },
  ];

  const customerIds: string[] = [];
  for (const c of customerData) {
    const id = randomUUID();
    customerIds.push(id);
    await db.insert(customers).values({
      id,
      sellerId,
      name: c.name,
      cnicHash: hashCnic(c.cnic),
      cnicMasked: maskCnic(c.cnic),
      phone: c.phone,
      address: c.address ?? undefined,
      guarantorName: c.guarantorName ?? undefined,
      guarantorPhone: c.guarantorPhone ?? undefined,
    }).onConflictDoNothing();
  }

  // ── Installments ──────────────────────────────────────────────────────────
  type InstRow = {
    id: string; customerId: string; productId: string;
    totalAmount: string; downPayment: string; remaining: string;
    monthly: string; months: number; startDate: Date;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DEFAULTED';
  };

  const now = new Date();
  const instData: Omit<InstRow, 'id'>[] = [
    {
      customerId: customerIds[0]!, productId: productIds[0]!,
      totalAmount: '145000', downPayment: '25000', remaining: '76000',
      monthly: String(((145000 - 25000) / 12).toFixed(2)), months: 12,
      startDate: new Date(now.getFullYear(), now.getMonth() - 4, 1),
      status: 'ACTIVE',
    },
    {
      customerId: customerIds[1]!, productId: productIds[2]!,
      totalAmount: '210000', downPayment: '60000', remaining: '0',
      monthly: String(((210000 - 60000) / 10).toFixed(2)), months: 10,
      startDate: new Date(now.getFullYear() - 1, now.getMonth(), 1),
      status: 'COMPLETED',
    },
    {
      customerId: customerIds[2]!, productId: productIds[1]!,
      totalAmount: '98000', downPayment: '18000', remaining: '56000',
      monthly: String(((98000 - 18000) / 8).toFixed(2)), months: 8,
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      status: 'ACTIVE',
    },
    {
      customerId: customerIds[3]!, productId: productIds[4]!,
      totalAmount: '135000', downPayment: '35000', remaining: '100000',
      monthly: String(((135000 - 35000) / 10).toFixed(2)), months: 10,
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      status: 'ACTIVE',
    },
    {
      customerId: customerIds[4]!, productId: productIds[3]!,
      totalAmount: '72000', downPayment: '12000', remaining: '0',
      monthly: String(((72000 - 12000) / 6).toFixed(2)), months: 6,
      startDate: new Date(now.getFullYear() - 1, now.getMonth() + 3, 1),
      status: 'COMPLETED',
    },
    {
      customerId: customerIds[5]!, productId: productIds[5]!,
      totalAmount: '89000', downPayment: '19000', remaining: '47667',
      monthly: String(((89000 - 19000) / 9).toFixed(2)), months: 9,
      startDate: new Date(now.getFullYear(), now.getMonth() - 3, 1),
      status: 'ACTIVE',
    },
    {
      customerId: customerIds[0]!, productId: productIds[7]!,
      totalAmount: '45000', downPayment: '10000', remaining: '35000',
      monthly: String(((45000 - 10000) / 7).toFixed(2)), months: 7,
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 15),
      status: 'ACTIVE',
    },
  ];

  const installmentIds: string[] = [];
  for (const inst of instData) {
    const id = randomUUID();
    installmentIds.push(id);
    await db.insert(installments).values({ id, ...inst }).onConflictDoNothing();
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  const paymentData = [
    // Usman's Samsung TV - 4 payments made
    { installmentId: installmentIds[0]!, amount: '10000', method: 'CASH' as const, paidOn: new Date(now.getFullYear(), now.getMonth() - 3, 5) },
    { installmentId: installmentIds[0]!, amount: '10000', method: 'JAZZCASH' as const, paidOn: new Date(now.getFullYear(), now.getMonth() - 2, 4) },
    { installmentId: installmentIds[0]!, amount: '9000', method: 'CASH' as const, paidOn: new Date(now.getFullYear(), now.getMonth() - 1, 6) },
    { installmentId: installmentIds[0]!, amount: '9000', method: 'BANK' as const, paidOn: new Date(now.getFullYear(), now.getMonth(), 3) },
    // Ayesha's iPhone - completed (10 payments)
    ...Array.from({ length: 10 }, (_, i) => ({
      installmentId: installmentIds[1]!,
      amount: '15000',
      method: 'CASH' as const,
      paidOn: new Date(now.getFullYear() - 1, now.getMonth() + i, 5),
    })),
    // Imran's LG Fridge - 1 payment
    { installmentId: installmentIds[2]!, amount: '10000', method: 'EASYPAISA' as const, paidOn: new Date(now.getFullYear(), now.getMonth(), 8) },
    // Nadia's Sony TV - 3 payments
    { installmentId: installmentIds[5]!, amount: '7778', method: 'CASH' as const, paidOn: new Date(now.getFullYear(), now.getMonth() - 2, 10) },
    { installmentId: installmentIds[5]!, amount: '7778', method: 'CASH' as const, paidOn: new Date(now.getFullYear(), now.getMonth() - 1, 9) },
    { installmentId: installmentIds[5]!, amount: '6667', method: 'BANK' as const, paidOn: new Date(now.getFullYear(), now.getMonth(), 7) },
    // Farhan's Haier Washer - 6 payments (completed)
    ...Array.from({ length: 6 }, (_, i) => ({
      installmentId: installmentIds[4]!,
      amount: '10000',
      method: 'CASH' as const,
      paidOn: new Date(now.getFullYear() - 1, now.getMonth() + 3 + i, 5),
    })),
  ];

  for (const p of paymentData) {
    await db.insert(payments).values({
      id: randomUUID(),
      installmentId: p.installmentId,
      amount: String(p.amount),
      method: p.method,
      paidOn: p.paidOn,
    }).onConflictDoNothing();
  }

  console.log('Done!');
  console.log('  Shop:  City Electronics');
  console.log('  Owner: owner@city.pk / password123');
  console.log('  Staff: staff@city.pk / password123');
  console.log(`  ${customerData.length} customers, ${productData.length} products, ${instData.length} installments`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
