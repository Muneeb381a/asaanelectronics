import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { getMonthlyReport, getMonthlyCustomers, getAreaReport, getAgingReport, getCollectionsHeatmap, getPnL, getForecastReport, getCustomerBalances, getCashflowCalendar, getCashflowDay } from './reports.controller.js';

const router = Router();

router.use(authenticate, requireSeller);
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

export default router;
