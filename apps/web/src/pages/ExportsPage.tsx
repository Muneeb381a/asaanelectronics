import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, RefreshCw, AlertTriangle, ShieldX, CalendarCheck, ShoppingCart, Undo2, Receipt, BarChart3, Users, Database, Loader2, ClipboardList, Phone, Wallet, ChevronDown, ChevronRight } from 'lucide-react';
import { installmentsApi, type CollectionScheduleItem } from '../api/installments.api.ts';
import { reportsApi, type CustomerBalance } from '../api/reports.api.ts';
import { paymentsApi } from '../api/payments.api.ts';
import { cashSalesApi } from '../api/cashSales.api.ts';
import { returnsApi } from '../api/returns.api.ts';
import { expensesApi } from '../api/expenses.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { printReport } from '../utils/exportPdf.ts';
import { toCsv, objsToCsv, downloadCsv } from '../utils/exportCsv.ts';
import { exportsApi } from '../api/exports.api.ts';
import { fmtDate } from '../utils/dateFormat.ts';

type Tab = 'collection' | 'balances' | 'overdue' | 'defaulters' | 'today' | 'cashsales' | 'returns' | 'expenses' | 'monthly' | 'monthly-customers' | 'backup';

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
  const [tab, setTab] = useState<Tab>('collection');
  const [collectionDays, setCollectionDays] = useState<7 | 3 | 14 | 0>(7);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
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

  const collectionQ = useQuery({
    queryKey: ['collection-schedule', collectionDays],
    queryFn: () => installmentsApi.collectionSchedule(collectionDays),
    staleTime: 60_000,
    enabled: tab === 'collection',
  });

  const balancesQ = useQuery({
    queryKey: ['customer-balances'],
    queryFn: reportsApi.getCustomerBalances,
    staleTime: 2 * 60_000,
    enabled: tab === 'balances',
  });

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

  const collectionItems = collectionQ.data?.items ?? [];
  const collectionSummary = collectionQ.data?.summary ?? { overdue: 0, today: 0, upcoming: 0, totalDue: 0 };
  const balanceCustomers = balancesQ.data?.customers ?? [];
  const balanceGrandTotal = balancesQ.data?.grandTotal ?? 0;
  const overdue   = (overdueQ.data?.data   ?? []).filter((i) => i.isOverdue);
  const defaulters = defaultersQ.data?.data ?? [];
  const todayPay  = Array.isArray(todayPayQ.data) ? todayPayQ.data : [];
  const cashSales = cashQ.data?.data ?? [];
  const returnsList = returnsQ.data?.data ?? [];
  const expensesList = expensesQ.data ?? [];
  const monthlyRows = monthlyQ.data ?? [];
  const custRows    = custMonthlyQ.data ?? [];

  function downloadCollectionSchedule() {
    const windowLabel = collectionDays === 0 ? 'Today' : `Next ${collectionDays} Days`;
    printReport({
      title: `Collection Schedule — ${windowLabel}`,
      subtitle: `Due & upcoming payments — generated ${fmtDate(today)}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['#', 'Customer', 'Phone', 'Area', 'Product', 'Due Date', 'Status', 'Amount (PKR)', 'Remaining (PKR)', 'Last Payment'],
      rows: collectionItems.map((i, idx) => [
        idx + 1,
        i.customerName,
        i.customerPhone,
        i.area || '-',
        i.productName,
        fmtDate(i.nextDueDate),
        i.urgency === 'overdue'
          ? `Overdue ${Math.abs(i.daysUntilDue)} day${Math.abs(i.daysUntilDue) !== 1 ? 's' : ''}`
          : i.urgency === 'today' ? 'Due Today'
          : `In ${i.daysUntilDue} day${i.daysUntilDue !== 1 ? 's' : ''}`,
        Number(i.monthly).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
        Number(i.remaining).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
        i.lastPaymentDate ? fmtDate(i.lastPaymentDate) : '—',
      ]),
      summary: [
        `<strong>Overdue:</strong> ${collectionSummary.overdue}`,
        `<strong>Due today:</strong> ${collectionSummary.today}`,
        `<strong>Upcoming:</strong> ${collectionSummary.upcoming}`,
        `<strong>Total due amount:</strong> ${pkr(collectionSummary.totalDue)}`,
      ],
    });
  }

  function downloadCollectionCsv() {
    const rows = collectionItems.map((i) => ({
      'Customer Name': i.customerName,
      'Phone': i.customerPhone,
      'Area': i.area || '',
      'Product': i.productName,
      'Due Date': i.nextDueDate,
      'Status': i.urgency === 'overdue'
        ? `Overdue ${Math.abs(i.daysUntilDue)}d`
        : i.urgency === 'today' ? 'Due Today'
        : `In ${i.daysUntilDue}d`,
      'Amount Due (PKR)': i.monthly,
      'Total Remaining (PKR)': i.remaining,
      'Last Payment Date': i.lastPaymentDate ?? '',
      'Last Payment Amount (PKR)': i.lastPaymentAmount ?? '',
    }));
    downloadCsv(`collection-schedule-${today}.csv`, objsToCsv(rows));
  }

  function downloadBalancesPdf() {
    const allRows: (string | number)[][] = [];
    for (const c of balanceCustomers) {
      for (const i of c.installments) {
        const statusLabel = i.status === 'DEFAULTED' ? 'Defaulted'
          : i.daysUntilDue === null ? 'Active'
          : i.daysUntilDue < 0 ? `Overdue ${Math.abs(i.daysUntilDue)}d`
          : i.daysUntilDue === 0 ? 'Due Today'
          : `Due in ${i.daysUntilDue}d`;
        allRows.push([
          c.customerName,
          c.customerPhone,
          i.productName,
          Number(i.totalAmount).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
          Number(i.paidTotal).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
          Number(i.remaining).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
          i.nextDueDate ? fmtDate(i.nextDueDate) : '—',
          statusLabel,
          i.lastPaymentDate ? fmtDate(i.lastPaymentDate) : '—',
        ]);
      }
    }
    printReport({
      title: 'Customer Balance Statement',
      subtitle: `Outstanding receivables — all active & defaulted installments — ${fmtDate(today)}`,
      shopName,
      shopPhone: seller?.phone,
      columns: ['Customer', 'Phone', 'Product', 'Total (PKR)', 'Paid (PKR)', 'Remaining (PKR)', 'Next Due', 'Status', 'Last Payment'],
      rows: allRows,
      summary: [
        `<strong>Total customers:</strong> ${balanceCustomers.length}`,
        `<strong>Total outstanding:</strong> ${pkr(balanceGrandTotal)}`,
      ],
    });
  }

  function downloadBalancesCsv() {
    const rows: Record<string, string | number>[] = [];
    for (const c of balanceCustomers) {
      for (const i of c.installments) {
        rows.push({
          'Customer Name':    c.customerName,
          'Phone':            c.customerPhone,
          'Address':          c.customerAddress ?? '',
          'Product':          i.productName,
          'Total Amount':     i.totalAmount,
          'Paid Total':       i.paidTotal,
          'Remaining':        i.remaining,
          'Monthly Amount':   i.monthly,
          'Status':           i.status,
          'Next Due Date':    i.nextDueDate ?? '',
          'Days Until Due':   i.daysUntilDue ?? '',
          'Last Payment Date': i.lastPaymentDate ?? '',
          'Last Payment Amt': i.lastPaymentAmount ?? '',
        });
      }
    }
    downloadCsv(`customer-balances-${today}.csv`, objsToCsv(rows));
  }

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
    { id: 'collection',        label: 'Collection Schedule', icon: ClipboardList },
    { id: 'balances',          label: 'Customer Balances',   icon: Wallet },
    { id: 'backup',            label: 'Full Backup',         icon: Database },
    { id: 'monthly',           label: 'Monthly Summary',     icon: BarChart3 },
    { id: 'monthly-customers', label: 'Monthly Customers',   icon: Users },
    { id: 'overdue',           label: 'Overdue',             icon: AlertTriangle },
    { id: 'defaulters',        label: 'Defaulters',          icon: ShieldX },
    { id: 'today',             label: "Today's Payments",    icon: CalendarCheck },
    { id: 'cashsales',         label: 'Cash Sales',          icon: ShoppingCart },
    { id: 'returns',           label: 'Returns',             icon: Undo2 },
    { id: 'expenses',          label: 'Expenses',            icon: Receipt },
  ];

  const isLoading =
    (tab === 'collection' && collectionQ.isFetching) ||
    (tab === 'balances'   && balancesQ.isFetching) ||
    (tab === 'overdue'    && (overdueQ.isFetching || defaultersQ.isFetching)) ||
    (tab === 'defaulters' && defaultersQ.isFetching) ||
    (tab === 'today'      && todayPayQ.isFetching) ||
    (tab === 'cashsales'  && cashQ.isFetching) ||
    (tab === 'returns'    && returnsQ.isFetching) ||
    (tab === 'expenses'   && expensesQ.isFetching) ||
    (tab === 'monthly'           && monthlyQ.isFetching) ||
    (tab === 'monthly-customers' && custMonthlyQ.isFetching);

  function refetchCurrent() {
    if (tab === 'collection') void collectionQ.refetch();
    if (tab === 'balances')   void balancesQ.refetch();
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

      {/* Collection Schedule tab */}
      {tab === 'collection' && (() => {
        const urgencyGroups: { key: CollectionScheduleItem['urgency']; label: string; color: string; badge: string }[] = [
          { key: 'overdue',  label: 'Overdue',   color: 'red',    badge: 'bg-red-100 text-red-700' },
          { key: 'today',    label: 'Due Today', color: 'amber',  badge: 'bg-amber-100 text-amber-700' },
          { key: 'upcoming', label: 'Upcoming',  color: 'green',  badge: 'bg-green-100 text-green-700' },
        ];

        return (
          <div className="space-y-5">
            {/* Header card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">Collection Schedule</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Field collectors ki daily list — overdue + due soon</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Window filter */}
                  {([0, 3, 7, 14] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setCollectionDays(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        collectionDays === d
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {d === 0 ? 'Today Only' : `Next ${d} Days`}
                    </button>
                  ))}
                  <button
                    onClick={downloadCollectionSchedule}
                    disabled={collectionItems.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-800 transition-colors"
                  >
                    <FileDown size={14} /> Print PDF
                  </button>
                  <button
                    onClick={downloadCollectionCsv}
                    disabled={collectionItems.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    <FileDown size={14} /> CSV
                  </button>
                </div>
              </div>

              {/* Summary tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{collectionSummary.overdue}</p>
                  <p className="text-xs text-red-600 mt-0.5">Overdue</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{collectionSummary.today}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Due Today</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{collectionSummary.upcoming}</p>
                  <p className="text-xs text-green-600 mt-0.5">Upcoming</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-indigo-700">{pkr(collectionSummary.totalDue)}</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Total to Collect</p>
                </div>
              </div>
            </div>

            {collectionQ.isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                <Loader2 size={18} className="animate-spin" /> Loading…
              </div>
            ) : collectionItems.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  {collectionDays === 0 ? 'Aaj koi payment due nahi' : `Agle ${collectionDays} dinon mein koi due nahi`}
                </p>
              </div>
            ) : (
              urgencyGroups.map(({ key, label, badge }) => {
                const group = collectionItems.filter((i) => i.urgency === key);
                if (group.length === 0) return null;
                const groupTotal = group.reduce((s, i) => s + i.monthly, 0);
                return (
                  <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge}`}>{label}</span>
                        <span className="text-sm text-gray-500">{group.length} customers</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{pkr(groupTotal)}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                            <th className="px-4 py-2.5 text-left">#</th>
                            <th className="px-4 py-2.5 text-left">Customer</th>
                            <th className="px-4 py-2.5 text-left">Phone</th>
                            <th className="px-4 py-2.5 text-left">Area</th>
                            <th className="px-4 py-2.5 text-left">Product</th>
                            <th className="px-4 py-2.5 text-left">Due Date</th>
                            <th className="px-4 py-2.5 text-right">Amount</th>
                            <th className="px-4 py-2.5 text-right">Remaining</th>
                            <th className="px-4 py-2.5 text-left">Last Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {group.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{item.customerName}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <a
                                  href={`tel:${item.customerPhone}`}
                                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                  <Phone size={12} />
                                  {item.customerPhone}
                                </a>
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 text-xs">{item.area || '—'}</td>
                              <td className="px-4 py-2.5 text-gray-600 max-w-[160px] truncate">{item.productName}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <div className="text-gray-700">{fmtDate(item.nextDueDate)}</div>
                                {item.urgency === 'overdue' && (
                                  <div className="text-xs text-red-500 font-medium">
                                    {Math.abs(item.daysUntilDue)}d overdue
                                  </div>
                                )}
                                {item.urgency === 'upcoming' && (
                                  <div className="text-xs text-green-600">
                                    in {item.daysUntilDue} day{item.daysUntilDue !== 1 ? 's' : ''}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{pkr(item.monthly)}</td>
                              <td className="px-4 py-2.5 text-right text-gray-500 text-xs whitespace-nowrap">{pkr(item.remaining)}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                                {item.lastPaymentDate
                                  ? <>{fmtDate(item.lastPaymentDate)}{item.lastPaymentAmount ? <span className="ml-1 text-green-600">({pkr(item.lastPaymentAmount)})</span> : null}</>
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })()}

      {/* Customer Balances tab */}
      {tab === 'balances' && (() => {
        const toggleCustomer = (id: string) => {
          setExpandedCustomers((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
          });
        };

        return (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">Customer Balance Statement</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Har customer ka outstanding balance — active aur defaulted installments
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={downloadBalancesPdf}
                    disabled={balanceCustomers.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-800 transition-colors"
                  >
                    <FileDown size={14} /> Print PDF
                  </button>
                  <button
                    onClick={downloadBalancesCsv}
                    disabled={balanceCustomers.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    <FileDown size={14} /> CSV
                  </button>
                </div>
              </div>
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-indigo-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-indigo-700">{balanceCustomers.length}</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Total Customers</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">
                    {balanceCustomers.filter((c) => c.defaultedCount > 0).length}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">With Defaults</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center col-span-2 md:col-span-1">
                  <p className="text-xl font-bold text-gray-900">{pkr(balanceGrandTotal)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total Outstanding</p>
                </div>
              </div>
            </div>

            {balancesQ.isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                <Loader2 size={18} className="animate-spin" /> Loading…
              </div>
            ) : balanceCustomers.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Wallet size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Koi active ya defaulted installment nahi</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {balanceCustomers.map((c: CustomerBalance) => {
                  const isExpanded = expandedCustomers.has(c.customerId);
                  const hasDefault = c.defaultedCount > 0;
                  const mostOverdue = c.mostOverdueDays;
                  return (
                    <div key={c.customerId}>
                      {/* Customer row */}
                      <button
                        onClick={() => toggleCustomer(c.customerId)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        {isExpanded ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{c.customerName}</span>
                            {hasDefault && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Defaulted</span>
                            )}
                            {!hasDefault && mostOverdue > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{mostOverdue}d overdue</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <a
                              href={`tel:${c.customerPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-indigo-600"
                            >
                              <Phone size={10} />{c.customerPhone}
                            </a>
                            {c.customerAddress && (
                              <span className="text-xs text-gray-400 truncate max-w-[180px]">{c.customerAddress}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-900">{pkr(c.totalRemaining)}</p>
                          <p className="text-xs text-gray-400">{c.activeCount + c.defaultedCount} installment{c.activeCount + c.defaultedCount !== 1 ? 's' : ''}</p>
                        </div>
                      </button>

                      {/* Expanded installment rows */}
                      {isExpanded && (
                        <div className="bg-gray-50 border-t border-gray-100">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400 font-semibold uppercase tracking-wide">
                                  <th className="px-6 py-2 text-left">Product</th>
                                  <th className="px-4 py-2 text-right">Total</th>
                                  <th className="px-4 py-2 text-right">Paid</th>
                                  <th className="px-4 py-2 text-right">Remaining</th>
                                  <th className="px-4 py-2 text-left">Next Due</th>
                                  <th className="px-4 py-2 text-left">Last Payment</th>
                                  <th className="px-4 py-2 text-left">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {c.installments.map((i) => {
                                  const dueBadge = i.status === 'DEFAULTED'
                                    ? <span className="text-red-600 font-semibold">Defaulted</span>
                                    : i.daysUntilDue === null ? <span className="text-gray-400">—</span>
                                    : i.daysUntilDue < 0 ? <span className="text-red-600 font-semibold">{Math.abs(i.daysUntilDue)}d overdue</span>
                                    : i.daysUntilDue === 0 ? <span className="text-amber-600 font-semibold">Due Today</span>
                                    : <span className="text-green-600">in {i.daysUntilDue}d</span>;

                                  return (
                                    <tr key={i.installmentId} className="hover:bg-gray-100 transition-colors">
                                      <td className="px-6 py-2.5 text-gray-700 max-w-[200px] truncate">{i.productName}</td>
                                      <td className="px-4 py-2.5 text-right text-gray-600">{pkr(i.totalAmount)}</td>
                                      <td className="px-4 py-2.5 text-right text-green-600">{pkr(i.paidTotal)}</td>
                                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{pkr(i.remaining)}</td>
                                      <td className="px-4 py-2.5 whitespace-nowrap">
                                        {i.nextDueDate ? fmtDate(i.nextDueDate) : '—'}
                                      </td>
                                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                                        {i.lastPaymentDate
                                          ? <>{fmtDate(i.lastPaymentDate)}{i.lastPaymentAmount != null ? <span className="ml-1 text-green-600">({pkr(i.lastPaymentAmount)})</span> : null}</>
                                          : '—'}
                                      </td>
                                      <td className="px-4 py-2.5">{dueBadge}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Full Backup tab */}
      {tab === 'backup' && <BackupTab shopName={shopName} />}

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

// ── Full Backup Tab ───────────────────────────────────────────────────────────
function BackupTab({ shopName }: { shopName: string }) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleDownload() {
    setLoading(true);
    setDone(false);
    setError('');
    try {
      const backup = await exportsApi.getBackup();
      const date   = new Date().toISOString().slice(0, 10);
      const prefix = `${shopName.replace(/\s+/g, '_')}_${date}`;

      // Customers
      downloadCsv(`${prefix}_customers.csv`, toCsv(
        ['ID', 'Name', 'Phone', 'Area', 'CNIC (Masked)', 'Address', 'Tags', 'DOB', 'Created'],
        backup.customers.map((c) => [
          c['id'], c['name'], c['phone'], c['area'] ?? '', c['cnicMasked'] ?? '',
          c['address'] ?? '', (c['tags'] as string[] | null)?.join(';') ?? '',
          c['dob'] ?? '', c['createdAt'],
        ]),
      ));

      await delay(300);

      // Installments
      downloadCsv(`${prefix}_installments.csv`, toCsv(
        ['ID', 'Invoice', 'Customer ID', 'Product ID', 'Total', 'Down', 'Monthly', 'Months', 'Remaining', 'Status', 'Start Date', 'Frequency', 'Created'],
        backup.installments.map((i) => [
          i['id'], i['invoiceNumber'] ?? '', i['customerId'], i['productId'] ?? '',
          i['totalAmount'], i['downPayment'] ?? 0, i['monthly'], i['months'],
          i['remaining'], i['status'], i['startDate'] ?? '', i['paymentFrequency'] ?? 'monthly',
          i['createdAt'],
        ]),
      ));

      await delay(300);

      // Products
      downloadCsv(`${prefix}_products.csv`, toCsv(
        ['ID', 'Name', 'Category', 'Brand', 'Model', 'Price', 'Installment Price', 'Purchase Price', 'Stock', 'Min Stock', 'Serial', 'Warranty Months'],
        backup.products.map((p) => [
          p['id'], p['name'], p['category'] ?? '', p['brand'] ?? '', p['model'] ?? '',
          p['price'], p['installmentPrice'] ?? '', p['purchasePrice'] ?? '',
          p['stock'], p['minStock'] ?? 3, p['serial'] ?? '', p['warrantyMonths'] ?? '',
        ]),
      ));

      await delay(300);

      // Expenses
      downloadCsv(`${prefix}_expenses.csv`, toCsv(
        ['ID', 'Category', 'Amount', 'Description', 'Date', 'Created'],
        backup.expenses.map((e) => [
          e['id'], e['category'], e['amount'], e['description'] ?? '',
          e['date'] ?? '', e['createdAt'],
        ]),
      ));

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 flex flex-col items-center text-center gap-6">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
        <Database size={28} className="text-blue-500" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Full Data Backup</h2>
        <p className="text-sm text-gray-500 max-w-md">
          Downloads 4 CSV files: customers, installments, products, and expenses.
          All records, no filters applied.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center text-sm">
        {['Customers', 'Installments', 'Products', 'Expenses'].map((label) => (
          <span key={label} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600">
            <FileDown size={13} className="text-blue-400" />
            {label}
          </span>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}

      {done && !loading && (
        <p className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg font-medium">
          4 CSV files downloaded
        </p>
      )}

      <button
        onClick={() => void handleDownload()}
        disabled={loading}
        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
        {loading ? 'Preparing Download…' : 'Download All CSVs'}
      </button>

      <p className="text-xs text-gray-400">Files open in Excel or Google Sheets</p>
    </div>
  );
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
