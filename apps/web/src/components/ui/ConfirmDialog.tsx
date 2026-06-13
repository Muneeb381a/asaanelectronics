import { createPortal } from 'react-dom';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';

type Variant = 'danger' | 'warning' | 'info';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<Variant, { icon: typeof AlertTriangle; iconCls: string; btnCls: string; iconBg: string }> = {
  danger:  { icon: AlertTriangle, iconCls: 'text-red-500',    btnCls: 'bg-red-600 hover:bg-red-700',    iconBg: 'bg-red-50'    },
  warning: { icon: AlertTriangle, iconCls: 'text-amber-500',  btnCls: 'bg-amber-500 hover:bg-amber-600', iconBg: 'bg-amber-50'  },
  info:    { icon: Info,          iconCls: 'text-blue-500',   btnCls: 'bg-blue-600 hover:bg-blue-700',  iconBg: 'bg-blue-50'   },
};

export default function ConfirmDialog({
  open, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', isPending = false,
  onConfirm, onCancel,
}: Props) {
  if (!open) return null;

  const { icon: Icon, iconCls, btnCls, iconBg } = VARIANT_STYLES[variant];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !isPending) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center mx-auto mb-4`}>
          <Icon size={22} className={iconCls} />
        </div>
        <h3 className="text-base font-semibold text-gray-900 text-center mb-1.5">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">{description}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition disabled:opacity-50">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${btnCls}`}>
            {isPending ? <><Loader2 size={14} className="animate-spin" />Processing…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
