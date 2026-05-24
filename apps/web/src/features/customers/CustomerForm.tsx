import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createCustomerSchema } from '@assaan/shared';
import { User, Shield, Image, ChevronRight, ChevronLeft, Check, ImageIcon, X } from 'lucide-react';
import { api } from '../../api/client.ts';
import type { Customer } from '../../api/customers.api.ts';

interface DocumentExtracted {
  cnic: string | null; name: string | null; fatherName: string | null;
  dob: string | null; expiryDate: string | null;
  address: string | null; bankName: string | null; accountNo: string | null; chequeNo: string | null;
}

const cnicRegex = /^\d{5}-\d{7}-\d$/;

const editSchema = createCustomerSchema.partial().extend({
  name: z.string().min(2),
  phone: z.string().min(10),
  cnic: z.string().regex(cnicRegex, 'Format: XXXXX-XXXXXXX-X').optional().or(z.literal('')),
  guarantorCnic: z.string().regex(cnicRegex, 'Format: XXXXX-XXXXXXX-X').optional().or(z.literal('')),
  guarantor2Cnic: z.string().regex(cnicRegex, 'Format: XXXXX-XXXXXXX-X').optional().or(z.literal('')),
  officeAddress: z.string().optional(),
  salary: z.number().positive().optional(),
});

type FormData = z.infer<typeof editSchema>;

interface Props {
  customer?: Customer;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  onCancel: () => void;
}

const STEPS = [
  { label: 'Customer', icon: User },
  { label: 'Guarantor 1', icon: Shield },
  { label: 'Guarantor 2', icon: Shield },
  { label: 'Documents', icon: Image },
];

const RELATIONS = ['Brother', 'Sister', 'Father', 'Mother', 'Wife', 'Friend', 'Colleague', 'Neighbor', 'Other'];

