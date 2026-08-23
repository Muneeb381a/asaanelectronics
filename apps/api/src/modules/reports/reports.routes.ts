import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { getMonthlyReport, getMonthlyCustomers, getAreaReport, getAgingReport, getCollectionsHeatmap, getPnL, getForecastReport, getCustomerBalances, getCashflowCalendar, getCashflowDay, getCohortAnalysis } from './reports.controller.js';

const router = Router();

router.use(authenticate, requireSeller);
router.use(requirePermission('canViewReports'));

router.get('/monthly',              getMonthlyReport);
router.get('/monthly-customers',    getMonthlyCustomers);
router.get('/areas',                getAreaReport);
router.get('/aging',                getAgingReport);
router.get('/collections-heatmap',  getCollectionsHeatmap);
router.get('/pnl',                  getPnL);
router.get('/forecast',             getForecastReport);
router.get('/customer-balances',    getCustomerBalances);
router.get('/cashflow-calendar',    getCashflowCalendar);
router.get('/cashflow-day',         getCashflowDay);
router.get('/cohort',               getCohortAnalysis);

export default router;
