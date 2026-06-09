import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { useMutation } from '@tanstack/react-query';
import { X, Upload, Download, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';
import { importInstallmentRowSchema } from '@assaan/shared';
import type { ImportInstallmentRow } from '@assaan/shared';
import { installmentsApi } from '../api/installments.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import toast from 'react-hot-toast';

// CSV column → schema field mapping (must match template headers exactly)
const COLUMNS: Array<{ header: string; field: keyof ImportInstallmentRow; required: boolean }> = [
  { header: 'Customer Name',          field: 'customerName', required: true  },
  { header: 'Phone',                  field: 'phone',        required: true  },
  { header: 'CNIC',                   field: 'cnic',         required: false },
  { header: 'Area',                   field: 'area',         required: false },
  { header: 'Product Name',           field: 'productName',  required: true  },
  { header: 'Total Amount',           field: 'totalAmount',  required: true  },
  { header: 'Down Payment',           field: 'downPayment',  required: true  },
  { header: 'Monthly Amount',         field: 'monthly',      required: true  },
  { header: 'Months',                 field: 'months',       required: true  },
  { header: 'Start Date (YYYY-MM-DD)',field: 'startDate',    required: true  },
  { header: 'Remaining Balance',      field: 'remaining',    required: false },
  { header: 'Status',                 field: 'status',       required: false },
  { header: 'IMEI',                   field: 'imeiNumber',   required: false },
];

const TEMPLATE_HEADERS = COLUMNS.map((c) => c.header).join(',');
const TEMPLATE_EXAMPLE = [
  'Ahmed Ali', '03001234567', '42101-1234567-1', 'Karachi',
  'Samsung Galaxy A14', '45000', '15000', '3000', '10',
  '2024-01-15', '15000', 'ACTIVE', '',
].join(',');
const TEMPLATE_CSV = `${TEMPLATE_HEADERS}\n${TEMPLATE_EXAMPLE}\n`;

type ParsedRow = {
  rowNum: number;
  data: ImportInstallmentRow | null;
  error: string | null;
};

function parseRows(raw: Record<string, string>[]): ParsedRow[] {
  return raw.map((record, i) => {
    const rowNum = i + 2;
    const mapped: Record<string, unknown> = {};
    for (const col of COLUMNS) {
      const val = record[col.header]?.trim();
      mapped[col.field] = val === '' || val === undefined ? undefined : val;
    }
    const result = importInstallmentRowSchema.safeParse(mapped);
    if (!result.success) {
      return { rowNum, data: null, error: result.error.errors[0]?.message ?? 'Invalid row' };
    }
    return { rowNum, data: result.data, error: null };
  });
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'installments-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

interface Props { onClose: () => void; onImported: () => void; }

export default function ImportInstallmentsModal({ onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows,    setRows]    = useState<ParsedRow[]>([]);
  const [phase,   setPhase]   = useState<'upload' | 'preview' | 'done'>('upload');
  const [result,  setResult]  = useState<{ imported: number; customersCreated: number; customersLinked: number; productsCreated: number; errors: Array<{ row: number; message: string }> } | null>(null);

  const validRows  = rows.filter((r) => r.data !== null);
  const errorRows  = rows.filter((r) => r.error !== null);

  const importMutation = useMutation({
    mutationFn: () => installmentsApi.importBulk(validRows.map((r) => r.data!)),
    onSuccess: (data) => {
      setResult(data);
      setPhase('done');
      onImported();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Import failed')),
  });

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });
      if (parsed.data.length === 0) {
        toast.error('CSV is empty or has no data rows');
        return;
      }
      if (parsed.data.length > 500) {
        toast.error('Maximum 500 rows per import');
        return;
      }
      setRows(parseRows(parsed.data));
      setPhase('preview');
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Import Installments</h2>
            <p className="text-xs text-gray-400 mt-0.5">Bulk import historical data from CSV</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Upload phase ── */}
          {phase === 'upload' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">How it works</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-600 text-xs">
                  <li>Download the template and fill in your data</li>
                  <li>Upload the completed CSV — we validate every row before importing</li>
                  <li>Existing customers matched by phone; new products created automatically</li>
                </ol>
              </div>

              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm font-medium text-gray-700 hover:text-blue-700 transition"
              >
                <Download size={15} />
                Download CSV Template
              </button>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl p-10 text-center cursor-pointer transition group"
              >
                <Upload size={28} className="mx-auto text-gray-300 group-hover:text-blue-400 transition mb-3" />
                <p className="text-sm font-medium text-gray-600">Drop your CSV here, or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Max 500 rows per import</p>
                <input ref={inputRef} type="file" accept=".csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            </div>
          )}

          {/* ── Preview phase ── */}
          {phase === 'preview' && (
            <div className="space-y-3">
              {/* Summary bar */}
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 size={14} />
                  {validRows.length} valid
                </span>
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1.5 text-red-500">
                    <AlertCircle size={14} />
                    {errorRows.length} with errors (will be skipped)
                  </span>
                )}
                <button
                  onClick={() => { setRows([]); setPhase('upload'); if (inputRef.current) inputRef.current.value = ''; }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline transition"
                >
                  Choose different file
                </button>
              </div>

              {/* Error list */}
              {errorRows.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-1">
                  {errorRows.slice(0, 10).map((r) => (
                    <p key={r.rowNum} className="text-xs text-red-600">
                      <span className="font-medium">Row {r.rowNum}:</span> {r.error}
                    </p>
                  ))}
                  {errorRows.length > 10 && (
                    <p className="text-xs text-red-400">…and {errorRows.length - 10} more errors</p>
                  )}
                </div>
              )}

              {/* Preview table */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium w-10">#</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Customer</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Phone</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Product</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-medium">Total</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-medium">Monthly</th>
                        <th className="px-3 py-2 text-center text-gray-500 font-medium">Status</th>
                        <th className="px-3 py-2 text-center text-gray-500 font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((r) => (
                        <tr key={r.rowNum} className={r.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-400">{r.rowNum}</td>
                          <td className="px-3 py-2 text-gray-700 font-medium max-w-[120px] truncate">
                            {r.data?.customerName ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{r.data?.phone ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{r.data?.productName ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {r.data ? `PKR ${Number(r.data.totalAmount).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {r.data ? `PKR ${Number(r.data.monthly).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r.data?.status && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                {r.data.status}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r.error
                              ? <span title={r.error}><AlertCircle size={13} className="text-red-400 mx-auto" /></span>
                              : <CheckCircle2 size={13} className="text-emerald-400 mx-auto" />
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Done phase ── */}
          {phase === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">{result.imported} installments imported</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Import completed successfully</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'New customers', value: result.customersCreated },
                  { label: 'Linked customers', value: result.customersLinked },
                  { label: 'New products', value: result.productsCreated },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-gray-800">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {result.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs font-medium text-amber-700 mb-1">{result.errors.length} rows skipped</p>
                  {result.errors.slice(0, 5).map((e) => (
                    <p key={e.row} className="text-xs text-amber-600">Row {e.row}: {e.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          {phase === 'done' ? (
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              {phase === 'preview' && (
                <button
                  onClick={() => importMutation.mutate()}
                  disabled={validRows.length === 0 || importMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {importMutation.isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Importing…</>
                    : <><FileText size={14} /> Import {validRows.length} {validRows.length === 1 ? 'row' : 'rows'}</>
                  }
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
