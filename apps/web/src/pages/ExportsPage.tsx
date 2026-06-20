import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, RefreshCw, AlertTriangle, ShieldX, CalendarCheck, ShoppingCart, Undo2, Receipt, BarChart3, Users } from 'lucide-react';
import { installmentsApi } from '../api/installments.api.ts';
import { paymentsApi } from '../api/payments.api.ts';
import { cashSalesApi } from '../api/cashSales.api.ts';
import { returnsApi } from '../api/returns.api.ts';
import { expensesApi } from '../api/expenses.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { reportsApi } from '../api/reports.api.ts';
import { printReport } from '../utils/exportPdf.ts';
import { fmtDate } from '../utils/dateFormat.ts';

type Tab = 'overdue' | 'defaulters' | 'today' | 'cashsales' | 'returns' | 'expenses' | 'monthly' | 'monthly-customers';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', BANK: 'Bank', JAZZCASH: 'JazzCash', EASYPAISA: 'EasyPaisa', OTHER: 'Other',
};

const CAT_LABELS: Record<string, string> = {
  RENT: 'Rent', SALARY: 'Salary', UTILITY: 'Utility', PURCHASE: 'Purchase',
  MAINTENANCE: 'Maintenance', TRANSPORT: 'Transport', OTHER: 'Other',
};

const RETURN_TYPE_LABELS: Record<string, string> = {
  RETURN: 'Return', EXCHANGE: 'Exchange', WARRANTY_REPLACEMENT: 'Warranty',
};

const RETURN_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', COMPLETED: 'Completed',
};

function pkr(n: number | string) {
  return 'PKR ' + Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function todayStr() {
  return new Date().toISOString().split('T')[0]!;
}

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0]!;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0]!;
}

