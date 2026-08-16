import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { CATEGORY_GROUPS } from '../../utils/categories.ts';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  extraOptions?: string[];
  className?: string;
}

export default function CategoryCombobox({
  value,
  onChange,
  placeholder = 'Category chunein…',
  extraOptions = [],
  className = '',
}: Props) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const inputId  = useId();
  const wrapRef  = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const q = query.trim().toLowerCase();

  // Build visible groups — filter by query, inject custom extras at top
  const filteredGroups = CATEGORY_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !q || i.toLowerCase().includes(q)),
  })).filter((g) => g.items.length > 0);

  // Extra options (from DB) that aren't already in presets
  const presetSet = new Set(CATEGORY_GROUPS.flatMap((g) => g.items));
  const extras = extraOptions
    .filter((o) => !presetSet.has(o))
    .filter((o) => !q || o.toLowerCase().includes(q));

  // If user typed something that matches nothing, offer to use it as-is
  const noMatches = filteredGroups.length === 0 && extras.length === 0;
  const canUseCustom = q.length > 0;

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        id={inputId}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm text-left transition
          ${open ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}
          bg-white`}
      >
        <span className={value ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onClick={clear} className="p-0.5 text-gray-300 hover:text-gray-500 rounded transition">
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search box */}
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setQuery(''); }
                if (e.key === 'Enter' && canUseCustom && noMatches) select(query.trim());
              }}
              placeholder="Search category…"
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-gray-300 hover:text-gray-500 transition">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-72 overflow-y-auto overscroll-contain">

            {/* Extra DB categories at top */}
            {extras.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50">
                  Your Categories
                </div>
                {extras.map((item) => (
                  <OptionRow key={item} item={item} selected={value === item} onSelect={select} />
                ))}
              </div>
            )}

            {/* Preset groups */}
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 flex items-center gap-1.5 sticky top-0">
                  <span>{group.emoji}</span>
                  <span>{group.label}</span>
                </div>
                {group.items.map((item) => (
                  <OptionRow key={item} item={item} selected={value === item} onSelect={select} />
                ))}
              </div>
            ))}

            {/* Custom input option */}
            {canUseCustom && noMatches && (
              <button
                type="button"
                onClick={() => select(query.trim())}
                className="w-full text-left px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition flex items-center gap-2"
              >
                <span className="text-blue-400">+</span>
                <span>Add &ldquo;<strong>{query.trim()}</strong>&rdquo; as new category</span>
              </button>
            )}

            {canUseCustom && !noMatches && (
              <button
                type="button"
                onClick={() => select(query.trim())}
                className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 transition border-t border-gray-100"
              >
                + Use &ldquo;{query.trim()}&rdquo; as custom
              </button>
            )}

            {!canUseCustom && noMatches && (
              <p className="px-3 py-6 text-center text-sm text-gray-400">Koi category nahi mili</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({ item, selected, onSelect }: { item: string; selected: boolean; onSelect: (v: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition
        ${selected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <span>{item}</span>
      {selected && <Check size={13} className="text-blue-600 shrink-0" />}
    </button>
  );
}
