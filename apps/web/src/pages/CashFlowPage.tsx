import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X, MessageCircle, Calendar } from 'lucide-react';
import { reportsApi, type CashflowCalendarDay, type CashflowDayInstallment } from '../api/reports.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { openWhatsApp, reminderMessage } from '../utils/whatsapp.ts';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function pkr(n: number) {
  return 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function fmtDayLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' });
}

function dayBg(d: CashflowCalendarDay, todayStr: string, selected: boolean): string {
  const base  = 'relative min-h-[70px] rounded-xl border p-2 cursor-pointer transition-all select-none';
  const ring  = selected ? ' ring-2 ring-blue-400 shadow-sm' : '';
  const today = d.date === todayStr;

  if (today) return `${base}${ring} ring-2 ring-blue-500 bg-blue-50 border-blue-200`;

  const isPast = d.date < todayStr;
  const hasDue = d.expectedAmount > 0;

  if (!isPast) {
    return `${base}${ring} ${hasDue ? 'bg-white border-gray-100 hover:bg-blue-50/40' : 'bg-gray-50/50 border-gray-50'}`;
  }

  if (!hasDue && d.collectedAmount === 0) return `${base}${ring} bg-gray-50/50 border-gray-50`;
  if (!hasDue && d.collectedAmount > 0)  return `${base}${ring} bg-emerald-50 border-emerald-100`;
  if (d.collectedAmount >= d.expectedAmount * 0.9) return `${base}${ring} bg-emerald-50 border-emerald-100`;
  if (d.collectedAmount > 0) return `${base}${ring} bg-amber-50 border-amber-100`;
  return `${base}${ring} bg-red-50 border-red-100`;
}

