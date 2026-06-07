import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, RefreshCw, AlertTriangle, ShieldX, CalendarCheck, ShoppingCart } from 'lucide-react';
import { installmentsApi } from '../api/installments.api.ts';
import { paymentsApi } from '../api/payments.api.ts';
import { cashSalesApi } from '../api/cashSales.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { printReport } from '../utils/exportPdf.ts';

type Tab = 'overdue' | 'defaulters' | 'today' | 'cashsales';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', BANK: 'Bank', JAZZCASH: 'JazzCash', EASYPAISA: 'EasyPaisa', OTHER: 'Other',
};

function pkr(n: number | string) {
  return 'PKR ' + Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
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
    enabled: tab === 'defaulters',
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

  const overdue   = (overdueQ.data?.data   ?? []).filter((i) => i.isOverdue);
  const defaulters = defaultersQ.data?.data ?? [];
  const todayPay  = Array.isArray(todayPayQ.data) ? todayPayQ.data : [];
  const cashSales = cashQ.data?.data ?? [];

  function downloadOverdue() {
    const totalRem = overdue.reduce((s, i) => s + Number(i.remaining), 0);
    printReport({
      title: 'Overdue Installments',
      subtitle: `Customers who missed their payment — generated ${fmtDate(today)}`,
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
        `<strong>Total overdue customers:</strong> ${overdue.length}`,
        `<strong>Total remaining amount:</strong> ${pkr(totalRem)}`,
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
    { id: 'overdue',    label: 'Overdue',          icon: AlertTriangle },
    { id: 'defaulters', label: 'Defaulters',        icon: ShieldX },
    { id: 'today',      label: "Today's Payments",  icon: CalendarCheck },
    { id: 'cashsales',  label: 'Cash Sales',         icon: ShoppingCart },
  ];

  const isLoading =
    (tab === 'overdue'    && overdueQ.isFetching) ||
    (tab === 'defaulters' && defaultersQ.isFetching) ||
    (tab === 'today'      && todayPayQ.isFetching) ||
    (tab === 'cashsales'  && cashQ.isFetching);

  function refetchCurrent() {
    if (tab === 'overdue')    void overdueQ.refetch();
    if (tab === 'defaulters') void defaultersQ.refetch();
    if (tab === 'today')      void todayPayQ.refetch();
    if (tab === 'cashsales')  void cashQ.refetch();
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

      {/* Overdue tab */}
      {tab === 'overdue' && (
        <ReportSection
          title="Overdue Installments"
          description="Active installments where the customer has missed their payment date"
          count={overdue.length}
          totalLabel="Total remaining"
          total={overdue.reduce((s, i) => s + Number(i.remaining), 0)}
          isLoading={overdueQ.isLoading}
          isEmpty={overdue.length === 0}
          onDownload={downloadOverdue}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <Th>#</Th><Th>Customer</Th><Th>Phone</Th><Th>Area</Th>
                <Th>Product</Th><Th>Invoice</Th><Th right>Remaining</Th><Th right>Monthly</Th>
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
  return (
    <td className={`px-4 py-2.5 whitespace-nowrap ${right ? 'text-right' : ''} ${bold ? 'font-medium text-gray-900' : 'text-gray-600'} ${red ? 'text-red-600 font-medium' : ''} ${green ? 'text-green-700 font-medium' : ''}`}>
      {children}
    </td>
  );
}
