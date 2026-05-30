import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createCustomerSchema } from '@assaan/shared';
import { User, Shield, Image, ChevronRight, ChevronLeft, Check, ImageIcon, X } from 'lucide-react';
import { api } from '../../api/client.ts';
import type { Customer } from '../../api/customers.api.ts';
import LocationPicker from '../../components/LocationPicker.tsx';

interface DocumentExtracted {
  cnic: string | null; name: string | null; fatherName: string | null;
  dob: string | null; expiryDate: string | null;
  address: string | null; bankName: string | null; accountNo: string | null; chequeNo: string | null;
}

const cnicRegex = /^\d{5}-\d{7}-\d$/;

const editSchema = createCustomerSchema.partial().extend({
  name: z.string().min(2),
  phone: z.string().regex(/^03\d{9}$/, 'Enter a valid 11-digit mobile number (03XXXXXXXXX)'),
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
        {label}{optional ? <span className="text-gray-400 font-normal"> (optional)</span> : <span className="text-red-500 ml-0.5">*</span>}
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
const MAX_SIZE_MB = 15; // raw phone photos can be large — we compress client-side anyway

// Compress & resize image in-browser before upload.
// Turns a 4K/5MB phone photo into ~200-400 KB JPEG, same quality for OCR.
async function compressForUpload(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img') as HTMLImageElement;
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_DIM = 1800; // enough for Tesseract — larger wastes upload time
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
        else        { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff'; // white background — avoids transparent PNG artefacts
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        0.90,
      );
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')); };
    img.src = url;
  });
}

type UploadStage = 'compressing' | 'uploading' | 'scanning' | null;

const STAGE_LABEL: Record<Exclude<UploadStage, null>, string> = {
  compressing: 'Optimising image…',
  uploading:   'Uploading…',
  scanning:    'Reading document…',
};

