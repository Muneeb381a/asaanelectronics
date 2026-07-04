import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ShieldCheck, ShieldX, Clock, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { customersApi } from '../../api/customers.api.ts';
import { guarantorsApi } from '../../api/guarantors.api.ts';
import { productsApi } from '../../api/products.api.ts';
import { productUnitsApi } from '../../api/productUnits.api.ts';
import { fmtDate } from '../../utils/dateFormat.ts';
import { useDebounce } from '../../hooks/useDebounce.ts';

const formSchema = z.object({
  customerId:        z.string().min(1, 'Select a customer'),
  productId:         z.string().min(1, 'Select a product'),
  totalAmount:       z.number({ invalid_type_error: 'Required' }).positive(),
  downPayment:       z.number({ invalid_type_error: 'Required' }).min(0),
  months:            z.number().int().min(1).max(1095),
  startDate:         z.string().min(1, 'Required'),
  imeiNumber:        z.string().max(20).optional(),
  cashPrice:         z.number({ invalid_type_error: 'Required' }).positive().optional(),
  profitMarkup:      z.number({ invalid_type_error: 'Required' }).min(0).optional(),
  paymentFrequency:  z.enum(['monthly', 'daily']).default('monthly'),
  paymentDueDay:     z.number().int().min(1).max(31).default(10),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  onCancel: () => void;
  murabahaMode?: boolean;
  lockedCustomerId?: string;   // staff CNIC flow: customer pre-selected, field hidden
  lockedCustomerName?: string;
}

const MONTH_OPTIONS = [3, 6, 9, 12, 18, 24, 36, 48, 60];
const DAY_OPTIONS   = [7, 10, 15, 20, 25, 30, 45, 60, 90, 120];
const DOWN_PRESETS  = [10, 20, 25, 30, 50];

function daysToHuman(d: number): string {
  if (d < 30) return `${d} din`;
  const months = Math.floor(d / 30);
  const days   = d % 30;
  if (days === 0) return `${months} mahina`;
  return `${months} mahina ${days} din`;
}

function monthsToHuman(m: number): string {
  if (m < 12) return `${m} mahina`;
  const years  = Math.floor(m / 12);
  const months = m % 12;
  if (months === 0) return `${years} saal`;
  return `${years} saal ${months} mahina`;
}

const VSTATUS = {
  PENDING:      { label: 'Pending',    cls: 'text-amber-600 bg-amber-50',     icon: <Clock size={10} /> },
  UNDER_REVIEW: { label: 'In Review',  cls: 'text-blue-600 bg-blue-50',       icon: <Clock size={10} /> },
  APPROVED:     { label: 'Verified',   cls: 'text-emerald-600 bg-emerald-50', icon: <ShieldCheck size={10} /> },
  REJECTED:     { label: 'Rejected',   cls: 'text-red-500 bg-red-50',         icon: <ShieldX size={10} /> },
};

function pkr(n: number) {
  return 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function dueDateForPeriod(startDate: Date, periodN: number, dueDay: number): Date {
  const year    = startDate.getFullYear();
  const month   = startDate.getMonth() + periodN;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dueDay, lastDay));
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition';

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-gray-500 mb-1.5">{children}</p>;
}

function Divider() {
  return <div className="border-t border-gray-100" />;
}

interface SelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

