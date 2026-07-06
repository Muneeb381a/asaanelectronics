import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, Loader2 } from 'lucide-react';
import { installmentsApi } from '../api/installments.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { fmtDate } from '../utils/dateFormat.ts';

// ── helpers ───────────────────────────────────────────────────────────────────

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function addMonths(date: Date, months: number, dueDay: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dueDay, lastDay));
  return d;
}

interface ScheduleRow {
  period: number;
  date: Date;
  amount: number;
  paid: boolean;
}

function buildSchedule(
  startDate: string,
  paymentFrequency: string,
  months: number,
  monthly: string,
  totalAmount: string,
  downPayment: string,
  remaining: string,
  paymentDueDay: number,
): ScheduleRow[] {
  const start       = new Date(startDate);
  const amt         = Number(monthly);
  const totalPaid   = Number(totalAmount) - Number(downPayment) - Number(remaining);
  const periodsPaid = Math.max(0, Math.floor(totalPaid / amt + 0.001));
  const rows: ScheduleRow[] = [];

  for (let i = 1; i <= months; i++) {
    let date: Date;
    if (paymentFrequency === 'daily') {
      date = new Date(start);
      date.setDate(date.getDate() + i);
    } else {
      date = addMonths(start, i, paymentDueDay ?? 10);
    }
    rows.push({ period: i, date, amount: amt, paid: i <= periodsPaid });
  }
  return rows;
}

// ── print CSS injected ────────────────────────────────────────────────────────

