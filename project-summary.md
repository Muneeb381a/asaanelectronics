# Assaan Electronics — Project Summary
_Last updated: 2026-05-22_

## Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm workspaces |
| API | Express v5, TypeScript (NodeNext), Drizzle ORM, PostgreSQL |
| Web | React 19, Vite, Tailwind v4, TanStack Query |
| Shared | `@assaan/shared` — Zod schemas, types |
| Auth | JWT (access + refresh), bcrypt, session table |
| Billing | Plan-gated features (TRIAL / BASIC / PRO / ENTERPRISE) |

---

## Architecture

```
apps/
  api/   → REST API
    src/modules/{customers,installments,payments,products,
                 returns,staff,verifications,ledger,billing,
                 sessions,sellers,audit-logs,stats}/
    src/db/schema.ts   → single Drizzle schema file
    src/lib/fsm.ts     → state machine (installments + verifications)
  web/   → SPA
    src/pages/         → one file per route
    src/features/      → complex form components
    src/api/           → axios wrappers per domain
    src/components/ui/ → shared UI (Skeleton, EmptyState)
```

**Key patterns**
- Soft delete: `isNull(table.deletedAt)` on every query
- Multi-tenant: every query scoped by `sellerId`
- FSM: `fsm.installment.assert(from, to)` / `fsm.verification.assert(from, to)` — throws 400 on invalid transition
- Migration: `cd apps/api && pnpm exec drizzle-kit push`

---

## Roles

| Role | Access |
|------|--------|
| `SELLER_OWNER` | Full access — all mutations, staff management, billing |
| `SELLER_STAFF` (Account) | Customers, installments, payments, products |
| `SELLER_STAFF` (AVO) | Verification queue only |
| `PLATFORM_OWNER` | All shops — ShopsPage only |

---

## Features — Complete

### Customers
- Add / edit / soft-delete with CNIC uniqueness check
- Credit label (GOOD / AVERAGE / RISKY / BLACKLIST)
- Verification flow: PENDING → UNDER_REVIEW → APPROVED / REJECTED
- Assign AVO officer, reassign from UNDER_REVIEW
- Customer history drawer (installments + internal staff notes)
- Customer agreement print + statement print
- WhatsApp reminder shortcut

### Installments
- FSM: PENDING → ACTIVE → COMPLETED → CLOSED, ACTIVE → DEFAULTED, CANCELLED
- Approve (owner), Pay, Reschedule, Mark Default, Recovery, Close, Cancel
- Action dropdown (⋮ menu) — replaces crammed text buttons
- Bill PDF generation
- Export CSV
- Payment history with owner delete

### Products
- CRUD, serial number, stock tracking
- Low-stock banner + row highlight (≤3 units)
- Out-of-stock guard on installment creation

### Returns
- Create return request, resolve (COMPLETED / REJECTED)
- Status tabs: ALL / PENDING / COMPLETED / REJECTED

### Staff
- Add Account Staff or AVO with preset permissions
- Per-permission toggles (owner only)
- Remove staff member

### Verification Queue (AVO view)
- Photo evidence upload, GPS coordinates
- Approve / reject with notes

### Reports
- Monthly collections chart + collection rate
- Aging buckets (1–30 / 31–60 / 60+ days overdue)
- Defaulted installments breakdown
- AVO performance table (owner only)

### Ledger / Accounting
- Cash book: CREDIT (payment received) / DEBIT (expense)
- Expense categories enum
- Wallet balance running total
- Expense CRUD

### Settings
- Shop info edit
- Active sessions list with revoke / revoke-all
- Billing usage bars (customers / staff / installments vs plan limits)

### Audit Log
- Every mutation logged with user, action, entity, before/after

---

## State Machines

**Installment**
```
PENDING → ACTIVE (approve)
ACTIVE  → COMPLETED (last payment)
ACTIVE  → DEFAULTED (mark default)
DEFAULTED → ACTIVE (reschedule / recovery)
COMPLETED / DEFAULTED → CLOSED (close)
PENDING / ACTIVE → CANCELLED (cancel)
```

**Verification**
```
PENDING → UNDER_REVIEW (assign AVO)
UNDER_REVIEW → APPROVED / REJECTED (AVO submits)
```

---

## UI Components (shared)

| Component | Usage |
|-----------|-------|
| `TableSkeleton` | Loading state for data tables |
| `CardSkeleton` | Loading state for card grids |
| `RowSkeleton` | Loading state for list rows |
| `BlockSkeleton` | One-off shape placeholder |
| `EmptyState` | Consistent empty state (icon + title + CTA) |

---

## Pending / In Progress

| # | Item | Status |
|---|------|--------|
| 1 | Expenses CRUD backend module | in progress |
| 2 | Ledger auto-post (CREDIT on payment, DEBIT on expense) | pending |
| 3 | Accounting reports endpoint (P&L, cash book, daily summary) | pending |
| 4 | Ledger page frontend (cash book + wallet balance) | pending |
| 5 | P&L card in Reports page | pending |
| 6 | Ledger in sidebar nav (owner only) | pending |