function PhotoUpload({ label, folder, value, onChange, required, hasError, compact }: {
  label: string; folder: string; value: string | null;
  onChange: (url: string | null, hash?: string, extracted?: DocumentExtracted) => void;
  required?: boolean; hasError?: boolean; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<UploadStage>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const isCnic = folder.includes('cnic') || folder.includes('guarantor');

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

    try {
      // Step 1: compress client-side (fast — <1 s)
      setStage('compressing');
      const compressed = await compressForUpload(file);

      // Step 2: upload + OCR in parallel on server
      setStage(isCnic ? 'scanning' : 'uploading');
      const fd = new FormData();
      fd.append('file', compressed, 'document.jpg');
      fd.append('folder', folder);
      const res = await api.post<{ data: { url: string; hash: string; extracted: DocumentExtracted } }>(
        '/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const { url, hash, extracted } = res.data.data;
      onChange(url, hash, extracted);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFileError(msg ?? 'Upload failed — please try again');
    } finally {
      setStage(null);
    }
  }

  const uploading = stage !== null;
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
              <span className="text-xs text-blue-500 font-medium">{STAGE_LABEL[stage!]}</span>
            </>
          ) : (
            <><ImageIcon size={18} /><span className="text-xs">{showError ? 'Required' : 'Upload photo'}</span></>
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

function GuarantorStep({ n, prefix, register, errors, cnicFront, setCnicFront, cnicBack, setCnicBack, isShopOwner }: {
  n: 1 | 2;
  prefix: 'guarantor' | 'guarantor2';
  register: ReturnType<typeof useForm<FormData>>['register'];
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors'];
  cnicFront: string | null; setCnicFront: (v: string | null) => void;
  cnicBack: string | null;  setCnicBack: (v: string | null) => void;
  isShopOwner?: boolean;
}) {
  const nameKey     = prefix === 'guarantor' ? 'guarantorName'        : 'guarantor2Name';
  const phoneKey    = prefix === 'guarantor' ? 'guarantorPhone'       : 'guarantor2Phone';
  const cnicKey     = prefix === 'guarantor' ? 'guarantorCnic'        : 'guarantor2Cnic';
  const addrKey     = prefix === 'guarantor' ? 'guarantorAddress'     : 'guarantor2Address';
  const relKey      = prefix === 'guarantor' ? 'guarantorRelation'    : 'guarantor2Relation';
  const shopNameKey = prefix === 'guarantor' ? 'guarantorShopName'    : 'guarantor2ShopName';
  const shopAddrKey = prefix === 'guarantor' ? 'guarantorShopAddress' : 'guarantor2ShopAddress';

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Fill what's available</p>
      {isShopOwner && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
          This guarantor is a shop owner (Dukaan-Dar)
        </div>
      )}
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
          <input {...register(phoneKey)} placeholder="03XXXXXXXXX" maxLength={11}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 11); e.target.value = v; register(phoneKey).onChange(e); }}
            className={inp} />
        </Field>
        <Field label="CNIC" optional error={(errors as Record<string, { message?: string }>)[cnicKey]?.message}>
          <input {...register(cnicKey)} placeholder="XXXXX-XXXXXXX-X" maxLength={15} className={inp}
            onChange={(e) => { e.target.value = formatCnic(e.target.value); register(cnicKey).onChange(e); }} />
        </Field>
      </div>
      <Field label="Address" optional>
        <input {...register(addrKey)} placeholder="Full address" className={inp} />
      </Field>
      {isShopOwner && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shop Name" optional>
            <input {...register(shopNameKey as keyof FormData)} placeholder="e.g. Ahmed General Store" className={inp} />
          </Field>
          <Field label="Shop Address" optional>
            <input {...register(shopAddrKey as keyof FormData)} placeholder="Shop location" className={inp} />
          </Field>
        </div>
      )}
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
  const d = raw.replace(/\D/g, '').slice(0, 13);
  if (d.length <= 5)  return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export default function CustomerForm({ customer, onSubmit, isPending, onCancel }: Props) {
  const isEdit = !!customer;
  const [step, setStep] = useState(0);
  const [isDukaanDar, setIsDukaanDar] = useState(
    (customer as { customerType?: string } | undefined)?.customerType === 'dukaan-dar'
  );

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
      address: customer.address ?? '', area: customer.area ?? '', officeAddress: customer.officeAddress ?? '',
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
      customerType: isDukaanDar ? 'dukaan-dar' : 'regular',
    } : { customerType: 'regular' },
  });

  useEffect(() => {
    setValue('customerType', isDukaanDar ? 'dukaan-dar' : 'regular');
  }, [isDukaanDar, setValue]);

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
            {/* Customer type toggle */}
            <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
              {(['regular', 'dukaan-dar'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setIsDukaanDar(type === 'dukaan-dar')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                    (type === 'dukaan-dar') === isDukaanDar
                      ? type === 'dukaan-dar'
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  {type === 'regular' ? 'Regular Customer' : 'Dukaan-Dar (Shop Owner)'}
                </button>
              ))}
            </div>

            {/* Dukaan-dar info banner */}
            {isDukaanDar && (
              <div className="flex items-start gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-800">
                <span className="w-1.5 h-1.5 mt-0.5 rounded-full bg-orange-500 shrink-0" />
                <span>Shop owner customer — daily installment plan with 25% markup. Guarantors must also be shop owners.</span>
              </div>
            )}

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
              <input {...register('cnic')} placeholder="XXXXX-XXXXXXX-X" maxLength={15} className={inp}
                onChange={(e) => { e.target.value = formatCnic(e.target.value); register('cnic').onChange(e); }} />
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
              <input {...register('phone')} placeholder="03001234567" maxLength={11}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 11); e.target.value = v; register('phone').onChange(e); }}
                className={inp} />
            </Field>
            <Field label="Home Address" optional>
              <input {...register('address')} placeholder="House 5, Street 3, Sialkot" className={inp} />
            </Field>
            <LocationPicker
              value={customer?.area ?? ''}
              onChange={(v) => setValue('area', v, { shouldValidate: true })}
              error={errors.area?.message}
            />
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

            {/* Shop owner fields */}
            {isDukaanDar && (
              <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3 space-y-3">
                <p className="text-xs font-semibold text-orange-700">Shop / Business Details</p>
                <Field label="Shop Name" optional>
                  <input {...register('shopName' as keyof FormData)} placeholder="e.g. Ahmad General Store" className={inp} />
                </Field>
                <Field label="Shop Address" optional>
                  <input {...register('shopAddress' as keyof FormData)} placeholder="Shop location / market" className={inp} />
                </Field>
                <Field label="Business Type" optional>
                  <input {...register('businessType' as keyof FormData)} placeholder="e.g. General Store, Kiryana, Mobile Shop" className={inp} />
                </Field>
              </div>
            )}
          </>
        )}

        {/* ── Step 1: Guarantor 1 ── */}
        {step === 1 && (
          <GuarantorStep n={1} prefix="guarantor" register={register} errors={errors}
            cnicFront={gCnicFront} setCnicFront={setGCnicFront}
            cnicBack={gCnicBack}   setCnicBack={setGCnicBack}
            isShopOwner={isDukaanDar} />
        )}

        {/* ── Step 2: Guarantor 2 ── */}
        {step === 2 && (
          <GuarantorStep n={2} prefix="guarantor2" register={register} errors={errors}
            cnicFront={g2CnicFront} setCnicFront={setG2CnicFront}
            cnicBack={g2CnicBack}   setCnicBack={setG2CnicBack}
            isShopOwner={isDukaanDar} />
        )}

        {/* ── Step 3: Documents ── */}
        {step === 3 && (
          <>
            {!isEdit && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Customer photo is required. Blank cheque is optional.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <PhotoUpload label="Customer Photo" folder="assaan/customers" value={photoUrl}
                required={!isEdit} hasError={!!errors.photoUrl}
                onChange={(v) => { setPhotoUrl(v); setValue('photoUrl', v ?? undefined, { shouldValidate: true }); }} />
              <PhotoUpload label="Blank Cheque" folder="assaan/cheques" value={blankChequeUrl}
                required={false} hasError={!!errors.blankChequeUrl}
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