function SearchableSelect({
  options, value, onChange, placeholder = 'Search…', error, onQueryChange,
}: {
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  error?: string;
  onQueryChange?: (q: string) => void;
}) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // When onQueryChange is set, filtering is server-side — skip client filter
  const filtered = (onQueryChange || !query.trim())
    ? options
    : options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(query.toLowerCase()),
      );

  const displayValue = open ? query : (selected?.label ?? '');

  return (
    <div ref={containerRef} className="relative">
      {/* Input row */}
      <div
        className={`${inp} flex items-center gap-2 pr-2 cursor-text`}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); onQueryChange?.(e.target.value); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 outline-none bg-transparent text-sm min-w-0 placeholder:text-gray-400"
        />
        {value ? (
          <button
            type="button"
            onMouseDown={(e) => { e.stopPropagation(); onChange(''); setQuery(''); setOpen(false); }}
            className="shrink-0 text-gray-400 hover:text-red-400 transition"
          >
            <X size={13} />
          </button>
        ) : (
          <ChevronDown size={13} className="shrink-0 text-gray-400" />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search hint when nothing typed */}
          {!query && (
            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
              <ChevronDown size={12} className="text-gray-300 rotate-180" />
              <span className="text-[11px] text-gray-400">
                {filtered.length} item{filtered.length !== 1 ? 's' : ''} — type to filter
              </span>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">No results for "{query}"</p>
            ) : (
              <>
                {filtered.slice(0, 60).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={() => { onChange(o.id); setQuery(''); setOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 transition border-b border-gray-50 last:border-0 ${
                      o.id === value ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm text-gray-900 leading-tight">{o.label}</p>
                    {o.sublabel && <p className="text-[11px] text-gray-400 mt-0.5">{o.sublabel}</p>}
                  </button>
                ))}
                {filtered.length > 60 && (
                  <p className="px-3 py-2 text-center text-[11px] text-gray-400 border-t border-gray-50">
                    {filtered.length - 60} more — type to narrow down
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function InstallmentForm({ onSubmit, isPending, onCancel, murabahaMode = false, lockedCustomerId, lockedCustomerName: _lockedCustomerName }: Props) {
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      months: 12,
      startDate: new Date().toISOString().slice(0, 10),
      downPayment: 0,
      paymentFrequency: 'monthly',
      paymentDueDay: 10,
      // Pre-fill when customer is locked (staff CNIC flow)
      ...(lockedCustomerId ? { customerId: lockedCustomerId } : {}),
    },
  });

  const [dpIsFirst, setDpIsFirst] = useState(false);
  const [calcMode, setCalcMode]   = useState<'duration' | 'amount'>('duration');
  const [amountInput, setAmountInput] = useState<number | ''>('');

  const [
    customerId, productId, totalAmount, downPayment, months, startDate,
    cashPrice, profitMarkup, paymentFrequency, paymentDueDay,
  ] = useWatch({
    control,
    name: ['customerId', 'productId', 'totalAmount', 'downPayment', 'months', 'startDate', 'cashPrice', 'profitMarkup', 'paymentFrequency', 'paymentDueDay'],
  });

  const isDaily = paymentFrequency === 'daily';
  // Show murabaha-style fields when shop has murabaha mode OR when daily frequency is selected
  const showMurabaha = murabahaMode || isDaily;

  // Auto-compute totalAmount from cashPrice + profitMarkup in murabaha/daily mode
  useEffect(() => {
    if (showMurabaha) {
      const cp = cashPrice ?? 0;
      const pm = profitMarkup ?? 0;
      if (cp > 0 || pm > 0) setValue('totalAmount', cp + pm);
    }
  }, [showMurabaha, cashPrice, profitMarkup, setValue]);

  // When switching to daily mode, set default 25% markup if cashPrice is set
  useEffect(() => {
    if (isDaily && (cashPrice ?? 0) > 0 && (profitMarkup === undefined || profitMarkup === 0)) {
      setValue('profitMarkup', Math.round((cashPrice ?? 0) * 0.25));
    }
    // Reset months to daily default when switching
    if (isDaily && months > 90) setValue('months', 30);
    if (!isDaily && months < 3)  setValue('months', 12);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDaily]);

  const [customerQuery, setCustomerQuery] = useState('');
  const debouncedCustomerQuery = useDebounce(customerQuery, 300);

  const imeiValue     = useWatch({ control, name: 'imeiNumber' }) as string | undefined;
  const debouncedImei = useDebounce((imeiValue ?? '').replace(/\D/g, ''), 500);
  const { data: imeiLookup, isFetching: imeiChecking } = useQuery({
    queryKey: ['imei-lookup', debouncedImei],
    queryFn:  () => productUnitsApi.lookup(debouncedImei),
    enabled:  debouncedImei.length === 15,
    staleTime: 10_000,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-form-search', debouncedCustomerQuery],
    queryFn: () => customersApi.list({
      search: debouncedCustomerQuery || undefined,
      limit: 50,
      scope: 'shop',
    }),
  });

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productsApi.list({ limit: 200 }),
  });

  const { data: fetchedCustomer } = useQuery({
    queryKey: ['customer-single', customerId],
    queryFn:  () => customersApi.getOne(customerId!),
    enabled:  !!customerId,
    staleTime: 60_000,
  });
  const selectedCustomer = customers?.data.find((c) => c.id === customerId) ?? fetchedCustomer;

  // Guarantor exposure check — warns if a guarantor is already overexposed
  const g1Phone = fetchedCustomer?.guarantorPhone ?? null;
  const g2Phone = fetchedCustomer?.guarantor2Phone ?? null;
  const { data: g1List } = useQuery({
    queryKey: ['guarantor-exposure', g1Phone],
    queryFn: () => guarantorsApi.list(g1Phone!),
    enabled: !!g1Phone && !!customerId,
    staleTime: 60_000,
  });
  const { data: g2List } = useQuery({
    queryKey: ['guarantor-exposure', g2Phone],
    queryFn: () => guarantorsApi.list(g2Phone!),
    enabled: !!g2Phone && !!customerId && g2Phone !== g1Phone,
    staleTime: 60_000,
  });
  type GWarn = { name: string; activeCount: number; defaultedCount: number };
  const guarantorWarnings: GWarn[] = [
    g1List?.find((g) => g.phone === g1Phone),
    g2List?.find((g) => g.phone === g2Phone) ?? (g2Phone === g1Phone ? g1List?.find((g) => g.phone === g2Phone) : null),
  ].map((g, i) => ({
    name:           (i === 0 ? fetchedCustomer?.guarantorName : fetchedCustomer?.guarantor2Name) ?? 'Guarantor',
    activeCount:    g?.activeCount ?? 0,
    defaultedCount: g?.defaultedCount ?? 0,
  })).filter((w) => w.activeCount >= 2 || w.defaultedCount > 0);
  const selectedProduct  = products?.data.find((p) => p.id === productId);

  const cashPriceDisplay = selectedProduct ? Number(selectedProduct.price) : null;
  const instPrice = selectedProduct?.installmentPrice ? Number(selectedProduct.installmentPrice) : null;
  const markupPct = cashPriceDisplay && instPrice && instPrice > cashPriceDisplay
    ? ((instPrice - cashPriceDisplay) / cashPriceDisplay * 100).toFixed(1) : null;

  function handleProductChange(id: string) {
    setValue('productId', id);
    const p = products?.data.find((x) => x.id === id);
    if (p) {
      const price = p.installmentPrice ? Number(p.installmentPrice) : Number(p.price);
      if (showMurabaha) {
        setValue('cashPrice', Number(p.price));
        if (isDaily) {
          setValue('profitMarkup', Math.round(Number(p.price) * 0.25));
        } else if (p.installmentPrice && Number(p.installmentPrice) > Number(p.price)) {
          setValue('profitMarkup', Number(p.installmentPrice) - Number(p.price));
        }
      } else {
        setValue('totalAmount', price);
      }
    }
  }

  const effectiveTotal = showMurabaha ? ((cashPrice ?? 0) + (profitMarkup ?? 0)) : (totalAmount || 0);

  // When "down payment = first installment", monthly = total ÷ months; dp is locked to that amount
  const dpFirstMonthly = (dpIsFirst && effectiveTotal > 0 && (months ?? 0) > 1)
    ? isDaily
      ? Math.round((effectiveTotal / (months ?? 1)) / 5) * 5
      : Math.round((effectiveTotal / (months ?? 1)) / 25) * 25
    : null;

  // Auto-fill down payment when toggle is on
  useEffect(() => {
    if (dpIsFirst && dpFirstMonthly !== null) setValue('downPayment', dpFirstMonthly);
  }, [dpIsFirst, dpFirstMonthly, setValue]);

  // Turn off toggle if months drops to 1 (months-1=0 would be invalid)
  useEffect(() => {
    if ((months ?? 0) <= 1 && dpIsFirst) setDpIsFirst(false);
  }, [months, dpIsFirst]);

  const remaining = dpIsFirst && dpFirstMonthly !== null
    ? effectiveTotal - dpFirstMonthly
    : effectiveTotal - (downPayment || 0);

  // Amount-first mode — must be declared before `periodic` uses amountPerPeriod
  const amountPerPeriod = typeof amountInput === 'number' && amountInput > 0 ? amountInput : 0;
  const calcDuration = amountPerPeriod > 0 && remaining > 0
    ? Math.ceil(remaining / amountPerPeriod)
    : 0;
  const lastPayment = calcDuration > 0
    ? remaining - amountPerPeriod * (calcDuration - 1)
    : 0;
  const lastPaymentDiffers = lastPayment > 0 && Math.abs(lastPayment - amountPerPeriod) > 1;

  const periodic = dpIsFirst && dpFirstMonthly !== null
    ? dpFirstMonthly
    : calcMode === 'amount' && amountPerPeriod > 0
      ? amountPerPeriod
      : (months && remaining > 0
        ? isDaily
          ? Math.round((remaining / months) / 5) * 5
          : Math.round((remaining / months) / 25) * 25
        : 0);

  // Sync calculated duration back to form when in amount-first mode
  useEffect(() => {
    if (calcMode === 'amount' && calcDuration > 0) {
      setValue('months', calcDuration);
    }
  }, [calcMode, calcDuration, setValue]);

  // Reset amountInput when switching calc modes or frequency; reset calcMode on frequency change
  useEffect(() => {
    setAmountInput('');
  }, [calcMode, paymentFrequency]);

  useEffect(() => {
    setCalcMode('duration');
  }, [paymentFrequency]);

  // Future installment count (excludes the down payment month when dpIsFirst)
  const futureMonths = dpIsFirst ? (months ?? 1) - 1 : (months ?? 0);

  const schedule: { date: Date; amount: number }[] = [];
  if (periodic > 0 && startDate) {
    const base    = new Date(startDate);
    const dueDay  = paymentDueDay ?? 10;
    for (let i = 1; i <= futureMonths; i++) {
      schedule.push({ date: isDaily ? addDays(base, i) : dueDateForPeriod(base, i, dueDay), amount: periodic });
    }
  }

  const murabahaPct = (cashPrice ?? 0) > 0 && (profitMarkup ?? 0) > 0
    ? (((profitMarkup ?? 0) / (cashPrice ?? 1)) * 100).toFixed(1)
    : null;

  return (
    <form
      onSubmit={handleSubmit((d) => onSubmit({
        ...d,
        startDate: new Date(d.startDate).toISOString(),
        months: dpIsFirst ? d.months - 1 : d.months,
      }))}
      className="space-y-5"
    >
      {/* Payment frequency toggle */}
      <div className="flex gap-1.5">
        {(['monthly', 'daily'] as const).map((freq) => (
          <button
            key={freq}
            type="button"
            onClick={() => setValue('paymentFrequency', freq, { shouldValidate: true })}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition ${
              paymentFrequency === freq
                ? freq === 'daily'
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {freq === 'monthly' ? 'Monthly Plan' : 'Daily Dukaan-Dar'}
          </button>
        ))}
      </div>

      {/* Daily mode banner */}
      {isDaily && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-800">
          <span className="w-2 h-2 mt-0.5 rounded-full bg-orange-500 shrink-0" />
          <div>
            <p className="font-semibold">Dukaan-Dar Daily Plan</p>
            <p className="text-orange-600 font-normal mt-0.5">25% markup auto-applied · Customer pays daily · Shop owner guarantors</p>
          </div>
        </div>
      )}

      {/* Murabaha mode banner (only for non-daily murabaha) */}
      {murabahaMode && !isDaily && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          Murabaha Mode — cost price + profit markup disclosed separately
        </div>
      )}

      {/* Customer — hidden in locked (CNIC staff) mode; shown as dropdown for owners */}
      {!lockedCustomerId && (
        <div>
          <Label>Customer</Label>
          <SearchableSelect
            options={customers?.data.map((c) => ({
              id: c.id,
              label: c.name,
              sublabel: `${c.phone} · ${c.cnicMasked}`,
            })) ?? []}
            value={customerId ?? ''}
            onChange={(id) => setValue('customerId', id, { shouldValidate: true })}
            onQueryChange={setCustomerQuery}
            placeholder="Naam, mobile number ya CNIC sy search karo…"
            error={errors.customerId?.message}
          />

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

          {guarantorWarnings.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {guarantorWarnings.map((w) => (
                <div key={w.name} className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
                  <div>
                    <span className="font-semibold">{w.name}</span> pehle se{' '}
                    <span className="font-semibold">{w.activeCount}</span> account(s) guarantee kar raha/rahi hai
                    {w.defaultedCount > 0 && (
                      <span className="text-red-600"> · {w.defaultedCount} default(s)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Divider />

      {/* Product */}
      <div>
        <Label>Product <span className="text-gray-400 font-normal">(available stock mein se select karo)</span></Label>
        <SearchableSelect
          options={products?.data.map((p) => ({
            id: p.id,
            label: `${p.name}${p.brand ? ` · ${p.brand}` : ''}${p.model ? ` ${p.model}` : ''}`,
            sublabel: p.installmentPrice
              ? `Inst: PKR ${Number(p.installmentPrice).toLocaleString()} · Stock: ${p.stock}`
              : `Cash: PKR ${Number(p.price).toLocaleString()} · Stock: ${p.stock}`,
          })) ?? []}
          value={productId ?? ''}
          onChange={(id) => handleProductChange(id)}
          placeholder="Product search karo — naam ya brand…"
          error={errors.productId?.message}
        />

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
      {showMurabaha ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Cash Price (PKR)</Label>
              <input type="number" step="1" placeholder="0" {...register('cashPrice', { valueAsNumber: true })} className={inp} />
              {errors.cashPrice && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
            <div>
              <Label>
                {isDaily ? 'Profit Markup — 25%' : 'Profit Markup (PKR)'}
              </Label>
              <div className="relative">
                <input type="number" step="1" placeholder="0" {...register('profitMarkup', { valueAsNumber: true })} className={inp} />
                {isDaily && (cashPrice ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setValue('profitMarkup', Math.round((cashPrice ?? 0) * 0.25))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded font-semibold hover:bg-orange-200 transition"
                  >
                    25%
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Breakdown */}
          {(cashPrice ?? 0) > 0 && (
            <div className={`border rounded-xl px-4 py-3 text-xs space-y-1.5 ${isDaily ? 'bg-orange-50 border-orange-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex justify-between text-gray-600">
                <span>Cash Price</span>
                <span className="font-semibold text-gray-800">{pkr(cashPrice ?? 0)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Profit Markup{murabahaPct ? ` (${murabahaPct}%)` : ''}</span>
                <span className={`font-semibold ${isDaily ? 'text-orange-700' : 'text-emerald-700'}`}>+ {pkr(profitMarkup ?? 0)}</span>
              </div>
              <div className={`border-t pt-1.5 flex justify-between ${isDaily ? 'border-orange-200' : 'border-emerald-200'}`}>
                <span className="font-semibold text-gray-700">Total</span>
                <span className="font-bold text-gray-900">{pkr((cashPrice ?? 0) + (profitMarkup ?? 0))}</span>
              </div>
            </div>
          )}

          <div>
            <Label>Down Payment (PKR)</Label>
            <input type="number" step="1" placeholder="0" readOnly={dpIsFirst}
              {...register('downPayment', { valueAsNumber: true })}
              className={`${inp} ${dpIsFirst ? 'bg-blue-50 text-blue-700 font-semibold cursor-not-allowed' : ''}`} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Total Amount (PKR)</Label>
            <input type="number" step="1" placeholder="0" {...register('totalAmount', { valueAsNumber: true })} className={inp} />
            {errors.totalAmount && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>
          <div>
            <Label>Down Payment (PKR)</Label>
            <input type="number" step="1" placeholder="0" readOnly={dpIsFirst}
              {...register('downPayment', { valueAsNumber: true })}
              className={`${inp} ${dpIsFirst ? 'bg-blue-50 text-blue-700 font-semibold cursor-not-allowed' : ''}`} />
          </div>
        </div>
      )}

      {/* Down payment presets + first-installment toggle */}
      {effectiveTotal > 0 && (
        <div className="space-y-2 -mt-1">
          {/* Presets — hidden when dpIsFirst since dp is auto-locked */}
          {!dpIsFirst && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {DOWN_PRESETS.map((pct) => (
                <button key={pct} type="button"
                  onClick={() => setValue('downPayment', Math.round(effectiveTotal * pct / 100))}
                  className="px-2.5 py-1 rounded-lg text-xs text-gray-500 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition font-medium">
                  {pct}%
                </button>
              ))}
            </div>
          )}

          {/* Toggle: down payment = first installment */}
          {(months ?? 0) > 1 && (
            <button
              type="button"
              onClick={() => setDpIsFirst((v) => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition text-left ${
                dpIsFirst
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-100 hover:border-gray-200'
              }`}
            >
              <div>
                <p className={`text-xs font-semibold ${dpIsFirst ? 'text-blue-800' : 'text-gray-600'}`}>
                  Pehli qist = Down Payment
                </p>
                <p className={`text-[10px] mt-0.5 ${dpIsFirst ? 'text-blue-500' : 'text-gray-400'}`}>
                  {dpIsFirst && dpFirstMonthly
                    ? `${pkr(dpFirstMonthly)} auto-set · ${months}m total, ${futureMonths}m baqi`
                    : 'Down payment ko pehli installment count karo'}
                </p>
              </div>
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${dpIsFirst ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${dpIsFirst ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          )}
        </div>
      )}

      <Divider />

      {/* Duration */}
      <div className="space-y-3">
        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-500 shrink-0">
            {isDaily ? 'Duration (Days)' : 'Duration'}
          </p>
          <div className="ml-auto flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-semibold">
            {(['duration', 'amount'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCalcMode(m)}
                className={`px-2.5 py-1 transition ${
                  calcMode === m
                    ? isDaily
                      ? 'bg-orange-500 text-white'
                      : 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-600 bg-white'
                }`}
              >
                {m === 'duration'
                  ? (isDaily ? 'Din chunno' : 'Mahine chunno')
                  : (isDaily ? 'Roz ka amount' : 'Mahine ka amount')}
              </button>
            ))}
          </div>
        </div>

        {calcMode === 'duration' ? (
          /* ── Duration-first mode (original) ── */
          <Controller
            name="months"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {(isDaily ? DAY_OPTIONS : MONTH_OPTIONS).map((n) => (
                    <button key={n} type="button" onClick={() => field.onChange(n)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        field.value === n
                          ? isDaily
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}>
                      {isDaily ? `${n}d` : `${n}m`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1095}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 1 && v <= 1095) field.onChange(v);
                      else if (e.target.value === '') field.onChange(undefined);
                    }}
                    placeholder={isDaily ? 'Custom days…' : 'Custom months…'}
                    className="w-36 px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                  />
                  {field.value && !(isDaily ? DAY_OPTIONS : MONTH_OPTIONS).includes(field.value) && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${isDaily ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {field.value}{isDaily ? 'd' : 'm'} ✓
                    </span>
                  )}
                </div>
              </div>
            )}
          />
        ) : (
          /* ── Amount-first mode (new) ── */
          <div className="space-y-3">
            <div>
              <Label>
                {isDaily ? 'Roz ka payment (PKR)' : 'Mahine ka payment (PKR)'}
              </Label>
              <input
                type="number"
                min={1}
                step={1}
                value={amountInput}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setAmountInput(isNaN(v) || v <= 0 ? '' : v);
                }}
                placeholder={isDaily ? 'e.g. 200' : 'e.g. 3000'}
                className={`${inp} ${isDaily ? 'focus:border-orange-400 focus:ring-orange-50' : ''}`}
                autoFocus
              />
              {/* Quick-pick presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(isDaily
                  ? [100, 150, 200, 300, 400, 500, 750, 1000]
                  : [1000, 1500, 2000, 3000, 5000, 10000]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountInput(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      amountInput === preset
                        ? isDaily
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {preset >= 1000 ? `${preset / 1000}k` : preset}
                  </button>
                ))}
              </div>
              {remaining <= 0 && (
                <p className="text-[11px] text-amber-500 mt-1">Pehle total amount aur down payment fill karo</p>
              )}
            </div>

            {/* Result card */}
            {calcDuration > 0 && remaining > 0 && (
              <div className={`rounded-xl border p-4 space-y-3 ${isDaily ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>

                {/* Formula line */}
                <p className={`text-[10px] font-mono text-center ${isDaily ? 'text-orange-500' : 'text-blue-500'}`}>
                  {pkr(remaining)} ÷ {pkr(amountPerPeriod)}/{isDaily ? 'din' : 'mahina'} = {calcDuration} {isDaily ? 'din' : 'mahine'}
                </p>

                {/* Big result */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${isDaily ? 'text-orange-500' : 'text-blue-500'}`}>
                      {isDaily ? 'Kul Din' : 'Kul Mahine'}
                    </p>
                    <p className={`text-3xl font-extrabold leading-none ${isDaily ? 'text-orange-700' : 'text-blue-700'}`}>
                      {calcDuration}
                      <span className={`text-base font-bold ml-1.5 ${isDaily ? 'text-orange-500' : 'text-blue-500'}`}>
                        {isDaily ? 'din' : 'mahine'}
                      </span>
                    </p>
                  </div>
                  <div className={`text-right px-3 py-2 rounded-xl ${isDaily ? 'bg-orange-100' : 'bg-blue-100'}`}>
                    <p className="text-[9px] text-gray-400 mb-0.5">Asan andaza</p>
                    <p className={`text-sm font-bold ${isDaily ? 'text-orange-800' : 'text-blue-800'}`}>
                      {isDaily ? daysToHuman(calcDuration) : monthsToHuman(calcDuration)}
                    </p>
                  </div>
                </div>

                {/* 3-col breakdown */}
                <div className={`border-t pt-3 grid grid-cols-3 gap-2 text-center ${isDaily ? 'border-orange-200' : 'border-blue-200'}`}>
                  <div>
                    <p className="text-[9px] text-gray-400 mb-0.5 uppercase tracking-wide">Baqi raqam</p>
                    <p className="text-xs font-bold text-gray-800">{pkr(remaining)}</p>
                  </div>
                  <div>
                    <p className={`text-[9px] mb-0.5 uppercase tracking-wide ${isDaily ? 'text-orange-500' : 'text-blue-500'}`}>
                      {isDaily ? 'Roz' : 'Mahana'}
                    </p>
                    <p className={`text-xs font-bold ${isDaily ? 'text-orange-700' : 'text-blue-700'}`}>{pkr(amountPerPeriod)}</p>
                  </div>
                  <div>
                    <p className={`text-[9px] mb-0.5 uppercase tracking-wide ${lastPaymentDiffers ? 'text-amber-500' : 'text-gray-400'}`}>
                      Aakhri payment
                    </p>
                    <p className={`text-xs font-bold ${lastPaymentDiffers ? 'text-amber-600' : 'text-gray-800'}`}>
                      {pkr(lastPayment)}
                    </p>
                  </div>
                </div>

                {/* Completion date */}
                {startDate && (
                  <div className={`border-t pt-2.5 flex items-center justify-between ${isDaily ? 'border-orange-200' : 'border-blue-200'}`}>
                    <p className="text-[11px] text-gray-500 font-medium">Installment khatam hogi</p>
                    <p className={`text-sm font-bold ${isDaily ? 'text-orange-700' : 'text-blue-700'}`}>
                      {fmtDate(isDaily
                        ? addDays(new Date(startDate), calcDuration)
                        : dueDateForPeriod(new Date(startDate), calcDuration, paymentDueDay ?? 10)
                      )}
                    </p>
                  </div>
                )}

                {/* Last payment warning */}
                {lastPaymentDiffers && (
                  <p className={`text-[10px] ${isDaily ? 'text-orange-700' : 'text-blue-700'} bg-white/70 rounded-lg px-2.5 py-1.5`}>
                    ⚠ Aakhri {isDaily ? 'din' : 'mahine'} mein {pkr(lastPayment)} banega — baqi amount adjust hogi
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Start date + due day */}
      <div className={!isDaily ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <Label>{isDaily ? 'First Payment Date' : 'Installment Start Date'}</Label>
          <input type="date" {...register('startDate')} className={inp} />
        </div>
        {!isDaily && (
          <div>
            <Label>Qist Jama Hone Ka Din</Label>
            <input
              type="number"
              min={1}
              max={31}
              placeholder="10"
              {...register('paymentDueDay', { valueAsNumber: true })}
              className={inp}
            />
            <p className="text-[11px] text-gray-400 mt-1">Har mahine is din (default: 10)</p>
          </div>
        )}
      </div>
      {/* First due date pill */}
      {!isDaily && startDate && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm">
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          <span className="text-gray-500 text-xs">Pehli qist due:</span>
          <span className="font-semibold text-blue-700 text-xs">
            {fmtDate(dueDateForPeriod(new Date(startDate), 1, paymentDueDay ?? 10))}
          </span>
        </div>
      )}

      {/* IMEI number */}
      <div>
        <Label>IMEI Number <span className="text-gray-400 font-normal">(optional — for phones)</span></Label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={15}
          placeholder="15-digit IMEI (dial *#06# on device)"
          {...register('imeiNumber')}
          className={inp}
        />
        {/* Real-time IMEI status */}
        {debouncedImei.length === 15 && (
          imeiChecking ? (
            <p className="text-[11px] text-gray-400 mt-1">Checking availability…</p>
          ) : imeiLookup?.found ? (
            imeiLookup.unit!.status === 'available' ? (
              <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 size={11} /> Available in inventory
                {imeiLookup.unit!.productName && ` — ${imeiLookup.unit!.productName}`}
              </p>
            ) : imeiLookup.unit!.status === 'sold' ? (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={11} /> Already sold to {imeiLookup.unit!.soldToName ?? 'another customer'} — this sale will be blocked
              </p>
            ) : (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={11} /> Unit is marked as {imeiLookup.unit!.status} in inventory
              </p>
            )
          ) : (
            <p className="text-[11px] text-gray-400 mt-1">Not in inventory — will be recorded as new unit</p>
          )
        )}
        {!debouncedImei.length && <p className="text-[11px] text-gray-400 mt-1">Dial *#06# on the device to find IMEI</p>}
      </div>

      <Divider />

      {/* Summary */}
      {remaining > 0 && (
        <div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
            {[
              { label: 'Remaining',                value: pkr(remaining) },
              { label: isDaily ? 'Daily' : 'Monthly', value: pkr(periodic), highlight: true },
              { label: isDaily ? 'Days' : 'Duration',  value: isDaily ? `${futureMonths}d` : `${futureMonths}m` },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl px-2 py-2 sm:px-3 sm:py-2.5 text-center ${
                s.highlight
                  ? isDaily ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                  : 'bg-gray-50 border border-gray-100'
              }`}>
                <p className={`text-[9px] sm:text-[10px] font-medium mb-0.5 ${s.highlight ? 'text-white/70' : 'text-gray-400'}`}>{s.label}</p>
                <p className={`text-xs sm:text-sm font-bold ${s.highlight ? 'text-white' : 'text-gray-800'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Schedule preview */}
          {schedule.length > 0 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <span>{isDaily ? 'Day' : 'Instalment'}</span><span>Due Date</span><span>Amount</span>
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
                    {schedule.length - 4} more {isDaily ? 'day' : 'instalment'}{schedule.length - 4 !== 1 ? 's' : ''}
                  </div>
                )}
                {schedule.length > 3 && (
                  <div className="flex items-center justify-between px-4 py-2 text-xs bg-emerald-50">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-600 shrink-0">{futureMonths}</span>
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
        <button type="submit" disabled={isPending || (calcMode === 'amount' && amountPerPeriod === 0)}
          className={`flex-1 py-2.5 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition ${
            isDaily ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
          {isPending ? 'Creating…' : 'Create Instalment'}
        </button>
      </div>
    </form>
  );
}
