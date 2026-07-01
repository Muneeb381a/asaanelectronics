import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X, ArrowRightLeft, Search, CheckCircle2, Loader2, User } from 'lucide-react';
import { installmentsApi, type Installment } from '../../api/installments.api.ts';
import { customersApi } from '../../api/customers.api.ts';
import { getErrorMessage } from '../../utils/error.ts';

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

interface Props {
  installment: Installment;
  onClose: () => void;
}

export default function TransferModal({ installment, onClose }: Props) {
  const qc = useQueryClient();
  const [search, setSearch]           = useState('');
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [reason, setReason]           = useState('');
  const [confirmed, setConfirmed]     = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['customer-search-transfer', search],
    queryFn: () => customersApi.list({ search: search.trim(), limit: 8 }),
    enabled: search.trim().length >= 2,
    staleTime: 30_000,
  });

  const customers = data?.data ?? [];

  const { mutate: doTransfer, isPending } = useMutation({
    mutationFn: () => installmentsApi.transfer(installment.id, {
      newCustomerId: selectedId!,
      reason: reason.trim() || undefined,
    }),
    onSuccess: (result) => {
      toast.success(`Installment ${result.newCustomerName} ko transfer ho gayi`);
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.invalidateQueries({ queryKey: ['installments-recovery'] });
      qc.invalidateQueries({ queryKey: ['overdue-stage'] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Transfer fail ho gaya')),
  });

  const monthly    = Number(installment.monthly);
  const remaining  = Number(installment.remaining);
  const paidAmt    = Number(installment.totalAmount) - Number(installment.downPayment) - remaining;
  const paidPeriods     = Math.max(0, Math.floor(paidAmt / (monthly || 1) + 0.001));
  const remainingPeriods = Math.max(1, installment.months - paidPeriods);

  function selectCustomer(id: string, name: string) {
    setSelectedId(id);
    setSelectedName(name);
    setSearch('');
    setConfirmed(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900">Installment Transfer</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current installment summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
            <p className="font-semibold text-gray-800">{installment.customerName}</p>
            <p className="text-gray-500">{installment.productName}{installment.imeiNumber ? ` · ${installment.imeiNumber}` : ''}</p>
            <div className="flex gap-4 pt-1 text-xs text-gray-500">
              <span>Remaining: <span className="font-semibold text-gray-800">{pkr(remaining)}</span></span>
              <span>Baqi periods: <span className="font-semibold text-gray-800">{remainingPeriods}</span></span>
              <span>Monthly: <span className="font-semibold text-gray-800">{pkr(monthly)}</span></span>
            </div>
          </div>

          {/* New customer selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Naya Customer
            </label>
            {selectedId ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <User size={16} className="text-indigo-500 shrink-0" />
                <span className="flex-1 text-sm font-medium text-indigo-900">{selectedName}</span>
                <button onClick={() => { setSelectedId(null); setSelectedName(''); setConfirmed(false); }}
                  className="text-indigo-400 hover:text-indigo-600 text-xs underline">
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name ya phone se dhundein…"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {(search.trim().length >= 2) && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {isFetching ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={16} className="animate-spin text-gray-400" />
                      </div>
                    ) : customers.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">Koi customer nahi mila</p>
                    ) : (
                      customers
                        .filter((c) => c.id !== installment.customerId)
                        .map((c) => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c.id, c.name)}
                            className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-indigo-50 transition border-b border-gray-50 last:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                              <p className="text-xs text-gray-400">{c.phone}{c.area ? ` · ${c.area}` : ''}</p>
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Wajah <span className="text-gray-300 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Device apne doost ko bech di"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Confirmation checkbox */}
          {selectedId && (
            <label className="flex items-start gap-3 cursor-pointer p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-xs text-amber-700 leading-relaxed">
                Mujhe pata hai ke <strong>{installment.customerName}</strong> ka installment cancel ho jayega aur <strong>{selectedName}</strong> ke liye <strong>{pkr(remaining)}</strong> ka naya installment (<strong>{remainingPeriods} periods</strong>) shuru hoga.
              </span>
            </label>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={() => doTransfer()}
              disabled={!selectedId || !confirmed || isPending}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Transfer Karo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
