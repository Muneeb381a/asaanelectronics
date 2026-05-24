import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldX, Clock } from 'lucide-react';
import { customersApi } from '../../api/customers.api.ts';
import { productsApi } from '../../api/products.api.ts';

const formSchema = z.object({
  customerId:  z.string().min(1, 'Select a customer'),
  productId:   z.string().min(1, 'Select a product'),
  totalAmount: z.number({ invalid_type_error: 'Required' }).positive(),
  downPayment: z.number({ invalid_type_error: 'Required' }).min(0),
  months:      z.number().int().min(1).max(60),
  startDate:   z.string().min(1, 'Required'),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  onCancel: () => void;
}

const MONTH_OPTIONS = [3, 6, 9, 12, 18, 24, 36, 48, 60];
const DOWN_PRESETS  = [10, 20, 25, 30, 50];

const VSTATUS = {
  PENDING:      { label: 'Pending',     cls: 'text-amber-600 bg-amber-50',    icon: <Clock size={10} /> },
  UNDER_REVIEW: { label: 'In Review',   cls: 'text-blue-600 bg-blue-50',      icon: <Clock size={10} /> },
  APPROVED:     { label: 'Verified',    cls: 'text-emerald-600 bg-emerald-50', icon: <ShieldCheck size={10} /> },
  REJECTED:     { label: 'Rejected',    cls: 'text-red-500 bg-red-50',         icon: <ShieldX size={10} /> },
};

function pkr(n: number) {
  return 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition';

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-gray-500 mb-1.5">{children}</p>;
}

function Divider() {
  return <div className="border-t border-gray-100" />;
}

export default function InstallmentForm({ onSubmit, isPending, onCancel }: Props) {
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { months: 12, startDate: new Date().toISOString().slice(0, 10), downPayment: 0 },
  });

  const [customerId, productId, totalAmount, downPayment, months, startDate] = useWatch({
    control,
    name: ['customerId', 'productId', 'totalAmount', 'downPayment', 'months', 'startDate'],
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.list({ limit: 500 }),
  });

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productsApi.list({ limit: 200 }),
  });

  const selectedCustomer = customers?.data.find((c) => c.id === customerId);
  const selectedProduct  = products?.data.find((p) => p.id === productId);

  const cashPrice = selectedProduct ? Number(selectedProduct.price) : null;
  const instPrice = selectedProduct?.installmentPrice ? Number(selectedProduct.installmentPrice) : null;
  const markupPct = cashPrice && instPrice && instPrice > cashPrice
    ? ((instPrice - cashPrice) / cashPrice * 100).toFixed(1) : null;

  function handleProductChange(id: string) {
    setValue('productId', id);
    const p = products?.data.find((x) => x.id === id);
    if (p) setValue('totalAmount', p.installmentPrice ? Number(p.installmentPrice) : Number(p.price));
  }

  const remaining = (totalAmount || 0) - (downPayment || 0);
  const monthly   = months && remaining > 0 ? remaining / months : 0;

  const schedule: { date: Date; amount: number }[] = [];
  if (monthly > 0 && startDate) {
    const base = new Date(startDate);
    for (let i = 1; i <= months; i++) schedule.push({ date: addMonths(base, i), amount: monthly });
  }

  return (
    <form
      onSubmit={handleSubmit((d) => onSubmit({ ...d, startDate: new Date(d.startDate).toISOString() }))}
      className="space-y-5"
    >
      {/* Customer */}
      <div>
        <Label>Customer</Label>
        <select {...register('customerId')} className={inp}>
          <option value="">Select customer…</option>
          {customers?.data.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
          ))}
        </select>
        {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId.message}</p>}

        {selectedCustomer && (() => {
          const vs = VSTATUS[selectedCustomer.verificationStatus ?? 'PENDING'];
          return (
            <div className="mt-2 flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {selectedCustomer.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-400">{selectedCustomer.phone} · {selectedCustomer.cnicMasked}</p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${vs.cls}`}>
                {vs.icon}{vs.label}
              </span>
            </div>
          );
        })()}
      </div>

      <Divider />

      {/* Product */}
      <div>
        <Label>Product</Label>
        <select value={productId ?? ''} onChange={(e) => handleProductChange(e.target.value)} className={inp}>
          <option value="">Select product…</option>
          {products?.data.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.brand ? ` · ${p.brand}` : ''}{p.model ? ` ${p.model}` : ''}
            </option>
          ))}
        </select>
        {errors.productId && <p className="text-xs text-red-500 mt-1">{errors.productId.message}</p>}

        {selectedProduct && (
          <div className="mt-2 flex items-center gap-4 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs">
            <span className="text-gray-500">Cash <span className="font-semibold text-gray-800">{pkr(Number(selectedProduct.price))}</span></span>
            {instPrice
              ? <><span className="text-gray-300">|</span><span className="text-blue-600 font-semibold">Instalment {pkr(instPrice)}</span>{markupPct && <span className="text-emerald-600 font-semibold">+{markupPct}%</span>}</>
              : <span className="text-amber-500">No instalment price set</span>
            }
            <span className="ml-auto text-gray-400">Stock: <span className={`font-semibold ${selectedProduct.stock === 0 ? 'text-red-500' : selectedProduct.stock <= 3 ? 'text-amber-500' : 'text-gray-700'}`}>{selectedProduct.stock}</span></span>
          </div>
        )}
      </div>

      <Divider />

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Total Amount (PKR)</Label>
          <input type="number" step="1" placeholder="0" {...register('totalAmount', { valueAsNumber: true })} className={inp} />
          {errors.totalAmount && <p className="text-xs text-red-500 mt-1">Required</p>}
        </div>
        <div>
          <Label>Down Payment (PKR)</Label>
          <input type="number" step="1" placeholder="0" {...register('downPayment', { valueAsNumber: true })} className={inp} />
        </div>
      </div>

      {/* Down payment presets */}
      {(totalAmount || 0) > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap -mt-1">
          {DOWN_PRESETS.map((pct) => (
            <button key={pct} type="button"
              onClick={() => setValue('downPayment', Math.round(totalAmount * pct / 100))}
              className="px-2.5 py-1 rounded-lg text-xs text-gray-500 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition font-medium">
              {pct}%
            </button>
          ))}
        </div>
      )}

      <Divider />

      {/* Duration */}
      <div>
        <Label>Duration</Label>
        <Controller
          name="months"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-1.5">
              {MONTH_OPTIONS.map((m) => (
                <button key={m} type="button" onClick={() => field.onChange(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    field.value === m
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}>
                  {m}m
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Start date */}
      <div>
        <Label>First Instalment Date</Label>
        <input type="date" {...register('startDate')} className={inp} />
      </div>

      <Divider />

      {/* Summary */}
      {remaining > 0 && (
        <div>
          {/* Key numbers */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Remaining', value: pkr(remaining) },
              { label: 'Monthly',   value: pkr(monthly),  highlight: true },
              { label: 'Duration',  value: `${months}m` },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl px-3 py-2.5 text-center ${s.highlight ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-100'}`}>
                <p className={`text-[10px] font-medium mb-0.5 ${s.highlight ? 'text-blue-200' : 'text-gray-400'}`}>{s.label}</p>
                <p className={`text-sm font-bold ${s.highlight ? 'text-white' : 'text-gray-800'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Schedule preview */}
          {schedule.length > 0 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <span>Instalment</span><span>Due Date</span><span>Amount</span>
              </div>
              <div className="divide-y divide-gray-50">
                {schedule.slice(0, 3).map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">{i + 1}</span>
                    <span className="text-gray-500">{fmtDate(row.date)}</span>
                    <span className="font-semibold text-gray-800">{pkr(row.amount)}</span>
                  </div>
                ))}
                {schedule.length > 4 && (
                  <div className="px-4 py-1.5 text-center text-[10px] text-gray-300">
                    {schedule.length - 4} more instalment{schedule.length - 4 !== 1 ? 's' : ''}
                  </div>
                )}
                {schedule.length > 3 && (
                  <div className="flex items-center justify-between px-4 py-2 text-xs bg-emerald-50">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-600 shrink-0">{months}</span>
                    <span className="text-gray-500">{fmtDate(schedule[schedule.length - 1].date)} <span className="text-emerald-500 font-medium">(Final)</span></span>
                    <span className="font-semibold text-gray-800">{pkr(schedule[schedule.length - 1].amount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition font-medium">
          Cancel
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition">
          {isPending ? 'Creating…' : 'Create Instalment'}
        </button>
      </div>
    </form>
  );
}
