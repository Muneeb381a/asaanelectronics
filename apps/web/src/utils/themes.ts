// Shop-wide appearance presets: color theme + font. Colors work by swapping
// the same CSS variable names apps/web/src/index.css already defines under
// `@theme` (Tailwind v4 — every `bg-blue-600`/`text-indigo-500`/etc. utility
// in the app resolves to `var(--color-blue-600)`, not a literal hex), so a
// preset only ever needs to redefine the `blue` (primary) and `indigo`
// (gradient/secondary) ramps — every page re-colors with zero component
// changes. Semantic colors (emerald=success, amber=warning, red=danger,
// orange=attention) are deliberately never touched by a theme, so their
// meaning stays consistent no matter which brand color the shop picks.

export type ColorRamp = Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950', string>;

export interface ThemePreset {
  id: string;
  name: string;
  blue: ColorRamp;
  indigo: ColorRamp;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'cobalt',
    name: 'Cobalt Blue',
    blue:   { '50': '#EEF3FF', '100': '#DCE6FF', '200': '#BBCDFF', '300': '#8FADFF', '400': '#5F86F5', '500': '#3D64E6', '600': '#2B4ED1', '700': '#223EAD', '800': '#1D338A', '900': '#1B2D6F', '950': '#111C47' },
    indigo: { '50': '#F0F1FF', '100': '#E1E4FF', '200': '#C7CCFF', '300': '#A3ABFF', '400': '#7E86F7', '500': '#5D63EA', '600': '#4A4ED4', '700': '#3D3FB1', '800': '#33368D', '900': '#2D3070', '950': '#1A1B45' },
  },
  {
    id: 'violet',
    name: 'Royal Violet',
    blue:   { '50': '#F6F3FF', '100': '#ECE5FE', '200': '#DACCFD', '300': '#C0A8FB', '400': '#A379F5', '500': '#8752EC', '600': '#7238DA', '700': '#5F2CB6', '800': '#4F2794', '900': '#422378', '950': '#29154C' },
    indigo: { '50': '#FAF2FF', '100': '#F3E1FF', '200': '#E7C4FE', '300': '#D699FC', '400': '#C067F5', '500': '#A83EE8', '600': '#9128CE', '700': '#781FA9', '800': '#631C88', '900': '#521C6F', '950': '#330F46' },
  },
  {
    id: 'teal',
    name: 'Ocean Teal',
    blue:   { '50': '#EBFBFA', '100': '#D0F5F1', '200': '#A3EAE3', '300': '#6BD8CE', '400': '#38BFB4', '500': '#199C94', '600': '#0F7F79', '700': '#0F6863', '800': '#12534F', '900': '#124541', '950': '#072826' },
    indigo: { '50': '#EAFAFF', '100': '#CFF1FE', '200': '#A0E4FD', '300': '#64D1FA', '400': '#2FB8EE', '500': '#139AD4', '600': '#0B7CB0', '700': '#0E638F', '800': '#135074', '900': '#144360', '950': '#0A2A3E' },
  },
  {
    id: 'navy',
    name: 'Deep Navy',
    blue:   { '50': '#ECF0FB', '100': '#D6DEF5', '200': '#B0BEEA', '300': '#8195DB', '400': '#5A6EC6', '500': '#3D4FAA', '600': '#2C3B8A', '700': '#232E6E', '800': '#1D2758', '900': '#1A2249', '950': '#10142E' },
    indigo: { '50': '#EFEEFB', '100': '#DBD8F4', '200': '#B9B3E9', '300': '#9187D8', '400': '#6E62C2', '500': '#5245A6', '600': '#3E3286', '700': '#33296C', '800': '#2A2358', '900': '#241E49', '950': '#16132E' },
  },
  {
    id: 'berry',
    name: 'Berry Rose',
    blue:   { '50': '#FDF1F6', '100': '#FBDDE9', '200': '#F7BAD3', '300': '#F08AB4', '400': '#E4548E', '500': '#D22D6C', '600': '#B31A55', '700': '#921548', '800': '#77143D', '900': '#631535', '950': '#390A1D' },
    indigo: { '50': '#FBF1FA', '100': '#F5DEF3', '200': '#EBBCE9', '300': '#DC8CD9', '400': '#C959C4', '500': '#B033AC', '600': '#932090', '700': '#781A76', '800': '#631A61', '900': '#521A50', '950': '#310D30' },
  },
  {
    id: 'graphite',
    name: 'Graphite Steel',
    blue:   { '50': '#F1F3F6', '100': '#DFE3EA', '200': '#C2C9D5', '300': '#9DA7BB', '400': '#78859E', '500': '#5B6883', '600': '#47526A', '700': '#3A4356', '800': '#303747', '900': '#2A303D', '950': '#1A1E27' },
    indigo: { '50': '#EEF3F8', '100': '#D6E3EE', '200': '#AFC7DE', '300': '#82A6CA', '400': '#5C86B3', '500': '#436A97', '600': '#33547B', '700': '#2B4563', '800': '#263A52', '900': '#223245', '950': '#14202E' },
  },
];

export const DEFAULT_THEME_ID = 'cobalt';

export interface FontPreset {
  id: string;
  name: string;
  family: string;
}

export const FONT_PRESETS: FontPreset[] = [
  { id: 'poppins',  name: 'Poppins',   family: "'Poppins', system-ui, sans-serif" },
  { id: 'inter',    name: 'Inter',     family: "'Inter', system-ui, sans-serif" },
  { id: 'nunito',   name: 'Nunito',    family: "'Nunito', system-ui, sans-serif" },
  { id: 'worksans', name: 'Work Sans', family: "'Work Sans', system-ui, sans-serif" },
  { id: 'notosans', name: 'Noto Sans', family: "'Noto Sans', system-ui, sans-serif" },
];

export const DEFAULT_FONT_ID = 'poppins';

const THEME_STORAGE_KEY = 'assaan_theme';
const FONT_STORAGE_KEY  = 'assaan_font';

export function applyTheme(id: string | undefined | null) {
  const preset = THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS.find((t) => t.id === DEFAULT_THEME_ID)!;
  const root = document.documentElement.style;
  (Object.keys(preset.blue) as Array<keyof ColorRamp>).forEach((step) => {
    root.setProperty(`--color-blue-${step}`, preset.blue[step]);
    root.setProperty(`--color-indigo-${step}`, preset.indigo[step]);
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', preset.blue['600']);
  try { localStorage.setItem(THEME_STORAGE_KEY, preset.id); } catch { /* private mode / blocked storage — cosmetic only */ }
}

export function applyFont(id: string | undefined | null) {
  const preset = FONT_PRESETS.find((f) => f.id === id) ?? FONT_PRESETS.find((f) => f.id === DEFAULT_FONT_ID)!;
  document.documentElement.style.setProperty('--font-sans', preset.family);
  try { localStorage.setItem(FONT_STORAGE_KEY, preset.id); } catch { /* private mode / blocked storage — cosmetic only */ }
}

// Called once at app boot, before the shop's own settings have loaded, so a
// returning user's chosen look applies immediately instead of flashing the
// default theme for a moment. DashboardLayout re-applies the authoritative
// value from the server once `shop-me` resolves.
export function initAppearance() {
  try {
    applyTheme(localStorage.getItem(THEME_STORAGE_KEY));
    applyFont(localStorage.getItem(FONT_STORAGE_KEY));
  } catch { /* ignore */ }
}
