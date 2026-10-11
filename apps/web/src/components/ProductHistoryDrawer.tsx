import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ShoppingBag, Phone } from 'lucide-react';
import { productsApi } from '../api/products.api.ts';
import { fmtDate } from '../utils/dateFormat.ts';

// Mirrors CustomersPage.tsx's STATUS_STYLES so an installment's status pill
// looks the same everywhere in the app.
const STATUS_STYLES: Record<string, string> = {
  PENDING:     'bg-amber-100 text-amber-700',
  ACTIVE:      'bg-green-100 text-green-700',
  COMPLETED:   'bg-blue-100 text-blue-700',
  DEFAULTED:   'bg-red-100 text-red-700',
  CANCELLED:   'bg-gray-100 text-gray-500',
  CLOSED:      'bg-slate-100 text-slate-500',
  WRITTEN_OFF: 'bg-gray-200 text-gray-600',
};

function pkr(v: number) {
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
}

export default function ProductHistoryDrawer({ productId, productName, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['product-history', productId],
    queryFn: () => productsApi.getSaleHistory(productId),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div className={`relative w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-hidden transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 truncate" title={productName}>{productName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sale History</p>
          </div>
          <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Stat cards */}
        {data && (
          <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-3 gap-2 shrink-0">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Total Units</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{data.summary.unitsSold}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wide">Cash Sales</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">{data.summary.cashSalesCount}</p>
              <p className="text-[10px] text-emerald-500">{pkr(data.summary.cashSalesTotal)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Installments</p>
              <p className="text-lg font-bold text-blue-700 mt-0.5">{data.summary.installmentCount}</p>
              <p className="text-[10px] text-blue-500">{pkr(data.summary.installmentTotal)}</p>
            </div>
          </div>
        )}

        {/* Sale list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />)}
            </div>
          ) : !rows.length ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
                <ShoppingBag size={26} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Abhi tak koi sale nahi hui</p>
              <p className="text-xs text-gray-400 max-w-[220px]">Is product ki koi cash sale ya installment sale record nahi hai.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{r.customerName}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                        <span>{fmtDate(r.date)}</span>
                        {r.customerPhone && (
                          <>
                            <span className="text-gray-200">·</span>
                            <Phone size={10} className="shrink-0" />
                            <span>{r.customerPhone}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.type === 'CASH' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {r.type === 'CASH' ? 'Cash Sale' : 'Installment'}
                      </span>
                      {r.status && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {r.status === 'WRITTEN_OFF' ? 'Written Off' : r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-gray-400 font-mono truncate max-w-[160px]">{r.imeiNumber ? `IMEI: ${r.imeiNumber}` : ''}</p>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">{pkr(r.amount)}</p>
                      {r.remaining !== null && r.remaining > 0 && (
                        <p className="text-[10px] text-orange-500">{pkr(r.remaining)} baqi</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
