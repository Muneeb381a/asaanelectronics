import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { CATEGORY_GROUPS } from '../../utils/categories.ts';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  extraOptions?: string[];
  className?: string;
}

interface Rect { top: number; left: number; width: number; }

export default function CategoryCombobox({
  value,
  onChange,
  placeholder = 'Category chunein…',
  extraOptions = [],
  className = '',
}: Props) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const [rect,  setRect]  = useState<Rect | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);

  // Measure trigger position whenever open changes or window moves
  const measure = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setRect({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width });
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40);
  }, [open]);

  const q = query.trim().toLowerCase();

  const filteredGroups = CATEGORY_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !q || i.toLowerCase().includes(q)),
  })).filter((g) => g.items.length > 0);

  const presetSet = new Set(CATEGORY_GROUPS.flatMap((g) => g.items));
  const extras = extraOptions
    .filter((o) => !presetSet.has(o))
    .filter((o) => !q || o.toLowerCase().includes(q));

  const noMatches    = filteredGroups.length === 0 && extras.length === 0;
  const canUseCustom = q.length > 0;

  const select = (v: string) => { onChange(v); setOpen(false); setQuery(''); };
  const clear  = (e: React.MouseEvent) => { e.stopPropagation(); onChange(''); };

  // Viewport height to flip dropdown upward if too close to bottom
  const vpHeight  = typeof window !== 'undefined' ? window.innerHeight : 800;
  const spaceBelow = rect ? vpHeight - (rect.top - window.scrollY) : 999;
  const dropUp    = spaceBelow < 300;

  const dropdown = open && rect ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        left:     rect.left,
        width:    rect.width,
        ...(dropUp
          ? { bottom: vpHeight - (rect.top - window.scrollY) + 4, top: 'auto' }
          : { top:    rect.top  - window.scrollY + 4 }),
        zIndex: 9999,
      }}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl shadow-black/10 overflow-hidden"
    >
      {/* Search */}
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-white sticky top-0">
        <Search size={13} className="text-gray-400 shrink-0"/>
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape')                         { setOpen(false); setQuery(''); }
            if (e.key === 'Enter' && canUseCustom && noMatches) select(query.trim());
          }}
          placeholder="Category search karo…"
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="text-gray-300 hover:text-gray-500 transition p-0.5">
            <X size={12}/>
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-64 overflow-y-auto overscroll-contain">
        {/* DB-only extras */}
        {extras.length > 0 && (
          <div>
            <GroupHeader emoji="⭐" label="Aapki Categories"/>
            {extras.map((item) => <OptionRow key={item} item={item} selected={value === item} onSelect={select}/>)}
          </div>
        )}

        {filteredGroups.map((g) => (
          <div key={g.label}>
            <GroupHeader emoji={g.emoji} label={g.label}/>
            {g.items.map((item) => <OptionRow key={item} item={item} selected={value === item} onSelect={select}/>)}
          </div>
        ))}

        {canUseCustom && (
          <button
            type="button"
            onClick={() => select(query.trim())}
            className="w-full text-left px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition border-t border-gray-100 flex items-center gap-2"
          >
            <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[11px] font-black shrink-0">+</span>
            <span>&ldquo;<strong>{query.trim()}</strong>&rdquo; add karein</span>
          </button>
        )}

        {!canUseCustom && noMatches && (
          <p className="px-3 py-8 text-center text-sm text-gray-400">Koi category nahi mili</p>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm text-left transition bg-white
          ${open ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <span className={`truncate ${value ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={clear}
              className="p-0.5 text-gray-300 hover:text-red-400 rounded transition"
            >
              <X size={12}/>
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}/>
        </div>
      </button>

      {dropdown}
    </div>
  );
}

function GroupHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="px-3 py-1.5 flex items-center gap-1.5 bg-gray-50 border-b border-gray-100 sticky top-[45px]">
      <span className="text-sm leading-none">{emoji}</span>
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function OptionRow({ item, selected, onSelect }: { item: string; selected: boolean; onSelect: (v: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition
        ${selected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-slate-50'}`}
    >
      <span>{item}</span>
      {selected && <Check size={13} className="text-blue-500 shrink-0"/>}
    </button>
  );
}