export default function CashFlowPage() {
  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState<string | null>(todayStr);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setSelected(null);
  }
  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelected(todayStr);
  }

  const { data: days = [], isLoading: calLoading } = useQuery({
    queryKey: ['cashflow-calendar', year, month],
    queryFn:  () => reportsApi.getCashflowCalendar(year, month),
    staleTime: 2 * 60_000,
  });

  const { data: dayInstallments = [], isLoading: dayLoading } = useQuery({
    queryKey: ['cashflow-day', selected],
    queryFn:  () => reportsApi.getCashflowDay(selected!),
    enabled:  !!selected,
    staleTime: 60_000,
  });

  const { data: shop } = useQuery({
    queryKey: ['shop-profile'],
    queryFn:  sellersApi.getMe,
    staleTime: 300_000,
  });

  // Summary
  const totalExpected  = days.reduce((s, d) => s + d.expectedAmount, 0);
  const totalCollected = days.reduce((s, d) => s + d.collectedAmount, 0);
  const rate           = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  const missed         = Math.max(0, totalExpected - totalCollected);
  const activeDays     = days.filter((d) => d.expectedAmount > 0).length;

  // Calendar helpers
  const firstDow    = new Date(year, month - 1, 1).getDay();
  const emptyCells  = Array<null>(firstDow).fill(null);

  const selectedDay = days.find((d) => d.date === selected);
  const unpaid      = dayInstallments.filter((i) => i.paidToday < i.monthly * 0.9);

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ── Left: calendar ───────────────────────────────────────── */}
      <div className="flex-1 p-6 overflow-y-auto min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cash Flow Calendar</h1>
            <p className="text-sm text-gray-400 mt-0.5">Har din ka expected vs collected — ek nazar mein</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition text-gray-600">
              <ChevronLeft size={16} />
            </button>
            <span className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 min-w-[148px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition text-gray-600">
              <ChevronRight size={16} />
            </button>
            <button onClick={goToday} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
              Today
            </button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            {
              label: 'Expected',
              value: pkr(totalExpected),
              sub:   `${activeDays} active days`,
              cls:   'text-gray-900',
            },
            {
              label: 'Collected',
              value: pkr(totalCollected),
              sub:   `${days.filter((d) => d.collectedAmount > 0).length} days paid`,
              cls:   'text-emerald-600',
            },
            {
              label: 'Collection Rate',
              value: `${rate}%`,
              sub:   'of expected amount',
              cls:   rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-500',
            },
            {
              label: 'Shortfall',
              value: pkr(missed),
              sub:   missed === 0 ? 'All collected!' : 'needs follow-up',
              cls:   missed > 0 ? 'text-red-500' : 'text-gray-400',
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-base font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-[11px] text-gray-400">
          {[
            { bg: 'bg-emerald-100 border-emerald-200', label: 'Fully collected' },
            { bg: 'bg-amber-100 border-amber-200',     label: 'Partial' },
            { bg: 'bg-red-100 border-red-200',         label: 'Missed' },
            { bg: 'bg-blue-50 ring-2 ring-blue-500',   label: 'Today' },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded border inline-block ${l.bg}`} />
              {l.label}
            </span>
          ))}
        </div>

        {/* Calendar grid */}
        {calLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_LABELS.map((d) => (
                <p key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</p>
              ))}
            </div>

            {/* Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {emptyCells.map((_, i) => <div key={`e${i}`} />)}
              {days.map((d) => {
                const dayNum  = parseInt(d.date.slice(8));
                const isPast  = d.date < todayStr;
                const isToday = d.date === todayStr;
                const hasDue  = d.expectedAmount > 0;
                const collPct = hasDue ? Math.min(100, Math.round((d.collectedAmount / d.expectedAmount) * 100)) : null;
                const isSelected = d.date === selected;

                return (
                  <div
                    key={d.date}
                    onClick={() => setSelected(isSelected ? null : d.date)}
                    className={dayBg(d, todayStr, isSelected)}
                  >
                    {/* Day number */}
                    <span className={`text-xs font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      {dayNum}
                    </span>

                    {/* Count badge */}
                    {d.expectedCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] text-gray-400 leading-none">
                        {d.expectedCount}
                      </span>
                    )}

                    {hasDue && (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-[10px] text-gray-400 leading-tight truncate">
                          {pkr(d.expectedAmount)}
                        </p>
                        {(isPast || isToday) && (
                          <p className={`text-[10px] font-semibold leading-tight truncate ${
                            d.collectedAmount >= d.expectedAmount * 0.9 ? 'text-emerald-600' :
                            d.collectedAmount > 0 ? 'text-amber-600' : 'text-red-500'
                          }`}>
                            {pkr(d.collectedAmount)}
                          </p>
                        )}
                        {collPct !== null && isPast && (
                          <div className="h-1 rounded-full bg-black/10 overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                collPct >= 90 ? 'bg-emerald-500' : collPct > 0 ? 'bg-amber-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${collPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Unexpected payment on a non-due day */}
                    {!hasDue && d.collectedAmount > 0 && (
                      <p className="text-[10px] text-emerald-600 font-semibold mt-1 leading-tight truncate">
                        {pkr(d.collectedAmount)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Right: day detail panel ───────────────────────────────── */}
      {selected && (
        <div className="w-72 shrink-0 border-l border-gray-100 bg-white flex flex-col overflow-hidden">

          {/* Panel header */}
          <div className="px-4 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{fmtDayLabel(selected)}</p>
                {selectedDay && selectedDay.expectedAmount > 0 && (
                  <div className="mt-1 space-y-0.5 text-xs">
                    <p className="text-gray-400">
                      Expected:{' '}
                      <span className="font-semibold text-gray-800">{pkr(selectedDay.expectedAmount)}</span>
                    </p>
                    <p className="text-gray-400">
                      Collected:{' '}
                      <span className={`font-semibold ${
                        selectedDay.collectedAmount >= selectedDay.expectedAmount * 0.9
                          ? 'text-emerald-600'
                          : selectedDay.collectedAmount > 0
                            ? 'text-amber-600'
                            : 'text-red-500'
                      }`}>
                        {pkr(selectedDay.collectedAmount)}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Bulk WhatsApp prompt */}
            {unpaid.length > 0 && shop && (
              <p className="text-[11px] text-gray-400 mt-2">
                {unpaid.length} pending — tap the{' '}
                <MessageCircle size={10} className="inline text-green-500" />{' '}
                icon on each to send reminder
              </p>
            )}
          </div>

          {/* Installments list */}
          <div className="flex-1 overflow-y-auto">
            {dayLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : dayInstallments.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Calendar size={24} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Is din koi installment due nahi</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {dayInstallments.map((inst: CashflowDayInstallment) => {
                  const paid    = inst.paidToday >= inst.monthly * 0.9;
                  const partial = inst.paidToday > 0 && !paid;

                  return (
                    <div key={inst.id} className={`px-4 py-3 ${paid ? 'bg-emerald-50/30' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {inst.customerName}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">{inst.productName}</p>
                          {inst.area && (
                            <p className="text-[11px] text-gray-400">{inst.area}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {paid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                              ✓ Paid
                            </span>
                          ) : partial ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                              Partial
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                              Pending
                            </span>
                          )}
                          <p className="text-xs font-bold text-gray-800 mt-1">{pkr(inst.monthly)}</p>
                          {partial && (
                            <p className="text-[10px] text-amber-600">{pkr(inst.paidToday)} mila</p>
                          )}
                        </div>
                      </div>

                      {/* WhatsApp button for unpaid */}
                      {!paid && shop && (
                        <button
                          onClick={() =>
                            openWhatsApp(
                              inst.customerPhone,
                              reminderMessage({
                                shopName:         shop.shopName,
                                customerName:     inst.customerName,
                                productName:      inst.productName,
                                monthly:          inst.monthly,
                                remaining:        inst.remaining,
                                paymentFrequency: inst.paymentFrequency,
                              }),
                            )
                          }
                          className="mt-2 flex items-center gap-1.5 text-[11px] text-green-600 hover:text-green-700 font-medium transition"
                        >
                          <MessageCircle size={11} />
                          {inst.customerPhone}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
