import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { errorMiddleware } from './middleware/error.js';
import { ipBlockMiddleware } from './middleware/ipBlock.js';
import { requestSigningMiddleware } from './middleware/requestSigning.js';
import authRoutes from './modules/auth/auth.routes.js';
import sellersRoutes from './modules/sellers/sellers.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import installmentsRoutes from './modules/installments/installments.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import statsRoutes from './modules/stats/stats.routes.js';
import ownerRoutes from './modules/owner/owner.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';
import staffRoutes from './modules/staff/staff.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';
import verificationsRoutes from './modules/verifications/verifications.routes.js';
import expensesRoutes from './modules/expenses/expenses.routes.js';
import ledgerRoutes from './modules/ledger/ledger.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import recoveryRoutes from './modules/recovery/recovery.routes.js';
import sessionsRoutes from './modules/sessions/sessions.routes.js';
import billingRoutes  from './modules/billing/billing.routes.js';
import returnsRoutes          from './modules/returns/returns.routes.js';
import accountingRoutes        from './modules/accounting/accounting.routes.js';
import reconciliationRoutes    from './modules/reconciliation/reconciliation.routes.js';
import portalRoutes            from './modules/portal/portal.routes.js';
import cashSalesRoutes         from './modules/cashSales/cashSales.routes.js';
import productUnitsRoutes      from './modules/productUnits/productUnits.routes.js';
import reportsRoutes           from './modules/reports/reports.routes.js';
import whatsappTemplatesRoutes from './modules/whatsappTemplates/whatsappTemplates.routes.js';
import handoversRoutes         from './modules/handovers/handovers.routes.js';
import attendanceRoutes        from './modules/attendance/attendance.routes.js';
import exportsRoutes           from './modules/exports/exports.routes.js';
import suppliersRoutes         from './modules/suppliers/suppliers.routes.js';
import tradeInsRoutes          from './modules/tradeIns/tradeIns.routes.js';
import repossessionsRoutes     from './modules/repossessions/repossessions.routes.js';
import searchRoutes            from './modules/search/search.routes.js';
import broadcastsRoutes        from './modules/broadcasts/broadcasts.routes.js';

const app = express();

app.set('trust proxy', 1); // Vercel / any reverse proxy sets X-Forwarded-For
app.use(helmet());
const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // allow production frontend + any Vercel preview deployments for this project
    if (origin.match(/^https:\/\/(web-red-six-12|assaan[a-z0-9-]*)\.vercel\.app$/)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '500kb' }));

// ── Rate limiters ─────────────────────────────────────────────────────────
import { paymentLimiter } from './middleware/limiters.js';
import type { RequestHandler } from 'express';

// Wrap any rate-limiter so an unhandled async error goes to next(err) instead
// of crashing the serverless function (which would close the socket with no headers).
function safeLimit(limiter: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(limiter(req, res, next)).catch(next);
  };
}

// General auth (register, refresh, forgot-password, etc.): 30/15 min
const authLimiter = safeLimit(rateLimit({
  windowMs: 15 * 60_000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
}));

// General API: 300/min (raised — auth/payment have their own guards)
const apiLimiter = safeLimit(rateLimit({
  windowMs: 60_000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  // import is authenticated (requireOwner) so skip rate-limit; it also avoids
  // serverless in-memory store issues on long-running requests.
  skip: (req) => req.path === '/health' || req.path === '/installments/import',
  validate: { xForwardedForHeader: false },
}));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Request signing — opt-in via REQUEST_SIGNING_SECRET env var
app.use('/api', requestSigningMiddleware);
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/sellers', sellersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/installments', installmentsRoutes);
app.use('/api/payments', paymentLimiter, paymentsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/verifications', verificationsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/recovery', recoveryRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/billing',  billingRoutes);
app.use('/api/returns',     returnsRoutes);
app.use('/api/accounting',      accountingRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/portal',         portalRoutes);
app.use('/api/cash-sales',     cashSalesRoutes);
app.use('/api/units',          productUnitsRoutes);
app.use('/api/reports',        reportsRoutes);
app.use('/api/whatsapp-templates', whatsappTemplatesRoutes);
app.use('/api/handovers',          handoversRoutes);
app.use('/api/attendance',         attendanceRoutes);
app.use('/api/exports',            exportsRoutes);
app.use('/api/suppliers',          suppliersRoutes);
app.use('/api/trade-ins',          tradeInsRoutes);
app.use('/api/repossessions',      repossessionsRoutes);
app.use('/api/search',             searchRoutes);
app.use('/api/broadcasts',            broadcastsRoutes);

app.use((_req, res) => res.status(404).json({ success: false, data: null, error: 'Not found' }));
app.use(errorMiddleware);

export default app;