export default function ExportsPage() {
  const [tab, setTab] = useState<Tab>('overdue');
  const [cashRange, setCashRange] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [expenseRange, setExpenseRange] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [returnsStatus, setReturnsStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED'>('ALL');
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [custYear,  setCustYear]  = useState(new Date().getFullYear());
  const [custMonth, setCustMonth] = useState(new Date().getMonth() + 1);

  const { data: seller } = useQuery({
    queryKey: ['seller-me'],
    queryFn: sellersApi.getMe,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const today = todayStr();
  const shopName = seller?.shopName ?? 'Shop';

  const cashFrom = cashRange === 'today' ? today
    : cashRange === 'week' ? startOfWeek()
    : cashRange === 'month' ? startOfMonth()
    : undefined;

  const expenseFrom = expenseRange === 'today' ? today
    : expenseRange === 'week' ? startOfWeek()
    : expenseRange === 'month' ? startOfMonth()
    : undefined;

  const overdueQ = useQuery({
    queryKey: ['export-overdue'],
    queryFn: () => installmentsApi.exportAll({ status: 'ACTIVE' }),
    staleTime: 60_000,
    enabled: tab === 'overdue',
  });

  const defaultersQ = useQuery({
    queryKey: ['export-defaulters'],
    queryFn: () => installmentsApi.exportAll({ status: 'DEFAULTED' }),
    staleTime: 60_000,
    enabled: tab === 'defaulters' || tab === 'overdue',
  });

  const todayPayQ = useQuery({
    queryKey: ['export-today', today],
    queryFn: () => paymentsApi.listBySeller({ from: today, to: today }),
    staleTime: 60_000,
    enabled: tab === 'today',
  });

  const cashQ = useQuery({
    queryKey: ['export-cash', cashRange],
    queryFn: () => cashSalesApi.list({ limit: 5000, from: cashFrom, to: cashRange === 'all' ? undefined : today }),
    staleTime: 60_000,
    enabled: tab === 'cashsales',
  });

  const returnsQ = useQuery({
    queryKey: ['export-returns', returnsStatus],
    queryFn: () => returnsApi.list({ limit: 5000, status: returnsStatus === 'ALL' ? undefined : returnsStatus }),
    staleTime: 60_000,
    enabled: tab === 'returns',
  });

  const expensesQ = useQuery({
    queryKey: ['export-expenses', expenseRange],
    queryFn: () => expensesApi.list(expenseFrom, expenseRange === 'all' ? undefined : today),
    staleTime: 60_000,
    enabled: tab === 'expenses',
  });

  const monthlyQ = useQuery({
    queryKey: ['export-monthly', monthlyYear],
    queryFn: () => reportsApi.getMonthly(monthlyYear),
    staleTime: 5 * 60_000,
    enabled: tab === 'monthly',
  });

  const custMonthlyQ = useQuery({
    queryKey: ['export-monthly-customers', custYear, custMonth],
    queryFn: () => reportsApi.getMonthlyCustomers(custYear, custMonth),
    staleTime: 5 * 60_000,
    enabled: tab === 'monthly-customers',
  });

  const overdue   = (overdueQ.data?.data   ?? []).filter((i) => i.isOverdue);
  const defaulters = defaultersQ.data?.data ?? [];
  const todayPay  = Array.isArray(todayPayQ.data) ? todayPayQ.data : [];
  const cashSales = cashQ.data?.data ?? [];
  const returnsList = returnsQ.data?.data ?? [];
  const expensesList = expensesQ.data ?? [];
  const monthlyRows = monthlyQ.data ?? [];
  const custRows    = custMonthlyQ.data ?? [];

  function downloadOverdueOnly() {
    const totalRem = overdue.reduce((s, i) => s + Number(i.remaining), 0);
    printReport({
      title: 'Overdue Installments',
      subtitle: `Active customers behind on payment — generated ${fmtDate(today)}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['#', 'Customer', 'Phone', 'Area', 'Product', 'Invoice', 'Remaining (PKR)', 'Monthly (PKR)'],
      rows: overdue.map((i, idx) => [
        idx + 1,
        i.customerName,
        i.customerPhone,
        i.customerArea ?? '-',
        i.productName,
        i.invoiceNumber ?? '-',
        Number(i.remaining).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
        Number(i.monthly).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
      ]),
      summary: [
        `<strong>Total overdue:</strong> ${overdue.length}`,
        `<strong>Total remaining:</strong> ${pkr(totalRem)}`,
      ],
    });
  }

  function downloadOverdueCombined() {
    const combined = [
      ...overdue.map((i) => ({ ...i, _tag: 'Overdue' as const })),
      ...defaulters.map((i) => ({ ...i, _tag: 'Defaulted' as const })),
    ];
    const totalRem = combined.reduce((s, i) => s + Number(i.remaining), 0);
    printReport({
      title: 'Overdue & Defaulted Installments',
      subtitle: `Full recovery list — generated ${fmtDate(today)}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['#', 'Customer', 'Phone', 'Area', 'Product', 'Invoice', 'Remaining (PKR)', 'Monthly (PKR)', 'Status'],
      rows: combined.map((i, idx) => [
        idx + 1,
        i.customerName,
        i.customerPhone,
        i.customerArea ?? '-',
        i.productName,
        i.invoiceNumber ?? '-',
        Number(i.remaining).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
        Number(i.monthly).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
        i._tag,
      ]),
      summary: [
        `<strong>Overdue (active):</strong> ${overdue.length}`,
        `<strong>Defaulted:</strong> ${defaulters.length}`,
        `<strong>Total remaining:</strong> ${pkr(totalRem)}`,
      ],
    });
  }

  function downloadDefaulters() {
    const totalRem = defaulters.reduce((s, i) => s + Number(i.remaining), 0);
    printReport({
      title: 'Defaulter Customers',
      subtitle: `Installments marked as defaulted — generated ${fmtDate(today)}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['#', 'Customer', 'Phone', 'Area', 'Product', 'Invoice', 'Total (PKR)', 'Remaining (PKR)'],
      rows: defaulters.map((i, idx) => [
        idx + 1,
        i.customerName,
        i.customerPhone,
        i.customerArea ?? '-',
        i.productName,
        i.invoiceNumber ?? '-',
        Number(i.totalAmount).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
        Number(i.remaining).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
      ]),
      summary: [
        `<strong>Total defaulters:</strong> ${defaulters.length}`,
        `<strong>Total outstanding:</strong> ${pkr(totalRem)}`,
      ],
    });
  }

  function downloadTodayPayments() {
    const total = todayPay.reduce((s, p) => s + Number(p.amount), 0);
    printReport({
      title: "Today's Collections",
      subtitle: `Payments collected on ${fmtDate(today)}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['#', 'Customer', 'Phone', 'Product', 'Invoice', 'Amount (PKR)', 'Method', 'Collector'],
      rows: todayPay.map((p, idx) => [
        idx + 1,
        p.customerName,
        p.customerPhone,
        p.productName,
        p.invoiceNumber ?? '-',
        Number(p.amount).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
        METHOD_LABELS[p.method] ?? p.method,
        p.collectorName ?? '-',
      ]),
      summary: [
        `<strong>Total payments collected:</strong> ${todayPay.length}`,
        `<strong>Total amount:</strong> ${pkr(total)}`,
      ],
    });
  }

  function downloadReturns() {
    printReport({
      title: `Returns & Exchanges${returnsStatus !== 'ALL' ? ` — ${RETURN_STATUS_LABELS[returnsStatus]}` : ''}`,
      subtitle: `Generated ${fmtDate(today)}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['#', 'Customer', 'Phone', 'Product', 'Type', 'Reason', 'Status', 'Refund (PKR)', 'Date'],
      rows: returnsList.map((r, idx) => [
        idx + 1,
        r.customerName,
        r.customerPhone,
        r.productName,
        RETURN_TYPE_LABELS[r.type] ?? r.type,
        r.reason.replace(/_/g, ' '),
        RETURN_STATUS_LABELS[r.status] ?? r.status,
        r.refundAmount ? Number(r.refundAmount).toLocaleString('en-PK', { maximumFractionDigits: 0 }) : '-',
        fmtDate(r.createdAt),
      ]),
      summary: [
        `<strong>Total records:</strong> ${returnsList.length}`,
        `<strong>Total refunds issued:</strong> ${pkr(returnsList.reduce((s, r) => s + Number(r.refundAmount ?? 0), 0))}`,
      ],
    });
  }

  function downloadExpenses() {
    const total = expensesList.reduce((s, e) => s + Number(e.amount), 0);
    const rangeLabel = expenseRange === 'today' ? 'Today'
      : expenseRange === 'week' ? 'This Week'
      : expenseRange === 'month' ? 'This Month'
      : 'All Time';
    printReport({
      title: `Expenses — ${rangeLabel}`,
      subtitle: `Generated ${fmtDate(today)}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['#', 'Date', 'Category', 'Description', 'Amount (PKR)'],
      rows: expensesList.map((e, idx) => [
        idx + 1,
        fmtDate(e.date),
        CAT_LABELS[e.category] ?? e.category,
        e.description ?? '-',
        Number(e.amount).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
      ]),
      summary: [
        `<strong>Total expenses:</strong> ${expensesList.length}`,
        `<strong>Total amount:</strong> ${pkr(total)}`,
      ],
    });
  }

  function downloadCashSales() {
    const total = cashSales.reduce((s, c) => s + Number(c.amount), 0);
    const rangeLabel = cashRange === 'today' ? 'Today'
      : cashRange === 'week' ? 'This Week'
      : cashRange === 'month' ? 'This Month'
      : 'All Time';
    printReport({
      title: `Cash Sales — ${rangeLabel}`,
      subtitle: `Direct sales without installment plan`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['#', 'Customer', 'Phone', 'Product', 'Qty', 'Amount (PKR)', 'Method', 'IMEI', 'Date'],
      rows: cashSales.map((c, idx) => [
        idx + 1,
        c.customerName ?? 'Walk-in',
        c.customerPhone ?? '-',
        c.productName,
        c.quantity,
        Number(c.amount).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
        METHOD_LABELS[c.method] ?? c.method,
        c.imeiNumber ?? '-',
        fmtDate(c.createdAt),
      ]),
      summary: [
        `<strong>Total sales:</strong> ${cashSales.length}`,
        `<strong>Total revenue:</strong> ${pkr(total)}`,
      ],
    });
  }

  const tabs: { id: Tab; label: string; icon: typeof FileDown }[] = [
    { id: 'monthly',           label: 'Monthly Summary',  icon: BarChart3 },
    { id: 'monthly-customers', label: 'Monthly Customers', icon: Users },
    { id: 'overdue',           label: 'Overdue',           icon: AlertTriangle },
    { id: 'defaulters', label: 'Defaulters',        icon: ShieldX },
    { id: 'today',      label: "Today's Payments",  icon: CalendarCheck },
    { id: 'cashsales',  label: 'Cash Sales',        icon: ShoppingCart },
    { id: 'returns',    label: 'Returns',           icon: Undo2 },
    { id: 'expenses',   label: 'Expenses',          icon: Receipt },
  ];

  const isLoading =
    (tab === 'overdue'    && (overdueQ.isFetching || defaultersQ.isFetching)) ||
    (tab === 'defaulters' && defaultersQ.isFetching) ||
    (tab === 'today'      && todayPayQ.isFetching) ||
    (tab === 'cashsales'  && cashQ.isFetching) ||
    (tab === 'returns'    && returnsQ.isFetching) ||
    (tab === 'expenses'   && expensesQ.isFetching) ||
    (tab === 'monthly'           && monthlyQ.isFetching) ||
    (tab === 'monthly-customers' && custMonthlyQ.isFetching);

  function refetchCurrent() {
    if (tab === 'overdue')    { void overdueQ.refetch(); void defaultersQ.refetch(); }
    if (tab === 'defaulters') void defaultersQ.refetch();
    if (tab === 'today')      void todayPayQ.refetch();
    if (tab === 'cashsales')  void cashQ.refetch();
    if (tab === 'returns')    void returnsQ.refetch();
    if (tab === 'expenses')   void expensesQ.refetch();
    if (tab === 'monthly')           void monthlyQ.refetch();
    if (tab === 'monthly-customers') void custMonthlyQ.refetch();
  }

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  function downloadMonthlyCustomersPdf() {
    const monthLabel  = `${MONTH_NAMES[custMonth - 1]} ${custYear}`;
    const daysInMonth = new Date(custYear, custMonth, 0).getDate();
    const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 });

    const expectedAmount = (r: typeof custRows[number]) =>
      r.paymentFrequency === 'daily' ? r.monthlyAmount * daysInMonth : r.monthlyAmount;

    const paidCount      = custRows.filter((r) => r.status === 'Paid').length;
    const pendingCount   = custRows.filter((r) => r.status === 'Pending').length;
    const defaultedCount = custRows.filter((r) => r.status === 'Defaulted').length;
    const totalCollected = custRows.reduce((s, r) => s + r.paidAmount, 0);
    const totalOutstanding = custRows
      .filter((r) => r.status !== 'Paid')
      .reduce((s, r) => s + expectedAmount(r), 0);

    printReport({
      title: `Monthly Installment Report — ${monthLabel}`,
      subtitle: `Customer-wise payment status for ${monthLabel}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['Sr No', 'Client ID', 'Customer Name', 'Rupees', 'Mobile Number', 'Status'],
      rows: custRows.map((r) => [
        r.srNo,
        r.clientId,
        r.customerName,
        r.status === 'Paid'
          ? `PKR ${fmt(r.paidAmount)}`
          : `PKR ${fmt(expectedAmount(r))}`,
        r.customerPhone,
        r.status,
      ]),
      summary: [
        `<strong>Month:</strong> ${monthLabel}`,
        `<strong>Total customers:</strong> ${custRows.length}`,
        `<strong>Paid:</strong> ${paidCount}  &nbsp;|&nbsp;  <strong>Pending:</strong> ${pendingCount}  &nbsp;|&nbsp;  <strong>Defaulted:</strong> ${defaultedCount}`,
        `<strong>Total collected this month:</strong> PKR ${fmt(totalCollected)}`,
        `<strong>Total outstanding (pending + defaulted):</strong> PKR ${fmt(totalOutstanding)}`,
      ],
    });
  }

  function downloadMonthlyCustomersBlankPdf() {
    const monthLabel  = `${MONTH_NAMES[custMonth - 1]} ${custYear}`;
    const daysInMonth = new Date(custYear, custMonth, 0).getDate();
    const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 });

    // Daily customers: per-day amount × days in month; monthly: just monthly amount
    const expectedAmount = (r: typeof custRows[number]) =>
      r.paymentFrequency === 'daily' ? r.monthlyAmount * daysInMonth : r.monthlyAmount;

    const totalMonthly = custRows.reduce((s, r) => s + expectedAmount(r), 0);

    printReport({
      title: `Monthly Collection Register — ${monthLabel}`,
      subtitle: `Printable register for manual collection tracking — ${monthLabel}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['Sr No', 'Client ID', 'Customer Name', 'Rupees', 'Mobile Number', 'Status'],
      rows: custRows.map((r) => [
        r.srNo,
        r.clientId,
        r.customerName,
        `PKR ${fmt(expectedAmount(r))}`,
        r.customerPhone,
        '',
      ]),
      summary: [
        `<strong>Month:</strong> ${monthLabel}  (${daysInMonth} days)`,
        `<strong>Total customers:</strong> ${custRows.length}`,
        `<strong>Total expected this month:</strong> PKR ${fmt(totalMonthly)}`,
        `<strong>Collector:</strong> _______________________`,
        `<strong>Date:</strong> _______________________`,
      ],
    });
  }

  function downloadMonthlyPdf() {
    const activeMonths = monthlyRows.filter((r) => r.newInstallments > 0 || r.newCustomers > 0 || r.paymentsCollected > 0 || r.cashSalesAmount > 0);
    const totals = monthlyRows.reduce(
      (acc, r) => ({
        newInstallments:   acc.newInstallments   + r.newInstallments,
        totalSaleAmount:   acc.totalSaleAmount   + r.totalSaleAmount,
        downPayments:      acc.downPayments      + r.downPayments,
        newCustomers:      acc.newCustomers      + r.newCustomers,
        paymentsCollected: acc.paymentsCollected + r.paymentsCollected,
        cashSalesCount:    acc.cashSalesCount    + r.cashSalesCount,
        cashSalesAmount:   acc.cashSalesAmount   + r.cashSalesAmount,
        totalExpenses:     acc.totalExpenses     + r.totalExpenses,
        netRevenue:        acc.netRevenue        + r.netRevenue,
      }),
      { newInstallments: 0, totalSaleAmount: 0, downPayments: 0, newCustomers: 0, paymentsCollected: 0, cashSalesCount: 0, cashSalesAmount: 0, totalExpenses: 0, netRevenue: 0 },
    );
    const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
    printReport({
      title: `Monthly Business Report — ${monthlyYear}`,
      subtitle: `Full-year summary for ${monthlyYear}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['Month', 'New Customers', 'New Installments', 'Sale Amount', 'Down Payments', 'Collections', 'Cash Sales', 'Cash Revenue', 'Expenses', 'Net Revenue'],
      rows: [
        ...monthlyRows.map((r) => [
          r.monthName,
          r.newCustomers,
          r.newInstallments,
          r.totalSaleAmount  > 0 ? `PKR ${fmt(r.totalSaleAmount)}`  : '-',
          r.downPayments     > 0 ? `PKR ${fmt(r.downPayments)}`     : '-',
          r.paymentsCollected > 0 ? `PKR ${fmt(r.paymentsCollected)}` : '-',
          r.cashSalesCount   > 0 ? r.cashSalesCount : '-',
          r.cashSalesAmount  > 0 ? `PKR ${fmt(r.cashSalesAmount)}`  : '-',
          r.totalExpenses    > 0 ? `PKR ${fmt(r.totalExpenses)}`    : '-',
          r.netRevenue !== 0 ? `PKR ${fmt(r.netRevenue)}`           : '-',
        ]),
        // Totals row
        [
          'TOTAL',
          totals.newCustomers,
          totals.newInstallments,
          `PKR ${fmt(totals.totalSaleAmount)}`,
          `PKR ${fmt(totals.downPayments)}`,
          `PKR ${fmt(totals.paymentsCollected)}`,
          totals.cashSalesCount,
          `PKR ${fmt(totals.cashSalesAmount)}`,
          `PKR ${fmt(totals.totalExpenses)}`,
          `PKR ${fmt(totals.netRevenue)}`,
        ],
      ],
      summary: [
        `<strong>Year:</strong> ${monthlyYear}`,
        `<strong>Active months:</strong> ${activeMonths.length}`,
        `<strong>New customers:</strong> ${totals.newCustomers}`,
        `<strong>New installments:</strong> ${totals.newInstallments}  ·  Total sale value: PKR ${fmt(totals.totalSaleAmount)}`,
        `<strong>Total collections (installments):</strong> PKR ${fmt(totals.paymentsCollected)}`,
        `<strong>Cash sales:</strong> ${totals.cashSalesCount}  ·  Revenue: PKR ${fmt(totals.cashSalesAmount)}`,
        `<strong>Total expenses:</strong> PKR ${fmt(totals.totalExpenses)}`,
        `<strong>Net revenue:</strong> PKR ${fmt(totals.netRevenue)}`,
      ],
    });
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Exports &amp; Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Preview and download PDF reports</p>
        </div>
        <button
          onClick={refetchCurrent}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Monthly Customers tab */}
      {tab === 'monthly-customers' && (() => {
        const fmt         = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
        const daysInMonth = new Date(custYear, custMonth, 0).getDate();
        const expectedAmt = (r: typeof custRows[number]) =>
          r.paymentFrequency === 'daily' ? r.monthlyAmount * daysInMonth : r.monthlyAmount;
        const paidRows      = custRows.filter((r) => r.status === 'Paid');
        const pendingRows   = custRows.filter((r) => r.status === 'Pending');
        const defaultedRows = custRows.filter((r) => r.status === 'Defaulted');
        const collected     = paidRows.reduce((s, r) => s + r.paidAmount, 0);
        const pending       = pendingRows.reduce((s, r) => s + expectedAmt(r), 0);
        const currentYear = new Date().getFullYear();
        const yearOptions = Array.from({ length: currentYear - 2023 }, (_, i) => currentYear - i);

        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Monthly Customer Report</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Per-customer installment status for the selected month
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Month picker */}
                <select
                  value={custMonth}
                  onChange={(e) => setCustMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {MONTH_NAMES.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                {/* Year picker */}
                <select
                  value={custYear}
                  onChange={(e) => setCustYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  onClick={downloadMonthlyCustomersBlankPdf}
                  disabled={custMonthlyQ.isLoading || custRows.length === 0}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <FileDown size={15} />
                  Print Blank Register
                </button>
                <button
                  onClick={downloadMonthlyCustomersPdf}
                  disabled={custMonthlyQ.isLoading || custRows.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <FileDown size={15} />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Stats strip */}
            {!custMonthlyQ.isLoading && custRows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 divide-x border-b border-gray-100">
                {[
                  { label: 'Total',      value: custRows.length,         color: 'text-gray-900' },
                  { label: 'Paid',       value: paidRows.length,         color: 'text-green-700' },
                  { label: 'Pending',    value: pendingRows.length,       color: 'text-orange-600' },
                  { label: 'Defaulted',  value: defaultedRows.length,     color: 'text-red-600' },
                  { label: 'Collected',  value: `PKR ${fmt(collected)}`,  color: 'text-green-700' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-4 py-3 bg-gray-50 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className={`text-sm font-semibold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              {custMonthlyQ.isLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Loading…
                </div>
              ) : custRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                  <Users size={28} className="opacity-30" />
                  <p className="text-sm">No installment activity in this month</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <Th>Sr No</Th>
                      <Th>Client ID</Th>
                      <Th>Customer Name</Th>
                      <Th right>Rupees</Th>
                      <Th>Mobile Number</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {custRows.map((r) => (
                      <tr key={`${r.clientId}-${r.srNo}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <Td>{r.srNo}</Td>
                        <Td><span className="font-mono text-xs">{r.clientId}</span></Td>
                        <Td bold>{r.customerName}</Td>
                        <Td right>
                          <span className={
                            r.status === 'Paid'      ? 'text-green-700 font-semibold' :
                            r.status === 'Defaulted' ? 'text-red-600 font-semibold'   :
                                                       'text-orange-600 font-semibold'
                          }>
                            PKR {fmt(r.status === 'Paid' ? r.paidAmount : expectedAmt(r))}
                          </span>
                        </Td>
                        <Td>{r.customerPhone}</Td>
                        <Td>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            r.status === 'Paid'      ? 'bg-green-100 text-green-700' :
                            r.status === 'Defaulted' ? 'bg-red-100 text-red-700'     :
                                                       'bg-orange-100 text-orange-700'
                          }`}>
                            {r.status === 'Paid' ? '✓ Paid' : r.status === 'Defaulted' ? '✗ Defaulted' : '⏳ Pending'}
                          </span>
                        </Td>
                      </tr>
                    ))}
                    {/* Summary footer row */}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-sm">
                      <Td bold>—</Td>
                      <Td bold>—</Td>
                      <Td bold>Total ({custRows.length} customers)</Td>
                      <Td right bold>
                        <span className="text-green-700">PKR {fmt(collected)}</span>
                        {pending > 0 && (
                          <span className="block text-xs text-orange-500 font-normal">
                            PKR {fmt(pending)} pending
                          </span>
                        )}
                      </Td>
                      <Td bold>—</Td>
                      <Td bold>
                        <span className="text-green-700">{paidRows.length} paid</span>
                        {' / '}
                        <span className="text-orange-600">{pendingRows.length} pending</span>
                        {defaultedRows.length > 0 && (
                          <>{' / '}<span className="text-red-600">{defaultedRows.length} defaulted</span></>
                        )}
                      </Td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })()}

      {/* Monthly Report tab */}
      {tab === 'monthly' && (() => {
        const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
        const totals = monthlyRows.reduce(
          (acc, r) => ({
            newInstallments:   acc.newInstallments   + r.newInstallments,
            totalSaleAmount:   acc.totalSaleAmount   + r.totalSaleAmount,
            newCustomers:      acc.newCustomers      + r.newCustomers,
            paymentsCollected: acc.paymentsCollected + r.paymentsCollected,
            cashSalesAmount:   acc.cashSalesAmount   + r.cashSalesAmount,
            totalExpenses:     acc.totalExpenses     + r.totalExpenses,
            netRevenue:        acc.netRevenue        + r.netRevenue,
          }),
          { newInstallments: 0, totalSaleAmount: 0, newCustomers: 0, paymentsCollected: 0, cashSalesAmount: 0, totalExpenses: 0, netRevenue: 0 },
        );
        const currentYear = new Date().getFullYear();
        const yearOptions = Array.from({ length: currentYear - 2023 }, (_, i) => currentYear - i);

        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Monthly Business Report</h2>
                <p className="text-xs text-gray-500 mt-0.5">Month-by-month breakdown — customers, installments, collections, cash sales, expenses</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Year picker */}
                <select
                  value={monthlyYear}
                  onChange={(e) => setMonthlyYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  onClick={downloadMonthlyPdf}
                  disabled={monthlyQ.isLoading || monthlyRows.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <FileDown size={15} />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Year totals strip */}
            {!monthlyQ.isLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y sm:divide-y-0 border-b border-gray-100">
                {[
                  { label: 'New Customers',  value: totals.newCustomers,      color: 'text-blue-600' },
                  { label: 'New Installs',   value: totals.newInstallments,   color: 'text-indigo-600' },
                  { label: 'Sale Value',     value: `PKR ${fmt(totals.totalSaleAmount)}`, color: 'text-gray-900' },
                  { label: 'Collections',    value: `PKR ${fmt(totals.paymentsCollected)}`, color: 'text-green-700' },
                  { label: 'Cash Revenue',   value: `PKR ${fmt(totals.cashSalesAmount)}`,  color: 'text-green-700' },
                  { label: 'Expenses',       value: `PKR ${fmt(totals.totalExpenses)}`,    color: 'text-red-600' },
                  { label: 'Net Revenue',    value: `PKR ${fmt(totals.netRevenue)}`,       color: totals.netRevenue >= 0 ? 'text-green-700' : 'text-red-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-4 py-3 bg-gray-50 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className={`text-sm font-semibold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              {monthlyQ.isLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Loading…
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <Th>Month</Th>
                      <Th right>New Customers</Th>
                      <Th right>New Installments</Th>
                      <Th right>Sale Amount</Th>
                      <Th right>Down Payments</Th>
                      <Th right>Collections</Th>
                      <Th right>Cash Sales</Th>
                      <Th right>Cash Revenue</Th>
                      <Th right>Expenses</Th>
                      <Th right>Net Revenue</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((r) => {
                      const isEmpty = r.newInstallments === 0 && r.newCustomers === 0 && r.paymentsCollected === 0 && r.cashSalesAmount === 0;
                      return (
                        <tr key={r.month} className={`border-b border-gray-100 ${isEmpty ? 'opacity-40' : 'hover:bg-gray-50'}`}>
                          <Td bold>{r.monthName}</Td>
                          <Td right>{r.newCustomers > 0 ? r.newCustomers : '-'}</Td>
                          <Td right>{r.newInstallments > 0 ? r.newInstallments : '-'}</Td>
                          <Td right>{r.totalSaleAmount > 0 ? `PKR ${fmt(r.totalSaleAmount)}` : '-'}</Td>
                          <Td right>{r.downPayments > 0 ? `PKR ${fmt(r.downPayments)}` : '-'}</Td>
                          <Td right green={r.paymentsCollected > 0}>{r.paymentsCollected > 0 ? `PKR ${fmt(r.paymentsCollected)}` : '-'}</Td>
                          <Td right>{r.cashSalesCount > 0 ? r.cashSalesCount : '-'}</Td>
                          <Td right green={r.cashSalesAmount > 0}>{r.cashSalesAmount > 0 ? `PKR ${fmt(r.cashSalesAmount)}` : '-'}</Td>
                          <Td right red={r.totalExpenses > 0}>{r.totalExpenses > 0 ? `PKR ${fmt(r.totalExpenses)}` : '-'}</Td>
                          <Td right green={r.netRevenue > 0} red={r.netRevenue < 0}>
                            {r.netRevenue !== 0 ? `PKR ${fmt(r.netRevenue)}` : '-'}
                          </Td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                      <Td bold>Total {monthlyYear}</Td>
                      <Td right bold>{totals.newCustomers}</Td>
                      <Td right bold>{totals.newInstallments}</Td>
                      <Td right bold>PKR {fmt(totals.totalSaleAmount)}</Td>
                      <Td right bold>PKR {fmt(totals.totalSaleAmount > 0 ? monthlyRows.reduce((s, r) => s + r.downPayments, 0) : 0)}</Td>
                      <Td right green bold>PKR {fmt(totals.paymentsCollected)}</Td>
                      <Td right bold>{monthlyRows.reduce((s, r) => s + r.cashSalesCount, 0)}</Td>
                      <Td right green bold>PKR {fmt(totals.cashSalesAmount)}</Td>
                      <Td right red bold>PKR {fmt(totals.totalExpenses)}</Td>
                      <Td right green={totals.netRevenue >= 0} red={totals.netRevenue < 0} bold>PKR {fmt(totals.netRevenue)}</Td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })()}

      {/* Overdue tab */}
      {tab === 'overdue' && (
        <ReportSection
          title="Overdue & Defaulted Installments"
          description="Active customers behind on payment + all defaulted installments"
          count={overdue.length + defaulters.length}
          totalLabel="Total remaining"
          total={[...overdue, ...defaulters].reduce((s, i) => s + Number(i.remaining), 0)}
          isLoading={overdueQ.isLoading || defaultersQ.isLoading}
          isEmpty={overdue.length === 0 && defaulters.length === 0}
          onDownload={downloadOverdueOnly}
          headerExtra={
            <button
              onClick={downloadOverdueCombined}
              disabled={overdueQ.isLoading || defaultersQ.isLoading || (overdue.length === 0 && defaulters.length === 0)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileDown size={14} />
              Combined PDF
            </button>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <Th>#</Th><Th>Customer</Th><Th>Phone</Th><Th>Area</Th>
                <Th>Product</Th><Th>Invoice</Th><Th right>Remaining</Th><Th right>Monthly</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {overdue.slice(0, 50).map((i, idx) => (
                <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <Td>{idx + 1}</Td>
                  <Td bold>{i.customerName}</Td>
                  <Td>{i.customerPhone}</Td>
                  <Td>{i.customerArea ?? '-'}</Td>
                  <Td>{i.productName}</Td>
                  <Td>{i.invoiceNumber ?? '-'}</Td>
                  <Td right red>{pkr(Number(i.remaining))}</Td>
                  <Td right>{pkr(Number(i.monthly))}</Td>
                  <Td><span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">Overdue</span></Td>
                </tr>
              ))}
              {defaulters.slice(0, 50).map((i, idx) => (
                <tr key={i.id} className="border-b border-gray-100 hover:bg-red-50">
                  <Td>{overdue.length + idx + 1}</Td>
                  <Td bold>{i.customerName}</Td>
                  <Td>{i.customerPhone}</Td>
                  <Td>{i.customerArea ?? '-'}</Td>
                  <Td>{i.productName}</Td>
                  <Td>{i.invoiceNumber ?? '-'}</Td>
                  <Td right red>{pkr(Number(i.remaining))}</Td>
                  <Td right>{pkr(Number(i.monthly))}</Td>
                  <Td><span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">Defaulted</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      )}

      {/* Defaulters tab */}
      {tab === 'defaulters' && (
        <ReportSection
          title="Defaulter Customers"
          description="Installments that have been marked as defaulted"
          count={defaulters.length}
          totalLabel="Total outstanding"
          total={defaulters.reduce((s, i) => s + Number(i.remaining), 0)}
          isLoading={defaultersQ.isLoading}
          isEmpty={defaulters.length === 0}
          onDownload={downloadDefaulters}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <Th>#</Th><Th>Customer</Th><Th>Phone</Th><Th>Area</Th>
                <Th>Product</Th><Th>Invoice</Th><Th right>Total</Th><Th right>Remaining</Th>
              </tr>
            </thead>
            <tbody>
              {defaulters.slice(0, 50).map((i, idx) => (
                <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <Td>{idx + 1}</Td>
                  <Td bold>{i.customerName}</Td>
                  <Td>{i.customerPhone}</Td>
                  <Td>{i.customerArea ?? '-'}</Td>
                  <Td>{i.productName}</Td>
                  <Td>{i.invoiceNumber ?? '-'}</Td>
                  <Td right>{pkr(Number(i.totalAmount))}</Td>
                  <Td right red>{pkr(Number(i.remaining))}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      )}

      {/* Today's Payments tab */}
      {tab === 'today' && (
        <ReportSection
          title="Today's Collections"
          description={`Installment payments collected on ${fmtDate(today)}`}
          count={todayPay.length}
          totalLabel="Total collected"
          total={todayPay.reduce((s, p) => s + Number(p.amount), 0)}
          isLoading={todayPayQ.isLoading}
          isEmpty={todayPay.length === 0}
          onDownload={downloadTodayPayments}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <Th>#</Th><Th>Customer</Th><Th>Phone</Th><Th>Product</Th>
                <Th>Invoice</Th><Th right>Amount</Th><Th>Method</Th><Th>Collector</Th>
              </tr>
            </thead>
            <tbody>
              {todayPay.slice(0, 50).map((p, idx) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <Td>{idx + 1}</Td>
                  <Td bold>{p.customerName}</Td>
                  <Td>{p.customerPhone}</Td>
                  <Td>{p.productName}</Td>
                  <Td>{p.invoiceNumber ?? '-'}</Td>
                  <Td right green>{pkr(Number(p.amount))}</Td>
                  <Td>{METHOD_LABELS[p.method] ?? p.method}</Td>
                  <Td>{p.collectorName ?? '-'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      )}

      {/* Returns tab */}
      {tab === 'returns' && (
        <ReportSection
          title="Returns & Exchanges"
          description="Customer returns, exchanges, and warranty replacements"
          count={returnsList.length}
          totalLabel="Total refunds"
          total={returnsList.reduce((s, r) => s + Number(r.refundAmount ?? 0), 0)}
          isLoading={returnsQ.isLoading}
          isEmpty={returnsList.length === 0}
          onDownload={downloadReturns}
          headerExtra={
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-xs overflow-hidden">
              {(['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setReturnsStatus(s)}
                  className={`px-2.5 py-1.5 transition-colors ${
                    returnsStatus === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s === 'ALL' ? 'All' : RETURN_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <Th>#</Th><Th>Customer</Th><Th>Phone</Th><Th>Product</Th>
                <Th>Type</Th><Th>Reason</Th><Th>Status</Th><Th right>Refund</Th><Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {returnsList.slice(0, 50).map((r, idx) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <Td>{idx + 1}</Td>
                  <Td bold>{r.customerName}</Td>
                  <Td>{r.customerPhone}</Td>
                  <Td>{r.productName}</Td>
                  <Td>{RETURN_TYPE_LABELS[r.type] ?? r.type}</Td>
                  <Td>{r.reason.replace(/_/g, ' ')}</Td>
                  <Td>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                      r.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      r.status === 'APPROVED'  ? 'bg-blue-100 text-blue-700' :
                      r.status === 'REJECTED'  ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {RETURN_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </Td>
                  <Td right green={!!r.refundAmount}>
                    {r.refundAmount ? pkr(Number(r.refundAmount)) : '-'}
                  </Td>
                  <Td>{fmtDate(r.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      )}

      {/* Expenses tab */}
      {tab === 'expenses' && (
        <ReportSection
          title="Expenses"
          description="Shop expenses by category"
          count={expensesList.length}
          totalLabel="Total spent"
          total={expensesList.reduce((s, e) => s + Number(e.amount), 0)}
          isLoading={expensesQ.isLoading}
          isEmpty={expensesList.length === 0}
          onDownload={downloadExpenses}
          headerExtra={
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-xs overflow-hidden">
              {(['today', 'week', 'month', 'all'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setExpenseRange(r)}
                  className={`px-3 py-1.5 transition-colors ${
                    expenseRange === r ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r === 'today' ? 'Today' : r === 'week' ? 'Week' : r === 'month' ? 'Month' : 'All'}
                </button>
              ))}
            </div>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <Th>#</Th><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th right>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {expensesList.slice(0, 50).map((e, idx) => (
                <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <Td>{idx + 1}</Td>
                  <Td>{fmtDate(e.date)}</Td>
                  <Td bold>{CAT_LABELS[e.category] ?? e.category}</Td>
                  <Td>{e.description ?? '-'}</Td>
                  <Td right red>{pkr(Number(e.amount))}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      )}

      {/* Cash Sales tab */}
      {tab === 'cashsales' && (
        <ReportSection
          title="Cash Sales"
          description="Direct sales without installment plan"
          count={cashSales.length}
          totalLabel="Total revenue"
          total={cashSales.reduce((s, c) => s + Number(c.amount), 0)}
          isLoading={cashQ.isLoading}
          isEmpty={cashSales.length === 0}
          onDownload={downloadCashSales}
          headerExtra={
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-xs overflow-hidden">
              {(['today', 'week', 'month', 'all'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setCashRange(r)}
                  className={`px-3 py-1.5 transition-colors ${
                    cashRange === r ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r === 'today' ? 'Today' : r === 'week' ? 'Week' : r === 'month' ? 'Month' : 'All'}
                </button>
              ))}
            </div>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <Th>#</Th><Th>Customer</Th><Th>Phone</Th><Th>Product</Th>
                <Th>Qty</Th><Th right>Amount</Th><Th>Method</Th><Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {cashSales.slice(0, 50).map((c, idx) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <Td>{idx + 1}</Td>
                  <Td bold>{c.customerName ?? 'Walk-in'}</Td>
                  <Td>{c.customerPhone ?? '-'}</Td>
                  <Td>{c.productName}</Td>
                  <Td>{c.quantity}</Td>
                  <Td right green>{pkr(Number(c.amount))}</Td>
                  <Td>{METHOD_LABELS[c.method] ?? c.method}</Td>
                  <Td>{fmtDate(c.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      )}
    </div>
  );
}

function ReportSection({
  title,
  description,
  count,
  totalLabel,
  total,
  isLoading,
  isEmpty,
  onDownload,
  headerExtra,
  children,
}: {
  title: string;
  description: string;
  count: number;
  totalLabel: string;
  total: number;
  isLoading: boolean;
  isEmpty: boolean;
  onDownload: () => void;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Section header */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          <button
            onClick={onDownload}
            disabled={isLoading || isEmpty}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileDown size={15} />
            Download PDF
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex gap-6 text-sm">
        <div>
          <span className="text-gray-500">Records: </span>
          <span className="font-semibold text-gray-900">{isLoading ? '…' : count}</span>
        </div>
        <div>
          <span className="text-gray-500">{totalLabel}: </span>
          <span className="font-semibold text-gray-900">
            {isLoading ? '…' : `PKR ${total.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`}
          </span>
        </div>
        {count > 50 && (
          <div className="text-gray-400 text-xs self-center">
            Showing first 50 rows — PDF contains all {count}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" /> Loading…
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <FileDown size={28} className="opacity-30" />
            <p className="text-sm">No records found</p>
          </div>
        ) : (
          <div className="min-w-full">{children}</div>
        )}
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right, bold, red, green }: {
  children: React.ReactNode; right?: boolean; bold?: boolean; red?: boolean; green?: boolean;
}) {
  let cls = `px-4 py-2.5 whitespace-nowrap ${right ? 'text-right' : ''}`;
  if (red)        cls += ' text-red-600 font-medium';
  else if (green) cls += ' text-green-700 font-medium';
  else if (bold)  cls += ' font-semibold text-gray-900';
  else            cls += ' text-gray-600';
  return <td className={cls}>{children}</td>;
}
