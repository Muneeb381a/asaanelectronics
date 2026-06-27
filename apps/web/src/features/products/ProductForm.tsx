import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProductSchema, type CreateProductInput } from '@assaan/shared';
import type { Product } from '../../api/products.api.ts';

interface Props {
  defaultValues?: Partial<CreateProductInput>;
  onSubmit: (data: CreateProductInput) => void;
  isPending: boolean;
  onCancel: () => void;
  product?: Product;
}

const CATEGORIES = ['Refrigerator', 'AC', 'Washing Machine', 'TV', 'Mobile', 'Laptop', 'Generator', 'Other'];

function Field({ label, optional, error, children }: {
  label: string; optional?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition';

export default function ProductForm({ defaultValues, onSubmit, isPending, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { stock: 0, ...defaultValues },
  });

  const [purchasePrice, cashPrice, installmentPrice] = useWatch({ control, name: ['purchasePrice', 'price', 'installmentPrice'] });
  const markup = cashPrice && installmentPrice && installmentPrice > cashPrice
    ? installmentPrice - cashPrice
    : null;
  const markupPct = markup && cashPrice ? ((markup / cashPrice) * 100).toFixed(1) : null;

  const grossMargin = purchasePrice && cashPrice && cashPrice > purchasePrice
    ? Math.round(((cashPrice - purchasePrice) / cashPrice) * 100)
    : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Product Name" error={errors.name?.message}>
        <input {...register('name')} placeholder='e.g. Samsung Double Door Fridge' className={inputCls} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" optional>
          <select {...register('category')} className={inputCls}>
            <option value="">Select…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Brand" optional>
          <input {...register('brand')} placeholder="e.g. Samsung" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Model" optional>
          <input {...register('model')} placeholder="e.g. RT28K3022S8" className={inputCls} />
        </Field>
        <Field label="Color" optional>
          <input {...register('color')} placeholder="e.g. Silver" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Purchase Price (PKR)" optional error={errors.purchasePrice?.message}>
          <input type="number" step="0.01" {...register('purchasePrice', { valueAsNumber: true })} placeholder="Cost" className={inputCls} />
        </Field>
        <Field label="Cash Sale Price (PKR)" error={errors.price?.message}>
          <input type="number" step="0.01" {...register('price', { valueAsNumber: true })} placeholder="0" className={inputCls} />
        </Field>
      </div>
      {grossMargin !== null && (
        <p className={`text-xs font-medium -mt-1 ${grossMargin >= 20 ? 'text-emerald-600' : grossMargin >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
          Gross margin: {grossMargin}% · Profit: PKR {(cashPrice! - purchasePrice!).toLocaleString('en-PK')}
        </p>
      )}

      <Field label="Installment Price (PKR)" optional error={errors.installmentPrice?.message}>
        <input type="number" step="0.01" {...register('installmentPrice', { valueAsNumber: true })} placeholder="Price when selling on installment" className={inputCls} />
        {markup && markupPct && (
          <p className="text-xs text-blue-600 mt-1 font-medium">
            Markup: PKR {markup.toLocaleString('en-PK')} ({markupPct}% above cash price)
          </p>
        )}
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Stock">
          <input type="number" {...register('stock', { valueAsNumber: true })} placeholder="0" className={inputCls} />
        </Field>
        <Field label="Low Stock Alert" optional>
          <input type="number" {...register('minStock', { valueAsNumber: true })} placeholder="3" className={inputCls} />
        </Field>
        <Field label="Warranty (months)" optional>
          <input type="number" {...register('warrantyMonths', { valueAsNumber: true })} placeholder="e.g. 12" className={inputCls} />
        </Field>
      </div>

      <Field label="Serial / IMEI" optional>
        <input {...register('serial')} placeholder="e.g. UA55BU8000KXZN" className={inputCls} />
      </Field>

      <Field label="Description / Notes" optional>
        <textarea {...register('description')} rows={2} placeholder="Any extra details…" className={`${inputCls} resize-none`} />
      </Field>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
          Cancel
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition">
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
