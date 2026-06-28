import {
  pgTable,
  text,
  timestamp,
  date,
  decimal,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  json,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const roleEnum = pgEnum('role', ['SUPER_ADMIN', 'SELLER_OWNER', 'SELLER_STAFF']);
export const otpPurposeEnum = pgEnum('otp_purpose', ['LOGIN', 'PASSWORD_RESET']);
export const planEnum = pgEnum('plan', ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE']);
export const verificationStatusEnum = pgEnum('verification_status', ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']);
export const installmentStatusEnum = pgEnum('installment_status', [
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'DEFAULTED',
  'CANCELLED',
  'CLOSED',
]);
export const paymentMethodEnum = pgEnum('payment_method', [
  'CASH',
  'BANK',
  'JAZZCASH',
  'EASYPAISA',
  'OTHER',
]);

export const expenseCategoryEnum = pgEnum('expense_category', [
  'RENT', 'SALARY', 'UTILITY', 'PURCHASE', 'MAINTENANCE', 'TRANSPORT', 'OTHER',
]);

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', ['CREDIT', 'DEBIT']);
export const ledgerRefTypeEnum   = pgEnum('ledger_ref_type',   ['PAYMENT', 'EXPENSE', 'MANUAL']);

export const sellers = pgTable('sellers', {
  id:            text('id').primaryKey().$defaultFn(() => randomUUID()),
  shopName:      text('shop_name').notNull(),
  phone:         text('phone').notNull(),
  address:       text('address'),
  plan:          planEnum('plan').default('TRIAL').notNull(),
  trialEndsAt:   timestamp('trial_ends_at'),
  planExpiresAt: timestamp('plan_expires_at'),
  isActive:      boolean('is_active').default(true).notNull(),
  murabahaMode:  boolean('murabaha_mode').default(false).notNull(),
  settings:      json('settings').$type<{
    dailyTarget?: number;
    weeklyTarget?: number;
    monthlyTarget?: number;
    commissionRate?: number;
    expenseBudgets?: Partial<Record<'RENT' | 'SALARY' | 'UTILITY' | 'PURCHASE' | 'MAINTENANCE' | 'TRANSPORT' | 'OTHER', number>>;
  }>(),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
});

export type StaffPermissions = {
  canAddCustomer: boolean;
  canEditCustomer: boolean;
  canAddInstallment: boolean;
  canRecordPayment: boolean;
  canViewReports: boolean;
  canManageProducts: boolean;
  canVerifyCustomers: boolean;
  canRecordExpense: boolean;
  canManageReturns: boolean;
  canSearchCnic: boolean;
  canMakeCashSales?: boolean;
  canViewAllInstallments?: boolean;
};

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  canAddCustomer: true,
  canEditCustomer: true,
  canAddInstallment: true,
  canRecordPayment: true,
  canViewReports: true,
  canManageProducts: true,
  canVerifyCustomers: false,
  canRecordExpense: false,
  canManageReturns: false,
  canSearchCnic: false,
  canMakeCashSales: false,
  canViewAllInstallments: true,
};

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: roleEnum('role').default('SELLER_STAFF').notNull(),
  sellerId: text('seller_id').references(() => sellers.id),
  permissions: json('permissions').$type<StaffPermissions>(),
  frozenUntil: timestamp('frozen_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_users_seller').on(t.sellerId),
]);

export const refreshTokens = pgTable('refresh_tokens', {
  id:           text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId:       text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:        text('token').notNull().unique(),
  expiresAt:    timestamp('expires_at').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  ip:           text('ip'),
  userAgent:    text('user_agent'),
  deviceName:   text('device_name'),
  deviceType:   text('device_type'),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  isSuspicious: boolean('is_suspicious').default(false).notNull(),
}, (t) => [
  index('idx_refresh_user').on(t.userId),
]);

export const otps = pgTable('otps', {
  id:        text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash:  text('code_hash').notNull(),
  purpose:   otpPurposeEnum('purpose').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  attempts:  integer('attempts').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_otps_user_purpose').on(t.userId, t.purpose),
]);

