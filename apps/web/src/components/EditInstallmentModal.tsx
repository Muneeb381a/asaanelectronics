import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { installmentsApi, type Installment } from '../api/installments.api.ts';
import { getErrorMessage } from '../utils/error.ts';

const MONTH_OPTIONS = [3, 6, 9, 12, 18, 24, 36, 48, 60];
const DAY_OPTIONS   = [7, 10, 15, 20, 25, 30, 45, 60, 90];

type FormValues = {
  totalAmount:      number;
  downPayment:      number;
  monthly:          number;
  months:           number;
  startDate:        string;
  paymentFrequency: 'monthly' | 'daily';
  paymentDueDay:    number;
  imeiNumber:       string;
  cashPrice:        string;
  profitMarkup:     string;
};

function toDateInput(d: string | Date) {
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';

interface Props {
  inst: Installment;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditInstallmentModal({ inst, onClose, onSaved }: Props) {
  const alreadyPaid = Number(inst.totalAmount) - Number(inst.downPayment) - Number(inst.remaining);

  const { register, control, watch, setValue, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      totalAmount:      Number(inst.totalAmount),
      downPayment:      Number(inst.downPayment),
      monthly:          Number(inst.monthly),
      months:           inst.months,
      startDate:        toDateInput(inst.startDate),
      paymentFrequency: inst.paymentFrequency as 'monthly' | 'daily',
      paymentDueDay:    inst.paymentDueDay ?? 10,
      imeiNumber:       inst.imeiNumber ?? '',
      cashPrice:        inst.cashPrice   ? String(Number(inst.cashPrice))   : '',
      profitMarkup:     inst.profitMarkup ? String(Number(inst.profitMarkup)) : '',
    },
  });

  const [totalAmount, downPayment, freq, paymentDueDay, startDate] = watch(['totalAmount', 'downPayment', 'paymentFrequency', 'paymentDueDay', 'startDate']);
  const newRemaining = (Number(totalAmount) || 0) - (Number(downPayment) || 0) - alreadyPaid;

  // Reset months preset when switching frequency
  useEffect(() => {
    if (freq === 'daily'   && inst.paymentFrequency !== 'daily')   setValue('months', 30);
    if (freq === 'monthly' && inst.paymentFrequency !== 'monthly') setValue('months', 12);
  }, [freq, inst.paymentFrequency, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => installmentsApi.update(inst.id, {
      totalAmount:      values.totalAmount,
      downPayment:      values.downPayment,
      monthly:          values.monthly,
      months:           values.months,
      startDate:        values.startDate,
      paymentFrequency: values.paymentFrequency,
      paymentDueDay:    values.paymentFrequency === 'monthly' ? values.paymentDueDay : undefined,
      imeiNumber:       values.imeiNumber || null,
      cashPrice:        values.cashPrice     ? Number(values.cashPrice)     : null,
      profitMarkup:     values.profitMarkup  ? Number(values.profitMarkup)  : null,
    }),
    onSuccess: () => { toast.success('Installment updated'); onSaved(); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to update installment')),
  });

  const modal = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit Installment</h2>
            <p className="text-xs text-gray-400 mt-0.5">{inst.customerName} · {inst.productName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">

            {/* Already paid info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex gap-3">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                Customer has already paid <strong>PKR {alreadyPaid.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</strong>.
                Changing total/down payment will recalculate the remaining balance.
              </span>
            </div>

            {/* Total + Down Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Amount (PKR)</label>
                <input type="number" min={1} step="any"
                  {...register('totalAmount', { required: true, valueAsNumber: true, min: 1 })}
                  className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Down Payment (PKR)</label>
                <input type="number" min={0} step="any"
                  {...register('downPayment', { required: true, valueAsNumber: true, min: 0 })}
                  className={inp} />
              </div>
            </div>

            {/* New remaining preview */}
            <div className={`text-xs px-3 py-2 rounded-lg font-medium ${newRemaining < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>
              {newRemaining < 0
                ? `⚠ Remaining would be negative (PKR ${newRemaining.toFixed(0)}) — reduce down payment or increase total`
                : `New remaining balance: PKR ${newRemaining.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
              }
            </div>

            {/* Monthly + Payment frequency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {freq === 'daily' ? 'Daily Amount (PKR)' : 'Monthly Amount (PKR)'}
                </label>
                <input type="number" min={1} step="any"
                  {...register('monthly', { required: true, valueAsNumber: true, min: 1 })}
                  className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                <Controller name="paymentFrequency" control={control} render={({ field }) => (
                  <div className="flex gap-2">
                    {(['monthly', 'daily'] as const).map((f) => (
                      <button key={f} type="button" onClick={() => field.onChange(f)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                          field.value === f
                            ? f === 'daily' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {f === 'monthly' ? 'Monthly' : 'Daily'}
                      </button>
                    ))}
                  </div>
                )} />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {freq === 'daily' ? 'Duration (Days)' : 'Duration (Months)'}
              </label>
              <Controller name="months" control={control} render={({ field }) => (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(freq === 'daily' ? DAY_OPTIONS : MONTH_OPTIONS).map((n) => (
                      <button key={n} type="button" onClick={() => field.onChange(n)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          field.value === n
                            ? freq === 'daily' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {freq === 'daily' ? `${n}d` : `${n}m`}
                      </button>
                    ))}
                  </div>
                  <input type="number" min={1} max={365} value={field.value ?? ''}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 365) field.onChange(v); }}
                    placeholder={freq === 'daily' ? 'Custom days…' : 'Custom months…'}
                    className="w-36 px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" />
                </div>
              )} />
            </div>

            {/* Start Date + Due Day */}
            <div className={freq === 'monthly' ? 'grid grid-cols-2 gap-3' : ''}>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" {...register('startDate', { required: true })} className={inp} />
              </div>
              {freq === 'monthly' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Qist Ka Din (1–31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="10"
                    {...register('paymentDueDay', { valueAsNumber: true, min: 1, max: 31 })}
                    className={inp}
                  />
                </div>
              )}
            </div>
            {freq === 'monthly' && startDate && (
              <div className="text-[11px] text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                Agli qist due: {(() => {
                  const base    = new Date(startDate);
                  const dueDay  = Math.min(Math.max(paymentDueDay ?? 10, 1), 31);
                  const alreadyPaidAmt = Number(inst.totalAmount) - Number(inst.downPayment) - Number(inst.remaining);
                  const mon     = Number(inst.monthly);
                  const periods = mon > 0 ? Math.max(0, Math.floor(alreadyPaidAmt / mon + 0.001)) : 0;
                  const year    = base.getFullYear();
                  const month   = base.getMonth() + periods + 1;
                  const lastDay = new Date(year, month + 1, 0).getDate();
                  return new Date(year, month, Math.min(dueDay, lastDay)).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
                })()}
              </div>
            )}

            {/* IMEI */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">IMEI Number <span className="text-gray-400">(optional)</span></label>
              <input type="text" {...register('imeiNumber')} placeholder="e.g. 352099001761481" className={inp} />
            </div>

            {/* Cash Price + Profit Markup */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cash Price <span className="text-gray-400">(optional)</span></label>
                <input type="number" min={0} step="any" {...register('cashPrice')} placeholder="0" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Profit Markup <span className="text-gray-400">(optional)</span></label>
                <input type="number" min={0} step="any" {...register('profitMarkup')} placeholder="0" className={inp} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit"
              disabled={mutation.isPending || newRemaining < 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
              {mutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
