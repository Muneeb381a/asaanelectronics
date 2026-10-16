import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

// Viewport-relative coords — used directly with position:fixed
interface TriggerRect {
  bottom: number;
  top:    number;
  left:   number;
  width:  number;
}

const MIN_DROP_W = 260;

// Free-text input with autocomplete against past product names this shop has
// already used — typing filters the list, and whatever's typed can still be
// used as-is (a genuinely new product name), same split CategoryCombobox uses.
export default function ProductNameCombobox({
  value,
  onChange,
  options,
  placeholder = 'Product name…',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<TriggerRect | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setRect({ bottom: r.bottom, top: r.top, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!inputRef.current?.contains(t) && !dropdownRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const q = value.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const exactMatch = options.some((o) => o.toLowerCase() === q);

  const select = (v: string) => { onChange(v); setOpen(false); };

  const getPortalStyle = (): React.CSSProperties => {
    if (!rect) return { position: 'fixed', left: 8, top: 0, zIndex: 9999 };
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const dropW = Math.max(rect.width, MIN_DROP_W);
    const safeLeft = Math.max(8, Math.min(rect.left, vpW - dropW - 8));
    const spaceBelow = vpH - rect.bottom;
    const dropUp = spaceBelow < 260;
    return {
      position: 'fixed',
      left: safeLeft,
      width: dropW,
      zIndex: 9999,
      ...(dropUp ? { bottom: vpH - rect.top + 4, top: 'auto' } : { top: rect.bottom + 4 }),
    };
  };

  const showDropdown = open && rect && (filtered.length > 0 || (q.length > 0 && !exactMatch));

  const dropdown = showDropdown ? createPortal(
    <div
      ref={dropdownRef}
      style={getPortalStyle()}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl shadow-black/10 overflow-hidden"
    >
      <div className="max-h-56 overflow-y-auto overscroll-contain">
        {filtered.length > 0 && (
          <div>
            <div className="px-3 py-1.5 flex items-center gap-1.5 bg-gray-50 border-b border-gray-100">
              <Search size={11} className="text-gray-400" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pehle istemal shuda naam</span>
            </div>
            {filtered.slice(0, 30).map((item) => (
              <button
                key={item}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                  item.toLowerCase() === q ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex-1 min-w-0 truncate">{item}</span>
                {item.toLowerCase() === q && <Check size={13} className="text-blue-500 shrink-0" />}
              </button>
            ))}
          </div>
        )}
        {q.length > 0 && !exactMatch && (
          <div className="px-3 py-2.5 text-xs text-gray-400 border-t border-gray-100">
            &ldquo;<strong className="text-gray-600">{value.trim()}</strong>&rdquo; naya naam hai — aise hi save ho jayega
          </div>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 pr-8 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(''); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
}
