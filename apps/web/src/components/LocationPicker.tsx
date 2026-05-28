import { useState, useEffect } from 'react';
import { PAKISTAN_LOCATIONS } from '../data/pakistan-locations.ts';

interface Props {
  value: string;
  onChange: (area: string) => void;
  error?: string;
}

const sel =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition bg-white';
const selErr =
  'w-full px-3 py-2 border border-red-400 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-400 transition bg-white';

export default function LocationPicker({ value, onChange, error }: Props) {
  const [province, setProvince] = useState('');
  const [city,     setCity]     = useState('');
  const [area,     setArea]     = useState('');
  const [custom,   setCustom]   = useState('');

  // Sync outward value → inward state on first render (edit mode)
  useEffect(() => {
    if (value && !area && !custom) {
      // Try to find the value in the data; if not found, treat as custom
      let found = false;
      for (const prov of PAKISTAN_LOCATIONS) {
        for (const ct of prov.cities) {
          if (ct.areas.includes(value)) {
            setProvince(prov.name);
            setCity(ct.name);
            setArea(value);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) setCustom(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const provinces = PAKISTAN_LOCATIONS;
  const cities    = provinces.find((p) => p.name === province)?.cities ?? [];
  const areas     = cities.find((c) => c.name === city)?.areas ?? [];

  const handleProvince = (v: string) => {
    setProvince(v);
    setCity('');
    setArea('');
    setCustom('');
    onChange('');
  };

  const handleCity = (v: string) => {
    setCity(v);
    setArea('');
    setCustom('');
    onChange('');
  };

  const handleArea = (v: string) => {
    setArea(v);
    setCustom('');
    if (v && v !== 'Other') onChange(v);
    else onChange('');
  };

  const handleCustom = (v: string) => {
    setCustom(v);
    onChange(v);
  };

  return (
    <div className="space-y-2">
      {/* Province */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Province <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <select value={province} onChange={(e) => handleProvince(e.target.value)} className={sel}>
          <option value="">— Select Province —</option>
          {provinces.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* City */}
      {province && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">City / Tehsil</label>
          <select value={city} onChange={(e) => handleCity(e.target.value)} className={sel}>
            <option value="">— Select City —</option>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Area */}
      {city && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Area / Mohalla</label>
          <select
            value={area}
            onChange={(e) => handleArea(e.target.value)}
            className={error ? selErr : sel}
          >
            <option value="">— Select Area —</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      )}

      {/* Custom area text input */}
      {(area === 'Other' || (!province && custom)) && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {area === 'Other' ? 'Specify Area / Mohalla' : 'Area / Mohalla'}
          </label>
          <input
            type="text"
            value={custom}
            onChange={(e) => handleCustom(e.target.value)}
            placeholder="Type area or mohalla name"
            className={error ? selErr : sel}
          />
          {error && !area && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}