function Field({ label, optional, error, children }: {
  label: string; optional?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{optional && <span className="text-gray-400 font-normal"> (optional)</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition';

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_SIZE_MB = 5;

function PhotoUpload({ label, folder, value, onChange, required, hasError, compact }: {
  label: string; folder: string; value: string | null;
  onChange: (url: string | null, hash?: string, extracted?: DocumentExtracted) => void;
  required?: boolean; hasError?: boolean; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('Only JPG, PNG, WEBP, or HEIC allowed');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`File too large — max ${MAX_SIZE_MB} MB`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', folder);
      const res = await api.post<{ data: { url: string; hash: string; extracted: DocumentExtracted } }>('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url, hash, extracted } = res.data.data;
      onChange(url, hash, extracted);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFileError(msg ?? 'Upload failed');
    }
    finally { setUploading(false); }
  }

  const h = compact ? 'h-24' : 'h-28';
  const showError = hasError && !value;

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      {value ? (
        <div className={`relative w-full ${h} rounded-xl overflow-hidden border border-gray-200 group`}>
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button type="button" onClick={() => { onChange(null); setFileError(null); }}
            className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          className={`w-full ${h} border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition disabled:cursor-not-allowed ${
            uploading
              ? 'border-blue-300 bg-blue-50'
              : showError || fileError
              ? 'border-red-400 text-red-400 bg-red-50 hover:border-red-500'
              : 'border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500'
          }`}>
          {uploading ? (
            <>
              <Spinner />
              <span className="text-xs text-blue-500 font-medium">Reading document…</span>
            </>
          ) : (
            <><ImageIcon size={18} /><span className="text-xs">{showError ? 'Required' : 'Upload'}</span></>
          )}
        </button>
      )}
      {(showError || fileError) && (
        <p className="text-xs text-red-500 mt-1">{fileError ?? 'This document is required'}</p>
      )}
      <input ref={ref} type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
}

function GuarantorStep({ n, prefix, register, errors, cnicFront, setCnicFront, cnicBack, setCnicBack }: {
  n: 1 | 2;
  prefix: 'guarantor' | 'guarantor2';
  register: ReturnType<typeof useForm<FormData>>['register'];
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors'];
  cnicFront: string | null; setCnicFront: (v: string | null) => void;
  cnicBack: string | null;  setCnicBack: (v: string | null) => void;
}) {
  const nameKey  = prefix === 'guarantor' ? 'guarantorName'     : 'guarantor2Name';
  const phoneKey = prefix === 'guarantor' ? 'guarantorPhone'    : 'guarantor2Phone';
  const cnicKey  = prefix === 'guarantor' ? 'guarantorCnic'     : 'guarantor2Cnic';
  const addrKey  = prefix === 'guarantor' ? 'guarantorAddress'  : 'guarantor2Address';
  const relKey   = prefix === 'guarantor' ? 'guarantorRelation' : 'guarantor2Relation';

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Fill what's available</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Guarantor ${n} Name`} optional>
          <input {...register(nameKey)} placeholder="Full name" className={inp} />
        </Field>
        <Field label="Relation" optional>
          <select {...register(relKey)} className={inp}>
            <option value="">Select…</option>
            {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" optional>
          <input {...register(phoneKey)} placeholder="03XXXXXXXXX" className={inp} />
        </Field>
        <Field label="CNIC" optional error={(errors as Record<string, { message?: string }>)[cnicKey]?.message}>
          <input {...register(cnicKey)} placeholder="XXXXX-XXXXXXX-X" className={inp} />
        </Field>
      </div>
      <Field label="Address" optional>
        <input {...register(addrKey)} placeholder="Full address" className={inp} />
      </Field>
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">Guarantor {n} ID Card <span className="text-gray-400 font-normal">(optional)</span></p>
        <div className="grid grid-cols-2 gap-3">
          <PhotoUpload label="CNIC Front" folder="assaan/guarantors" value={cnicFront} compact onChange={(url) => setCnicFront(url ?? null)} />
          <PhotoUpload label="CNIC Back"  folder="assaan/guarantors" value={cnicBack}  compact onChange={(url) => setCnicBack(url ?? null)} />
        </div>
      </div>
    </div>
  );
}

function formatCnic(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 13) return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
  return raw;
}

export default function CustomerForm({ customer, onSubmit, isPending, onCancel }: Props) {
  const isEdit = !!customer;
  const [step, setStep] = useState(0);

  const [photoUrl,        setPhotoUrl]        = useState<string | null>(customer?.photoUrl ?? null);
  const [cnicFrontUrl,    setCnicFrontUrl]     = useState<string | null>(customer?.cnicFrontUrl ?? null);
  const [cnicBackUrl,     setCnicBackUrl]      = useState<string | null>(customer?.cnicBackUrl ?? null);
  const [blankChequeUrl,  setBlankChequeUrl]   = useState<string | null>(customer?.blankChequeUrl ?? null);
  const [gCnicFront,      setGCnicFront]       = useState<string | null>(customer?.guarantorCnicFrontUrl ?? null);
  const [gCnicBack,       setGCnicBack]        = useState<string | null>(customer?.guarantorCnicBackUrl ?? null);
  const [g2CnicFront,     setG2CnicFront]      = useState<string | null>(customer?.guarantor2CnicFrontUrl ?? null);
  const [g2CnicBack,      setG2CnicBack]       = useState<string | null>(customer?.guarantor2CnicBackUrl ?? null);
  const [cnicFrontHash,   setCnicFrontHash]    = useState<string | null>(null);
  const [cnicBackHash,    setCnicBackHash]     = useState<string | null>(null);
  const [blankChequeHash, setBlankChequeHash]  = useState<string | null>(null);
  const [autoFillHint,    setAutoFillHint]     = useState<string | null>(null);

  const schema = isEdit ? editSchema : createCustomerSchema;

  const { register, handleSubmit, trigger, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: customer ? {
      name: customer.name, phone: customer.phone,
      fatherName: customer.fatherName ?? '', cnicExpiry: customer.cnicExpiry ?? '',
      address: customer.address ?? '', officeAddress: customer.officeAddress ?? '',
      salary: customer.salary ? Number(customer.salary) : undefined,
      occupation: customer.occupation ?? '', employer: customer.employer ?? '',
      cnic: '',
      guarantorName: customer.guarantorName ?? '', guarantorPhone: customer.guarantorPhone ?? '',
      guarantorCnic: customer.guarantorCnic ?? '', guarantorAddress: customer.guarantorAddress ?? '',
      guarantorRelation: customer.guarantorRelation ?? '',
      guarantor2Name: customer.guarantor2Name ?? '', guarantor2Phone: customer.guarantor2Phone ?? '',
      guarantor2Cnic: customer.guarantor2Cnic ?? '', guarantor2Address: customer.guarantor2Address ?? '',
      guarantor2Relation: customer.guarantor2Relation ?? '',
      photoUrl: customer.photoUrl ?? undefined,
      cnicFrontUrl: customer.cnicFrontUrl ?? undefined,
      cnicBackUrl: customer.cnicBackUrl ?? undefined,
      blankChequeUrl: customer.blankChequeUrl ?? undefined,
    } : undefined,
  });

  async function next() {
    if (step === 0) {
      const fields: (keyof FormData)[] = isEdit
        ? ['name', 'cnic', 'phone']
        : ['name', 'cnic', 'phone', 'officeAddress', 'salary'];
      const ok = await trigger(fields);
      if (!ok) return;
    }
    setStep((s) => s + 1);
  }

  function handleFinalSubmit(data: FormData) {
    onSubmit({
      ...data,
      ...(gCnicFront      && { guarantorCnicFrontUrl: gCnicFront }),
      ...(gCnicBack       && { guarantorCnicBackUrl: gCnicBack }),
      ...(g2CnicFront     && { guarantor2CnicFrontUrl: g2CnicFront }),
      ...(g2CnicBack      && { guarantor2CnicBackUrl: g2CnicBack }),
      ...(cnicFrontHash   && { cnicFrontHash }),
      ...(cnicBackHash    && { cnicBackHash }),
      ...(blankChequeHash && { blankChequeHash }),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step; const active = i === step;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-1.5 shrink-0 ${active ? 'text-blue-600' : done ? 'text-green-500' : 'text-gray-300'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  active ? 'border-blue-600 bg-blue-50' : done ? 'border-green-500 bg-green-50' : 'border-gray-200'
                }`}>
                  {done ? <Check size={12} /> : <Icon size={12} />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${active ? 'text-blue-600' : done ? 'text-green-500' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-green-300' : 'bg-gray-100'}`} />}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit(handleFinalSubmit)} className="space-y-3">

        {/* ── Step 0: Customer Info ── */}
        {step === 0 && (
          <>
            {/* CNIC upload at top — auto-fills fields below */}
            {!isEdit && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700">Upload ID Card — details will auto-fill below</p>
                <div className="grid grid-cols-2 gap-3">
                  <PhotoUpload label="CNIC Front" folder="assaan/cnic" value={cnicFrontUrl}
                    hasError={!!errors.cnicFrontUrl} compact
                    onChange={(v, hash, extracted) => {
                      setCnicFrontUrl(v);
                      if (hash) setCnicFrontHash(hash);
                      setValue('cnicFrontUrl', v ?? undefined, { shouldValidate: true });
                      if (v && extracted) {
                        const filled: string[] = [];
                        if (extracted.cnic)       { setValue('cnic',       formatCnic(extracted.cnic), { shouldValidate: true }); filled.push('CNIC'); }
                        if (extracted.name)       { setValue('name',       extracted.name,             { shouldValidate: true }); filled.push('Name'); }
                        if (extracted.fatherName) { setValue('fatherName', extracted.fatherName,       { shouldValidate: true }); filled.push('Father Name'); }
                        if (extracted.expiryDate) { setValue('cnicExpiry', extracted.expiryDate,       { shouldValidate: true }); filled.push('Expiry'); }
                        if (filled.length) setAutoFillHint(`Auto-filled: ${filled.join(', ')} — please verify`);
                      } else if (!v) { setAutoFillHint(null); }
                    }} />
                  <PhotoUpload label="CNIC Back" folder="assaan/cnic" value={cnicBackUrl}
                    hasError={!!errors.cnicBackUrl} compact
                    onChange={(v, hash, extracted) => {
                      setCnicBackUrl(v);
                      if (hash) setCnicBackHash(hash);
                      setValue('cnicBackUrl', v ?? undefined, { shouldValidate: true });
                      if (v && extracted?.address) {
                        setValue('address', extracted.address, { shouldValidate: true });
                        setAutoFillHint((prev) => prev ? `${prev}, Address` : 'Auto-filled from ID card: Address — please verify');
                      }
                    }} />
                </div>
                {autoFillHint && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <Check size={11} className="shrink-0" /> {autoFillHint}
                  </p>
                )}
              </div>
            )}

            <Field label="Full Name" error={errors.name?.message}>
              <input {...register('name')} placeholder="Muhammad Ali" className={inp} />
            </Field>
            <Field label={isEdit ? 'CNIC (leave blank to keep)' : 'CNIC'} error={errors.cnic?.message} optional={isEdit}>
              <input {...register('cnic')} placeholder="XXXXX-XXXXXXX-X" className={inp} />
              {isEdit && <p className="text-xs text-gray-400 mt-1">Current: {customer.cnicMasked}</p>}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Father Name" optional>
                <input {...register('fatherName')} placeholder="Father's full name" className={inp} />
              </Field>
              <Field label="CNIC Expiry Date" optional>
                <input {...register('cnicExpiry')} placeholder="e.g. 15-06-2030" className={inp} />
              </Field>
            </div>
            <Field label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} placeholder="03001234567" className={inp} />
            </Field>
            <Field label="Home Address" optional>
              <input {...register('address')} placeholder="House 5, Street 3, Sialkot" className={inp} />
            </Field>
            <Field label="Office / Work Address" error={errors.officeAddress?.message}>
              <input {...register('officeAddress')} placeholder="Office building, area, city" className={inp} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Occupation / Job" optional>
                <input {...register('occupation')} placeholder="e.g. Teacher" className={inp} />
              </Field>
              <Field label="Employer / Company" optional>
                <input {...register('employer')} placeholder="e.g. Govt School" className={inp} />
              </Field>
            </div>
            <Field label="Monthly Salary (PKR)" error={errors.salary?.message}>
              <input {...register('salary', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
                type="number" min="1" placeholder="e.g. 35000" className={inp} />
            </Field>
          </>
        )}

        {/* ── Step 1: Guarantor 1 ── */}
        {step === 1 && (
          <GuarantorStep n={1} prefix="guarantor" register={register} errors={errors}
            cnicFront={gCnicFront} setCnicFront={setGCnicFront}
            cnicBack={gCnicBack}   setCnicBack={setGCnicBack} />
        )}

        {/* ── Step 2: Guarantor 2 ── */}
        {step === 2 && (
          <GuarantorStep n={2} prefix="guarantor2" register={register} errors={errors}
            cnicFront={g2CnicFront} setCnicFront={setG2CnicFront}
            cnicBack={g2CnicBack}   setCnicBack={setG2CnicBack} />
        )}

        {/* ── Step 3: Documents ── */}
        {step === 3 && (
          <>
            {!isEdit && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Customer photo and blank cheque are required.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <PhotoUpload label="Customer Photo" folder="assaan/customers" value={photoUrl}
                required={!isEdit} hasError={!!errors.photoUrl}
                onChange={(v) => { setPhotoUrl(v); setValue('photoUrl', v ?? undefined, { shouldValidate: true }); }} />
              <PhotoUpload label="Blank Cheque" folder="assaan/cheques" value={blankChequeUrl}
                required={!isEdit} hasError={!!errors.blankChequeUrl}
                onChange={(v, hash, extracted) => {
                  setBlankChequeUrl(v);
                  if (hash) setBlankChequeHash(hash);
                  setValue('blankChequeUrl', v ?? undefined, { shouldValidate: true });
                  if (v && extracted) {
                    if (extracted.bankName)  setValue('chequeBank',      extracted.bankName);
                    if (extracted.accountNo) setValue('chequeAccountNo', extracted.accountNo);
                    if (extracted.chequeNo)  setValue('chequeNo',        extracted.chequeNo);
                  }
                }} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">Blank Cheque Details <span className="text-gray-400 font-normal">(auto-filled from cheque scan)</span></p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Bank Name" optional>
                  <input {...register('chequeBank')} placeholder="e.g. HBL" className={inp} />
                </Field>
                <Field label="Account No." optional>
                  <input {...register('chequeAccountNo')} placeholder="e.g. 01234567890" className={inp} />
                </Field>
                <Field label="Cheque No." optional>
                  <input {...register('chequeNo')} placeholder="e.g. 001234" className={inp} />
                </Field>
              </div>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
            <ChevronLeft size={14} />{step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-700 transition">
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button type="submit" disabled={isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl py-2 text-sm font-medium transition">
              {isPending ? 'Saving…' : 'Save Customer'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
