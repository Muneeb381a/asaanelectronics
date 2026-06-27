import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { installmentsApi, type DueSheetItem } from '../api/installments.api.ts';
import { fmtDate } from '../utils/dateFormat.ts';

function pkr(n: number) {
  return 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function groupByArea(items: DueSheetItem[]) {
  const map = new Map<string, DueSheetItem[]>();
  for (const item of items) {
    const key = item.area || 'Unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries());
}

export default function DueSheetPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['due-sheet'],
    queryFn:  installmentsApi.dueSheet,
    staleTime: 5 * 60_000,
  });

  const today = fmtDate(new Date());
  const groups = groupByArea(data);
  const total = data.reduce((s, d) => s + d.monthly, 0);

  useEffect(() => {
    if (!isLoading && data.length > 0) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [isLoading, data.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 print:hidden">
        Loading collection sheet…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans text-sm text-gray-900">
      {/* Print controls — hidden when printing */}
      <div className="print:hidden mb-4 flex items-center gap-3">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Print Sheet
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Close
        </button>
        <span className="text-xs text-gray-400">{data.length} installments due</span>
      </div>

      {/* Header */}
      <div className="border-b-2 border-gray-900 pb-3 mb-4">
        <h1 className="text-xl font-bold tracking-tight">Field Collection Sheet</h1>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-500">Date: {today}</p>
          <p className="text-xs font-semibold">Total Due: {pkr(total)} ({data.length} customers)</p>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No installments due today.</p>
      ) : (
        <div className="space-y-6">
          {groups.map(([area, items]) => (
            <div key={area} className="break-inside-avoid">
              {/* Area heading */}
              <div className="bg-gray-100 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest text-gray-700 mb-2 flex justify-between">
                <span>{area}</span>
                <span>{items.length} customers · {pkr(items.reduce((s, i) => s + i.monthly, 0))}</span>
              </div>

              {/* Table */}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1 pr-2 font-semibold text-gray-600 w-4">#</th>
                    <th className="text-left py-1 pr-2 font-semibold text-gray-600">Customer</th>
                    <th className="text-left py-1 pr-2 font-semibold text-gray-600">Phone</th>
                    <th className="text-left py-1 pr-2 font-semibold text-gray-600">Product</th>
                    <th className="text-right py-1 pr-2 font-semibold text-gray-600">Installment</th>
                    <th className="text-right py-1 pr-2 font-semibold text-gray-600">Balance</th>
                    <th className="text-center py-1 font-semibold text-gray-600 w-16">Status</th>
                    <th className="text-center py-1 font-semibold text-gray-600 w-20">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-1.5 pr-2 text-gray-400">{idx + 1}</td>
                      <td className="py-1.5 pr-2">
                        <div className="font-medium">{item.customerName}</div>
                        {item.customerAddress && (
                          <div className="text-gray-400 text-[10px] leading-tight truncate max-w-36">{item.customerAddress}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-gray-600">{item.customerPhone}</td>
                      <td className="py-1.5 pr-2 text-gray-700 truncate max-w-32">{item.productName}</td>
                      <td className="py-1.5 pr-2 text-right font-semibold">{pkr(item.monthly)}</td>
                      <td className="py-1.5 pr-2 text-right text-gray-600">{pkr(item.remaining)}</td>
                      <td className="py-1.5 text-center">
                        {item.daysOverdue === 0 ? (
                          <span className="text-blue-600 font-semibold">Today</span>
                        ) : (
                          <span className="text-red-600 font-semibold">{item.daysOverdue}d late</span>
                        )}
                      </td>
                      <td className="py-1.5 text-center">
                        {/* Checkbox for field staff to mark collected */}
                        <div className="inline-block w-5 h-5 border-2 border-gray-400 rounded" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-3 border-t border-gray-300 flex justify-between text-xs text-gray-400">
        <span>Assaan Electronics — Collection Sheet {today}</span>
        <span>Staff Signature: ___________________________</span>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          @page { margin: 1cm; size: A4; }
        }
      `}</style>
    </div>
  );
}