const PRINT_STYLE = `
@page { size: A4 portrait; margin: 18mm 16mm; }
@media print {
  .no-print { display: none !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

// ── main component ────────────────────────────────────────────────────────────

export default function AgreementPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: inst,   isLoading: instLoading   } = useQuery({
    queryKey: ['installment', id],
    queryFn:  () => installmentsApi.getOne(id!),
    enabled:  !!id,
  });

  const { data: customer, isLoading: custLoading } = useQuery({
    queryKey: ['customer', inst?.customerId],
    queryFn:  () => customersApi.getOne(inst!.customerId),
    enabled:  !!inst?.customerId,
  });

  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ['shop-me'],
    queryFn:  sellersApi.getMe,
    staleTime: 5 * 60_000,
  });

  const isLoading = instLoading || custLoading || shopLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!inst || !customer || !shop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500 font-medium">Agreement load nahi hua</p>
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 hover:underline">
          Wapas jao
        </button>
      </div>
    );
  }

  const isDaily    = inst.paymentFrequency === 'daily';
  const schedule   = buildSchedule(
    inst.startDate ?? '', inst.paymentFrequency ?? 'monthly', inst.months,
    inst.monthly, inst.totalAmount, inst.downPayment, inst.remaining,
    inst.paymentDueDay,
  );
  const today      = new Date();
  const todayStr   = today.toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' });
  const periodLabel = isDaily ? 'Daily' : 'Monthly';
  const durationLabel = isDaily ? `${inst.months} Days` : `${inst.months} Months`;

  // Split schedule into pages of 20 rows each for printing
  const PAGE_ROWS = 20;
  const scheduleChunks: ScheduleRow[][] = [];
  for (let i = 0; i < schedule.length; i += PAGE_ROWS) {
    scheduleChunks.push(schedule.slice(i, i + PAGE_ROWS));
  }

  const hasG1 = !!customer.guarantorName;
  const hasG2 = !!customer.guarantor2Name;

  return (
    <>
      <style>{PRINT_STYLE}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 shadow-sm">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition">
          <ArrowLeft size={16} /> Wapas
        </button>
        <p className="text-sm font-semibold text-gray-700">
          Installment Agreement — {customer.name}
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm">
          <Printer size={15} /> Print
        </button>
      </div>

      {/* ── A4 Document ── */}
      <div className="max-w-[794px] mx-auto bg-white p-8 my-6 shadow-lg rounded-lg no-print-shadow print:shadow-none print:my-0 print:rounded-none">

        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-5">
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight uppercase">{shop.shopName}</p>
          {shop.address && <p className="text-xs text-gray-500 mt-0.5">{shop.address}</p>}
          {shop.phone   && <p className="text-xs text-gray-500">{shop.phone}</p>}

          <div className="mt-3">
            <p className="text-xl font-bold text-gray-800 tracking-widest">INSTALLMENT AGREEMENT</p>
            <p className="text-base font-semibold text-gray-600" style={{ fontFamily: 'serif' }}>اقرار نامہ</p>
          </div>
        </div>

        {/* Date + Invoice row */}
        <div className="flex justify-between text-xs text-gray-600 mb-4">
          <span>Date / تاریخ: <strong>{todayStr}</strong></span>
          {inst.invoiceNumber && <span>Invoice # <strong>{inst.invoiceNumber}</strong></span>}
        </div>

        {/* Customer + Product grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Customer */}
          <div className="border border-gray-300 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-2 border-b border-gray-200 pb-1">
              Customer / گاہک
            </p>
            <table className="w-full text-xs">
              <tbody>
                {[
                  ['Name / نام',        customer.name],
                  ['Father / والد',     customer.fatherName],
                  ['CNIC',              customer.cnicMasked],
                  ['Phone / فون',       customer.phone],
                  ['Address / پتہ',     [customer.area, customer.address].filter(Boolean).join(', ')],
                  ['Occupation',        customer.occupation],
                  ['Employer',          customer.employer],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <tr key={label as string} className="align-top">
                    <td className="pr-2 py-0.5 text-gray-500 font-medium whitespace-nowrap w-20">{label}</td>
                    <td className="py-0.5 font-semibold text-gray-800 break-words">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Product */}
          <div className="border border-gray-300 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-2 border-b border-gray-200 pb-1">
              Product / سامان
            </p>
            <table className="w-full text-xs">
              <tbody>
                {[
                  ['Product',        inst.productName],
                  ['IMEI',           inst.imeiNumber],
                  ['Total / کل',     pkr(inst.totalAmount)],
                  ['Down / ابتدائی', pkr(inst.downPayment)],
                  [periodLabel + ' Inst.', pkr(inst.monthly)],
                  ['Duration',       durationLabel],
                  ['Start Date',     fmtDate(inst.startDate)],
                  ['Due Day',        isDaily ? 'Daily' : `${inst.paymentDueDay}th of each month`],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <tr key={label as string} className="align-top">
                    <td className="pr-2 py-0.5 text-gray-500 font-medium whitespace-nowrap w-24">{label}</td>
                    <td className="py-0.5 font-semibold text-gray-800 break-words">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Guarantors */}
        {(hasG1 || hasG2) && (
          <div className={`grid gap-4 mb-4 ${hasG1 && hasG2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {hasG1 && (
              <div className="border border-gray-300 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-2 border-b border-gray-200 pb-1">
                  Guarantor 1 / ضامن اول
                </p>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ['Name',     customer.guarantorName],
                      ['CNIC',     customer.guarantorCnic],
                      ['Phone',    customer.guarantorPhone],
                      ['Relation', customer.guarantorRelation],
                      ['Address',  customer.guarantorAddress],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <tr key={label as string}>
                        <td className="pr-2 py-0.5 text-gray-500 font-medium whitespace-nowrap w-16">{label}</td>
                        <td className="py-0.5 font-semibold text-gray-800">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hasG2 && (
              <div className="border border-gray-300 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-2 border-b border-gray-200 pb-1">
                  Guarantor 2 / ضامن دوم
                </p>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ['Name',     customer.guarantor2Name],
                      ['CNIC',     customer.guarantor2Cnic],
                      ['Phone',    customer.guarantor2Phone],
                      ['Relation', customer.guarantor2Relation],
                      ['Address',  customer.guarantor2Address],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <tr key={label as string}>
                        <td className="pr-2 py-0.5 text-gray-500 font-medium whitespace-nowrap w-16">{label}</td>
                        <td className="py-0.5 font-semibold text-gray-800">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payment Schedule */}
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-2">
            Payment Schedule / ادائیگی شیڈول
          </p>
          {scheduleChunks.map((chunk, ci) => (
            <table key={ci} className={`w-full text-xs border-collapse mb-2 ${ci > 0 ? 'mt-4' : ''}`}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 w-12">#</th>
                  <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700">
                    Due Date / تاریخ
                  </th>
                  <th className="border border-gray-300 px-2 py-1 text-right font-semibold text-gray-700 w-28">
                    Amount / رقم
                  </th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold text-gray-700 w-24">
                    Status
                  </th>
                  <th className="border border-gray-300 px-2 py-1 text-center font-semibold text-gray-700 w-28">
                    Signature
                  </th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((row) => (
                  <tr key={row.period} className={row.paid ? 'bg-green-50' : ''}>
                    <td className="border border-gray-200 px-2 py-1 text-center text-gray-600">{row.period}</td>
                    <td className="border border-gray-200 px-2 py-1 text-gray-800">
                      {row.date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-semibold text-gray-800">
                      {pkr(row.amount)}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-center">
                      {row.paid
                        ? <span className="text-green-700 font-bold text-[10px]">✓ PAID</span>
                        : <span className="text-gray-400 text-[10px]">Pending</span>
                      }
                    </td>
                    <td className="border border-gray-200 px-2 py-1" />
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

          {/* Totals row */}
          <div className="flex justify-end mt-1">
            <table className="text-xs border-collapse">
              <tbody>
                <tr>
                  <td className="px-3 py-1 text-gray-500 font-medium">Down Payment</td>
                  <td className="px-3 py-1 font-bold text-gray-800 text-right">{pkr(inst.downPayment)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1 text-gray-500 font-medium">Total Installments</td>
                  <td className="px-3 py-1 font-bold text-gray-800 text-right">
                    {pkr(Number(inst.monthly) * inst.months)}
                  </td>
                </tr>
                <tr className="border-t border-gray-300">
                  <td className="px-3 py-1.5 font-bold text-gray-900">Grand Total / کل رقم</td>
                  <td className="px-3 py-1.5 font-extrabold text-gray-900 text-right">{pkr(inst.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Terms */}
        <div className="border border-gray-200 rounded-lg p-3 mb-5 bg-gray-50">
          <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-2">
            Terms &amp; Conditions / شرائط و ضوابط
          </p>
          <ol className="text-[10px] text-gray-600 space-y-1 list-decimal list-inside leading-relaxed">
            <li>Customer is responsible for timely payment on the due date.</li>
            <li>Default of 2 or more installments may result in product repossession without further notice.</li>
            <li>Product remains the property of {shop.shopName} until all installments are fully paid.</li>
            <li>Any damage or loss of product does not waive payment obligations.</li>
            <li>Guarantor(s) accept full liability in case of customer default.</li>
            <li>Early settlement is permitted; contact {shop.shopName} for the settlement amount.</li>
            <li>This agreement is governed by the laws of Pakistan.</li>
          </ol>
        </div>

        {/* Signature blocks */}
        <div className={`grid gap-6 mt-6 ${hasG1 || hasG2 ? (hasG1 && hasG2 ? 'grid-cols-3' : 'grid-cols-2') : 'grid-cols-2'}`}>
          {/* Customer signature */}
          <div className="text-center">
            <div className="border-b-2 border-gray-400 mb-2 h-12" />
            <p className="text-xs font-semibold text-gray-700">{customer.name}</p>
            <p className="text-[10px] text-gray-500">Customer / گاہک</p>
            <p className="text-[10px] text-gray-400 mt-0.5">CNIC: {customer.cnicMasked}</p>
          </div>

          {/* G1 signature */}
          {hasG1 && (
            <div className="text-center">
              <div className="border-b-2 border-gray-400 mb-2 h-12" />
              <p className="text-xs font-semibold text-gray-700">{customer.guarantorName}</p>
              <p className="text-[10px] text-gray-500">Guarantor 1 / ضامن اول</p>
              {customer.guarantorCnic && (
                <p className="text-[10px] text-gray-400 mt-0.5">CNIC: {customer.guarantorCnic}</p>
              )}
            </div>
          )}

          {/* G2 signature */}
          {hasG2 && (
            <div className="text-center">
              <div className="border-b-2 border-gray-400 mb-2 h-12" />
              <p className="text-xs font-semibold text-gray-700">{customer.guarantor2Name}</p>
              <p className="text-[10px] text-gray-500">Guarantor 2 / ضامن دوم</p>
              {customer.guarantor2Cnic && (
                <p className="text-[10px] text-gray-400 mt-0.5">CNIC: {customer.guarantor2Cnic}</p>
              )}
            </div>
          )}

          {/* Shop rep signature — only if 2-col layout has space, otherwise always add */}
          {(!hasG1 || !hasG2) && (
            <div className="text-center">
              <div className="border-b-2 border-gray-400 mb-2 h-12" />
              <p className="text-xs font-semibold text-gray-700">{shop.shopName}</p>
              <p className="text-[10px] text-gray-500">Shop Representative</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Authorized Signatory</p>
            </div>
          )}
        </div>

        {/* When both guarantors exist, add shop rep below */}
        {hasG1 && hasG2 && (
          <div className="grid grid-cols-3 gap-6 mt-6">
            <div />
            <div className="text-center">
              <div className="border-b-2 border-gray-400 mb-2 h-12" />
              <p className="text-xs font-semibold text-gray-700">{shop.shopName}</p>
              <p className="text-[10px] text-gray-500">Shop Representative</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Authorized Signatory</p>
            </div>
            <div />
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-gray-200 text-center">
          <p className="text-[9px] text-gray-400">
            Generated by {shop.shopName} · {todayStr} · {inst.invoiceNumber ?? inst.id.slice(-8).toUpperCase()}
          </p>
        </div>
      </div>
    </>
  );
}