export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey().$defaultFn(() => randomUUID()),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    name: text('name').notNull(),
    cnicHash: text('cnic_hash').notNull(),
    cnicMasked: text('cnic_masked').notNull(),
    phone: text('phone').notNull(),
    address: text('address'),
    occupation: text('occupation'),
    employer: text('employer'),
    area: text('area'),
    fatherName: text('father_name'),
    cnicExpiry: text('cnic_expiry'),
    guarantorName: text('guarantor_name'),
    guarantorPhone: text('guarantor_phone'),
    guarantorCnic: text('guarantor_cnic'),
    guarantorAddress: text('guarantor_address'),
    guarantorRelation: text('guarantor_relation'),
    guarantor2Name: text('guarantor2_name'),
    guarantor2Phone: text('guarantor2_phone'),
    guarantor2Cnic: text('guarantor2_cnic'),
    guarantor2Address: text('guarantor2_address'),
    guarantor2Relation: text('guarantor2_relation'),
    officeAddress: text('office_address'),
    salary: decimal('salary', { precision: 12, scale: 2 }),
    blankChequeUrl: text('blank_cheque_url'),
    chequeBank: text('cheque_bank'),
    chequeAccountNo: text('cheque_account_no'),
    chequeNo: text('cheque_no'),
    photoUrl: text('photo_url'),
    cnicFrontUrl: text('cnic_front_url'),
    cnicBackUrl: text('cnic_back_url'),
    guarantorCnicFrontUrl: text('guarantor_cnic_front_url'),
    guarantorCnicBackUrl: text('guarantor_cnic_back_url'),
    guarantor2CnicFrontUrl: text('guarantor2_cnic_front_url'),
    guarantor2CnicBackUrl: text('guarantor2_cnic_back_url'),
    cnicFrontHash: text('cnic_front_hash'),
    cnicBackHash: text('cnic_back_hash'),
    blankChequeHash: text('blank_cheque_hash'),
    customerType: text('customer_type').default('regular').notNull(),
    shopName: text('shop_name'),
    shopAddress: text('shop_address'),
    businessType: text('business_type'),
    guarantorShopName: text('guarantor_shop_name'),
    guarantorShopAddress: text('guarantor_shop_address'),
    guarantor2ShopName: text('guarantor2_shop_name'),
    guarantor2ShopAddress: text('guarantor2_shop_address'),
    dob: date('dob'),
    referredById: text('referred_by_id').references((): AnyPgColumn => customers.id, { onDelete: 'set null' }),
    tags: text('tags').array().default([]).notNull(),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    assignedAvoId: text('assigned_avo_id').references(() => users.id, { onDelete: 'set null' }),
    verificationStatus: verificationStatusEnum('verification_status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    deletedBy: text('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('idx_cnic_hash').on(t.cnicHash),
    index('idx_cnic_seller').on(t.sellerId, t.cnicHash),
    index('idx_customers_seller').on(t.sellerId),
    index('idx_customers_seller_deleted').on(t.sellerId, t.deletedAt),
    index('idx_cnic_front_hash').on(t.sellerId, t.cnicFrontHash),
    index('idx_cnic_back_hash').on(t.sellerId, t.cnicBackHash),
    index('idx_blank_cheque_hash').on(t.sellerId, t.blankChequeHash),
    index('idx_customers_phone').on(t.phone),
    index('idx_customers_name').on(t.sellerId, t.name),
    index('idx_customers_seller_del_created').on(t.sellerId, t.deletedAt, t.createdAt),
    index('idx_customers_created_by').on(t.createdByUserId, t.sellerId),
  ],
);

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  customerId: text('customer_id').notNull().unique().references(() => customers.id, { onDelete: 'cascade' }),
  avoId: text('avo_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  status: verificationStatusEnum('status').notNull(),
  addressVerified: boolean('address_verified').notNull(),
  employerVerified: boolean('employer_verified').notNull(),
  guarantor1Reachable: boolean('guarantor1_reachable').notNull(),
  guarantor2Reachable: boolean('guarantor2_reachable').notNull(),
  photoEvidenceUrl: text('photo_evidence_url'),
  notes: text('notes'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  locationAccuracy: decimal('location_accuracy', { precision: 8, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_verifications_avo').on(t.avoId),
]);

export const products = pgTable('products', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId: text('seller_id')
    .notNull()
    .references(() => sellers.id),
  name: text('name').notNull(),
  category: text('category'),
  brand: text('brand'),
  model: text('model'),
  color: text('color'),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  installmentPrice: decimal('installment_price', { precision: 12, scale: 2 }),
  purchasePrice: decimal('purchase_price', { precision: 12, scale: 2 }),
  stock:    integer('stock').default(0).notNull(),
  minStock: integer('min_stock').default(3).notNull(),
  photoUrl: text('photo_url'),
  serial: text('serial'),
  warrantyMonths: integer('warranty_months'),
  description: text('description'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  index('idx_products_seller').on(t.sellerId),
  index('idx_products_name').on(t.sellerId, t.name),
  index('idx_products_seller_deleted').on(t.sellerId, t.deletedAt),
]);

export const installments = pgTable('installments', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  totalAmount:  decimal('total_amount',  { precision: 12, scale: 2 }).notNull(),
  downPayment:  decimal('down_payment',  { precision: 12, scale: 2 }).notNull(),
  remaining:    decimal('remaining',     { precision: 12, scale: 2 }).notNull(),
  monthly:      decimal('monthly',       { precision: 12, scale: 2 }).notNull(),
  months:       integer('months').notNull(),
  startDate:    timestamp('start_date').notNull(),
  invoiceNumber: text('invoice_number'),
  status:       installmentStatusEnum('status').default('PENDING').notNull(),
  imeiNumber:   text('imei_number'),
  cashPrice:        decimal('cash_price',    { precision: 12, scale: 2 }),
  profitMarkup:     decimal('profit_markup', { precision: 12, scale: 2 }),
  paymentFrequency: text('payment_frequency').default('monthly').notNull(),
  paymentDueDay:    integer('payment_due_day').default(10).notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  deletedAt:    timestamp('deleted_at'),
  deletedBy:    text('deleted_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  index('idx_installments_customer').on(t.customerId),
  index('idx_installments_status').on(t.status),
  index('idx_installments_customer_deleted').on(t.customerId, t.deletedAt),
  index('idx_installments_customer_status_del').on(t.customerId, t.status, t.deletedAt),
  index('idx_installments_start_date').on(t.startDate),
  index('idx_installments_seller_status').on(t.status, t.deletedAt),
  index('idx_installments_product').on(t.productId),
]);

export const expenses = pgTable('expenses', {
  id:             text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:       text('seller_id').notNull().references(() => sellers.id),
  category:       expenseCategoryEnum('category').notNull(),
  amount:         decimal('amount', { precision: 12, scale: 2 }).notNull(),
  description:    text('description'),
  date:           timestamp('date').defaultNow().notNull(),
  isRecurring:    boolean('is_recurring').default(false).notNull(),
  recurrenceDay:  integer('recurrence_day').default(1).notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_expenses_seller').on(t.sellerId),
  index('idx_expenses_date').on(t.date),
  index('idx_expenses_recurring').on(t.sellerId, t.isRecurring),
]);

export const ledgerEntries = pgTable('ledger_entries', {
  id:          text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:    text('seller_id').notNull().references(() => sellers.id),
  type:        ledgerEntryTypeEnum('type').notNull(),
  category:    text('category').notNull(),
  amount:      decimal('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  date:        timestamp('date').defaultNow().notNull(),
  referenceId: text('reference_id'),
  refType:     ledgerRefTypeEnum('ref_type').notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_ledger_seller').on(t.sellerId),
  index('idx_ledger_date').on(t.date),
  index('idx_ledger_seller_date').on(t.sellerId, t.date),
  index('idx_ledger_type').on(t.type),
]);

export const recoveryActionTypeEnum = pgEnum('recovery_action_type', [
  'CALLED', 'VISITED', 'PROMISE_TO_PAY', 'REFUSED', 'LEGAL_WARNING',
]);

export const recoveryActions = pgTable('recovery_actions', {
  id:             text('id').primaryKey().$defaultFn(() => randomUUID()),
  installmentId:  text('installment_id').notNull().references(() => installments.id, { onDelete: 'cascade' }),
  sellerId:       text('seller_id').notNull().references(() => sellers.id),
  userId:         text('user_id').references(() => users.id, { onDelete: 'set null' }),
  type:           recoveryActionTypeEnum('type').notNull(),
  note:           text('note'),
  promiseDate:    timestamp('promise_date'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_recovery_installment').on(t.installmentId),
  index('idx_recovery_seller').on(t.sellerId),
]);

export const auditLogs = pgTable('audit_logs', {
  id:          text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:    text('seller_id').notNull().references(() => sellers.id),
  userId:      text('user_id').references(() => users.id, { onDelete: 'set null' }),
  sessionId:   text('session_id').references(() => refreshTokens.id, { onDelete: 'set null' }),
  action:      text('action').notNull(),
  entityType:  text('entity_type').notNull(),
  entityId:    text('entity_id'),
  description: text('description').notNull(),
  reason:      text('reason'),
  before:      json('before'),
  after:       json('after'),
  meta:        json('meta'),
  ip:          text('ip'),
  userAgent:   text('user_agent'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_audit_seller').on(t.sellerId),
  index('idx_audit_seller_action').on(t.sellerId, t.action, t.createdAt),
  index('idx_audit_created_at').on(t.createdAt),
  index('idx_audit_user').on(t.userId),
  index('idx_audit_session').on(t.sessionId),
]);

export const payments = pgTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  installmentId: text('installment_id')
    .notNull()
    .references(() => installments.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paidOn: timestamp('paid_on').defaultNow().notNull(),
  method: paymentMethodEnum('method').notNull(),
  note: text('note'),
  collectedBy:   text('collected_by').references(() => users.id, { onDelete: 'set null' }),
  proofImageUrl: text('proof_image_url'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  index('idx_payments_installment').on(t.installmentId),
  index('idx_payments_paid_on').on(t.paidOn),
  index('idx_payments_installment_deleted').on(t.installmentId, t.deletedAt),
  index('idx_payments_collected_by').on(t.collectedBy),
  index('idx_payments_collected_by_date').on(t.collectedBy, t.paidOn),
  index('idx_payments_inst_date').on(t.installmentId, t.paidOn),
]);

export const cashSales = pgTable('cash_sales', {
  id:            text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:      text('seller_id').notNull().references(() => sellers.id),
  productId:     text('product_id').notNull().references(() => products.id),
  quantity:      integer('quantity').default(1).notNull(),
  amount:        decimal('amount', { precision: 12, scale: 2 }).notNull(),
  method:        paymentMethodEnum('method').notNull(),
  customerName:  text('customer_name'),
  customerPhone: text('customer_phone'),
  imeiNumber:    text('imei_number'),
  note:          text('note'),
  soldByUserId:  text('sold_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_cash_sales_seller').on(t.sellerId),
  index('idx_cash_sales_created_at').on(t.createdAt),
  index('idx_cash_sales_product').on(t.productId),
  index('idx_cash_sales_seller_date').on(t.sellerId, t.createdAt),
  index('idx_cash_sales_sold_by').on(t.soldByUserId),
  index('idx_cash_sales_sold_by_date').on(t.soldByUserId, t.createdAt),
]);

// ── Double-entry accounting ───────────────────────────────────────────────────

export const accountTypeEnum = pgEnum('account_type', ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);

export const chartOfAccounts = pgTable('chart_of_accounts', {
  id:        text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:  text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  code:      text('code').notNull(),
  name:      text('name').notNull(),
  type:      accountTypeEnum('type').notNull(),
  isSystem:  boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_coa_seller').on(t.sellerId),
  uniqueIndex('idx_coa_seller_code').on(t.sellerId, t.code),
]);

export const journalEntries = pgTable('journal_entries', {
  id:        text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:  text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  memo:      text('memo').notNull(),
  refType:   text('ref_type'),
  refId:     text('ref_id'),
  postedAt:  timestamp('posted_at').defaultNow().notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  index('idx_je_seller').on(t.sellerId),
  index('idx_je_posted_at').on(t.postedAt),
]);

export const ledgerLines = pgTable('ledger_lines', {
  id:        text('id').primaryKey().$defaultFn(() => randomUUID()),
  journalId: text('journal_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => chartOfAccounts.id),
  debit:     decimal('debit',  { precision: 12, scale: 2 }).default('0').notNull(),
  credit:    decimal('credit', { precision: 12, scale: 2 }).default('0').notNull(),
}, (t) => [
  index('idx_ll_journal').on(t.journalId),
  index('idx_ll_account').on(t.accountId),
]);

export const returnReasonEnum = pgEnum('return_reason', [
  'DEFECTIVE', 'DAMAGED_IN_USE', 'WRONG_ITEM', 'CUSTOMER_REQUEST', 'WARRANTY_CLAIM', 'OTHER',
]);
export const returnConditionEnum = pgEnum('return_condition', ['GOOD', 'DAMAGED', 'UNUSABLE']);
export const returnTypeEnum     = pgEnum('return_type',      ['RETURN', 'EXCHANGE', 'WARRANTY_REPLACEMENT']);
export const returnStatusEnum   = pgEnum('return_status',    ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED']);
export const resolutionTypeEnum = pgEnum('resolution_type',  ['RESALE', 'DAMAGED_WRITE_OFF', 'REPLACEMENT_SENT']);

export const customerNotes = pgTable('customer_notes', {
  id:          text('id').primaryKey().$defaultFn(() => randomUUID()),
  customerId:  text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  sellerId:    text('seller_id').notNull().references(() => sellers.id),
  userId:      text('user_id').references(() => users.id, { onDelete: 'set null' }),
  note:        text('note').notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  deletedAt:   timestamp('deleted_at'),
  deletedBy:   text('deleted_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  index('idx_customer_notes_customer').on(t.customerId),
  index('idx_customer_notes_seller').on(t.sellerId),
]);

export const returns = pgTable('returns', {
  id:                   text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:             text('seller_id').notNull().references(() => sellers.id),
  installmentId:        text('installment_id').references(() => installments.id, { onDelete: 'set null' }),
  customerId:           text('customer_id').notNull().references(() => customers.id),
  productId:            text('product_id').notNull().references(() => products.id),
  type:                 returnTypeEnum('type').notNull(),
  reason:               returnReasonEnum('reason').notNull(),
  condition:            returnConditionEnum('condition').notNull(),
  status:               returnStatusEnum('status').default('PENDING').notNull(),
  notes:                text('notes'),
  resolutionType:       resolutionTypeEnum('resolution_type'),
  replacementProductId: text('replacement_product_id').references(() => products.id),
  refundAmount:         decimal('refund_amount', { precision: 12, scale: 2 }),
  resolvedAt:           timestamp('resolved_at'),
  resolvedByUserId:     text('resolved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdByUserId:      text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_returns_seller').on(t.sellerId),
  index('idx_returns_customer').on(t.customerId),
  index('idx_returns_status').on(t.status),
]);

export const reconciliationRuns = pgTable('reconciliation_runs', {
  id:            text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:      text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  runAt:         timestamp('run_at').defaultNow().notNull(),
  trigger:       text('trigger').notNull().default('SCHEDULED'), // 'SCHEDULED' | 'MANUAL'
  status:        text('status').notNull(),                       // 'OK' | 'ANOMALIES'
  anomalyCount:  integer('anomaly_count').default(0).notNull(),
  anomalies:     json('anomalies').notNull().$type<Anomaly[]>(),
  ledgerTotal:   decimal('ledger_total',    { precision: 12, scale: 2 }),
  paymentsTotal: decimal('payments_total',  { precision: 12, scale: 2 }),
  diff:          decimal('diff',            { precision: 12, scale: 2 }),
}, (t) => [
  index('idx_recon_seller').on(t.sellerId),
  index('idx_recon_run_at').on(t.runAt),
]);

export interface Anomaly {
  type: 'LEDGER_PAYMENT_MISMATCH' | 'INSTALLMENT_REMAINING_DRIFT' | 'JOURNAL_IMBALANCE';
  severity: 'HIGH' | 'MEDIUM';
  detail: string;
  entityId?: string;
  diff: number;
}

export const paymentAccountTypeEnum = pgEnum('payment_account_type', [
  'BANK', 'JAZZCASH', 'EASYPAISA', 'SADAPAY', 'NAYAPAY', 'OTHER',
]);

export const paymentAccounts = pgTable('payment_accounts', {
  id:            text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:      text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  type:          paymentAccountTypeEnum('type').notNull(),
  accountTitle:  text('account_title').notNull(),
  accountNumber: text('account_number').notNull(),
  bankName:      text('bank_name'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_payment_accounts_seller').on(t.sellerId),
]);

// ── IMEI / Physical unit inventory ────────────────────────────────────────────
// Each row represents one physical phone unit identified by its IMEI.
// status lifecycle: available → sold | defective | returned → available (re-sold)
export const unitStatusEnum = pgEnum('unit_status', ['available', 'sold', 'defective', 'returned']);
export const ptaStatusEnum  = pgEnum('pta_status',  ['approved', 'non_pta', 'unknown']);

export const productUnits = pgTable('product_units', {
  id:            text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:      text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  productId:     text('product_id').references(() => products.id, { onDelete: 'set null' }),
  imei:          text('imei').notNull(),
  imei2:         text('imei2'),
  color:         text('color'),
  storageGb:     integer('storage_gb'),
  condition:     text('condition').default('new').notNull(),
  purchasePrice: decimal('purchase_price', { precision: 12, scale: 2 }),
  status:        unitStatusEnum('status').default('available').notNull(),
  notes:         text('notes'),
  ptaStatus:     ptaStatusEnum('pta_status').default('unknown').notNull(),
  soldAt:        timestamp('sold_at', { withTimezone: true }),
  saleType:      text('sale_type'),
  soldToName:    text('sold_to_name'),
  deletedAt:     timestamp('deleted_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('idx_product_units_seller_imei').on(t.sellerId, t.imei),
  index('idx_product_units_seller').on(t.sellerId),
  index('idx_product_units_status').on(t.status),
  index('idx_product_units_product').on(t.productId),
]);

// ── Cash Handover tracking ────────────────────────────────────────────────────
export const handoverStatusEnum = pgEnum('handover_status', ['PENDING', 'CONFIRMED', 'DISPUTED']);

export const staffHandovers = pgTable('staff_handovers', {
  id:              text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:        text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  staffId:         text('staff_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  handedAmount:    decimal('handed_amount',    { precision: 14, scale: 2 }).notNull(),
  confirmedAmount: decimal('confirmed_amount', { precision: 14, scale: 2 }),
  note:            text('note'),
  ownerNote:       text('owner_note'),
  status:          handoverStatusEnum('status').default('PENDING').notNull(),
  handoverDate:    timestamp('handover_date').notNull(),
  confirmedAt:     timestamp('confirmed_at'),
  confirmedById:   text('confirmed_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_handovers_seller').on(t.sellerId),
  index('idx_handovers_staff').on(t.staffId),
  index('idx_handovers_date').on(t.handoverDate),
  index('idx_handovers_status').on(t.status),
]);

export const whatsappTemplates = pgTable('whatsapp_templates', {
  id:        text('id').primaryKey().$defaultFn(() => randomUUID()),
  sellerId:  text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  body:      text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_wa_templates_seller').on(t.sellerId),
]);

// OCR result cache — keyed by SHA-256 hash of the raw image bytes.
// Prevents duplicate Groq API calls for the same image (re-uploads, same
// guarantor used across multiple customers, testing, form re-submissions).
export const ocrCache = pgTable('ocr_cache', {
  hash:      text('hash').notNull(),
  docType:   text('doc_type').notNull(),
  result:    json('result').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('ocr_cache_hash_doctype').on(t.hash, t.docType),
]);

// ── Staff Attendance ──────────────────────────────────────────────────────────
export const attendance = pgTable('attendance', {
  id:       text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId:   text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sellerId: text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  date:     date('date').notNull(),
  clockIn:  timestamp('clock_in', { withTimezone: true }).notNull().defaultNow(),
  clockOut: timestamp('clock_out', { withTimezone: true }),
  notes:    text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_attendance_seller_date').on(t.sellerId, t.date),
  index('idx_attendance_user').on(t.userId),
]);
