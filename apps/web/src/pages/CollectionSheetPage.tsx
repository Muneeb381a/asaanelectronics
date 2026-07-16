import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Printer, MessageCircle, Phone, AlertTriangle, CheckCircle,
  MapPin, ChevronDown, ChevronUp,
} from 'lucide-react';
import { installmentsApi, type CollectionScheduleItem } from '../api/installments.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { openWhatsApp, reminderMessage } from '../utils/whatsapp.ts';

function pkr(n: number) {
  return 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

const URGENCY = {
  overdue:  { label: 'Overdue',  bg: 'bg-red-100 text-red-700 border-red-200',     dot: 'bg-red-500',   rowBorder: 'border-red-100' },
  today:    { label: 'Today',    bg: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-500',  rowBorder: 'border-blue-100' },
  upcoming: { label: 'Upcoming', bg: 'bg-gray-100 text-gray-600 border-gray-200',   dot: 'bg-gray-400',  rowBorder: 'border-gray-100' },
};

export default function CollectionSheetPage() {
  const [days,       setDays]       = useState(7);
  const [areaFilter, setAreaFilter] = useState('');
  const [collapsed,  setCollapsed]  = useState<Set<string>>(new Set());

  const today     = new Date();
  const todayFmt  = today.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['collection-schedule', days],
    queryFn:  () => installmentsApi.collectionSchedule(days),
    staleTime: 2 * 60_000,
  });

  const { data: shop } = useQuery({
    queryKey: ['shop-profile'],
    queryFn:  sellersApi.getMe,
    staleTime: 300_000,
  });

  const allItems = schedule?.items ?? [];

  // Collect unique areas for filter
  const allAreas = [...new Set(allItems.map((i) => i.area))].sort();

  // Apply area filter
  const items = areaFilter ? allItems.filter((i) => i.area === areaFilter) : allItems;

  // Group by area, sort areas alphabetically
  const areaMap = new Map<string, CollectionScheduleItem[]>();
  for (const item of items) {
    if (!areaMap.has(item.area)) areaMap.set(item.area, []);
    areaMap.get(item.area)!.push(item);
  }
  const sortedAreas = [...areaMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Totals
  const totalCustomers = items.length;
  const totalAmount    = items.reduce((s, i) => s + i.monthly, 0);
  const overdueCount   = items.filter((i) => i.urgency === 'overdue').length;
  const todayCount     = items.filter((i) => i.urgency === 'today').length;

  function toggleCollapse(area: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(area) ? next.delete(area) : next.add(area);
      return next;
    });
  }

  return (
    <>
      {/* ── Print-only styles ─────────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print  { display: none !important; }
          .print-show { display: block !important; }
          .print-table-show { display: table !important; }
          body { font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4 portrait; margin: 1.2cm 1.5cm; }
          .area-block { page-break-inside: avoid; margin-bottom: 14px; }
          .ptbl { width: 100%; border-collapse: collapse; font-size: 9.5px; }
          .ptbl th { background: #1e40af; color: white; padding: 4px 6px; text-align: left; font-weight: 600; }
          .ptbl td { border: 1px solid #e5e7eb; padding: 3.5px 6px; vertical-align: top; }
          .ptbl tr:nth-child(even) td { background: #f8fafc; }
          .area-hdr { background: #1e3a8a; color: white; padding: 5px 8px; font-weight: bold; font-size: 10px; margin-bottom: 0; }
          .sign-box { border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 6px; }
        }
      `}</style>

      <div className="flex-1 overflow-y-auto bg-gray-50">

        {/* ── Screen header ──────────────────────────────────────────── */}
        <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Daily Collection Sheet</h1>
              <p className="text-sm text-gray-400 mt-0.5">Field agent ki area-wise collection list · {todayFmt}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Window buttons */}
              {([
                { label: '7 Din',    value: 7 },
                { label: '3 Din',    value: 3 },
                { label: 'Sirf Aaj', value: 0 },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition ${
                    days === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              {/* Area filter */}
              {allAreas.length > 1 && (
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Tamam Areas</option>
                  {allAreas.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              )}

              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
              >
                <Printer size={15} />
                Print Sheet
              </button>
            </div>
          </div>
        </div>

        {/* ── Print-only page header ──────────────────────────────────── */}
        <div className="print-show hidden px-0 mb-0">
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-base font-bold">{shop?.shopName ?? 'Daily Collection Sheet'}</p>
              {shop?.phone && <p className="text-xs text-gray-500">{shop.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-base font-bold">Daily Collection Sheet</p>
              <p className="text-xs">{todayFmt}</p>
            </div>
          </div>
          <div className="border-b-2 border-gray-800 mb-3" />
        </div>

        <div className="px-6 py-5 max-w-4xl mx-auto">

          {/* ── Summary bar ─────────────────────────────────────────── */}
          {!isLoading && (
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-sm text-gray-400">Customers</span>
                <span className="font-bold text-gray-900">{totalCustomers}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-sm text-gray-400">Collect Karo</span>
                <span className="font-bold text-blue-600">{pkr(totalAmount)}</span>
              </div>
              {overdueCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 rounded-2xl border border-red-100">
                  <AlertTriangle size={13} className="text-red-500" />
                  <span className="text-sm text-red-600 font-semibold">{overdueCount} overdue</span>
                </div>
              )}
              {todayCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 rounded-2xl border border-blue-100">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm text-blue-600 font-semibold">{todayCount} aaj due</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl border border-gray-100 shadow-sm no-print">
                <MapPin size={13} className="text-gray-400" />
                <span className="text-sm text-gray-500">{sortedAreas.length} area{sortedAreas.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && items.length === 0 && (
            <div className="text-center py-20">
              <CheckCircle size={36} className="text-emerald-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-500">Aaj koi collection nahi</p>
              <p className="text-sm text-gray-400 mt-1">Sab customers clear hain — wah!</p>
            </div>
          )}

          {/* ── Area groups ─────────────────────────────────────────── */}
          {sortedAreas.map(([area, areaItems], areaIdx) => {
            const areaTotal   = areaItems.reduce((s, i) => s + i.monthly, 0);
            const areaOverdue = areaItems.filter((i) => i.urgency === 'overdue').length;
            const isCollapsed = collapsed.has(area);

            return (
              <div key={area} className="area-block mb-5">

                {/* ── Screen: area header ── */}
                <div className="no-print flex items-center justify-between mb-2">
                  <button
                    onClick={() => toggleCollapse(area)}
                    className="flex items-center gap-2 text-left"
                  >
                    <MapPin size={14} className="text-blue-600 shrink-0" />
                    <span className="font-bold text-gray-900">{area}</span>
                    {areaOverdue > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded-md">
                        {areaOverdue} overdue
                      </span>
                    )}
                    {isCollapsed
                      ? <ChevronDown size={14} className="text-gray-400" />
                      : <ChevronUp   size={14} className="text-gray-400" />
                    }
                  </button>
                  <div className="text-sm text-gray-500">
                    {areaItems.length} customer{areaItems.length !== 1 ? 's' : ''} ·{' '}
                    <span className="font-semibold text-gray-800">{pkr(areaTotal)}</span>
                  </div>
                </div>

                {/* ── Screen: cards ── */}
                {!isCollapsed && (
                  <div className="no-print space-y-2">
                    {areaItems.map((item) => {
                      const urg = URGENCY[item.urgency];
                      return (
                        <div
                          key={item.id}
                          className={`bg-white rounded-2xl border p-4 shadow-sm ${urg.rowBorder}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="font-semibold text-gray-900">{item.customerName}</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${urg.bg}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${urg.dot}`} />
                                  {urg.label}
                                  {item.urgency === 'overdue' && ` ${Math.abs(item.daysUntilDue)}d`}
                                  {item.urgency === 'upcoming' && ` +${item.daysUntilDue}d`}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400">{item.productName}</p>
                              {item.customerAddress && (
                                <p className="text-xs text-gray-400 mt-0.5 truncate">{item.customerAddress}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold text-gray-900">{pkr(item.monthly)}</p>
                              <p className="text-xs text-gray-400">Baqi: {pkr(item.remaining)}</p>
                              {item.lastPaymentDate && (
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  Last: {shortDate(item.lastPaymentDate)}
                                  {item.lastPaymentAmount != null && ` · ${pkr(item.lastPaymentAmount)}`}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-gray-50 flex items-center gap-3">
                            <a
                              href={`tel:${item.customerPhone}`}
                              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition font-medium"
                            >
                              <Phone size={12} />
                              {item.customerPhone}
                            </a>
                            {shop && (
                              <button
                                onClick={() =>
                                  openWhatsApp(
                                    item.customerPhone,
                                    reminderMessage({
                                      shopName:         shop.shopName,
                                      customerName:     item.customerName,
                                      productName:      item.productName,
                                      monthly:          item.monthly,
                                      remaining:        item.remaining,
                                      paymentFrequency: item.paymentFrequency,
                                      daysOverdue:      item.urgency === 'overdue' ? Math.abs(item.daysUntilDue) : undefined,
                                    }),
                                  )
                                }
                                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 text-xs font-medium transition"
                              >
                                <MessageCircle size={12} />
                                Remind
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Print: table ── */}
                <div className="print-show hidden">
                  {areaIdx > 0 && <div style={{ marginTop: '10px' }} />}
                  <div className="area-hdr">{area} — {areaItems.length} customers · {pkr(areaTotal)}</div>
                  <table className="ptbl">
                    <thead>
                      <tr>
                        <th style={{ width: '4%' }}>#</th>
                        <th style={{ width: '19%' }}>Customer</th>
                        <th style={{ width: '13%' }}>Phone</th>
                        <th style={{ width: '18%' }}>Product</th>
                        <th style={{ width: '10%' }}>Monthly</th>
                        <th style={{ width: '11%' }}>Remaining</th>
                        <th style={{ width: '9%' }}>Last Paid</th>
                        <th style={{ width: '6%' }}>Status</th>
                        <th style={{ width: '10%' }}>Collected □</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{item.customerName}</td>
                          <td>{item.customerPhone}</td>
                          <td>{item.productName}</td>
                          <td style={{ fontWeight: 600 }}>{pkr(item.monthly)}</td>
                          <td>{pkr(item.remaining)}</td>
                          <td>
                            {item.lastPaymentDate ? shortDate(item.lastPaymentDate) : '—'}
                          </td>
                          <td style={{
                            fontWeight: 700,
                            color: item.urgency === 'overdue' ? '#dc2626' : item.urgency === 'today' ? '#2563eb' : '#6b7280',
                          }}>
                            {item.urgency === 'overdue'
                              ? `OVR ${Math.abs(item.daysUntilDue)}d`
                              : item.urgency === 'today'
                                ? 'TODAY'
                                : `+${item.daysUntilDue}d`}
                          </td>
                          <td />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            );
          })}

          {/* ── Print footer ─────────────────────────────────────────── */}
          {!isLoading && items.length > 0 && (
            <div className="print-show hidden mt-6 pt-4 border-t-2 border-gray-300">
              <div className="flex justify-between items-start">
                <div style={{ fontSize: '10px' }}>
                  <p><strong>Total Customers:</strong> {totalCustomers}</p>
                  <p><strong>Total Collection:</strong> {pkr(totalAmount)}</p>
                  {overdueCount > 0 && <p style={{ color: '#dc2626' }}><strong>Overdue:</strong> {overdueCount} accounts</p>}
                </div>
                <div className="sign-box" style={{ fontSize: '10px', minWidth: '220px' }}>
                  <p>Agent Name: ___________________________</p>
                  <div style={{ marginTop: '10px' }}>
                    <p>Signature: ____________________________</p>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <p>Date: {todayFmt}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
