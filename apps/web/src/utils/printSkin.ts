import type { PrintPalette } from './printTheme.ts';

// Printed-document STYLE (card vs. line-based, rounded vs. sharp, dense vs.
// airy) — a different axis from printTheme.ts's shop-brand COLOR. Every one of
// the 7 print functions calls both getPrintPalette() (color) and
// getDocumentSkin() (style), then splices skinVars() into its own <style>
// block so a literal only has to become `var(--token)` once to stay in sync
// with this file forever — adding a 4th style later costs zero touches to the
// print files themselves.
export type DocumentStyleId = 'classic' | 'modern' | 'minimal';

export interface DocumentSkin {
  id: DocumentStyleId;
  fontHeading: string;
  fontBody: string;
  googleFontLink: string | null;
  // 'gradient-bar' = today's full-bleed navy gradient (negative-margin bleed to the card edge).
  // 'card-banner'  = an inset, independently-rounded/shadowed header "card" — the one skin
  //                  dimension that needs a structural wrapper, not just a CSS var (see bill.ts).
  // 'rule-line'    = plain white header, bold text, one bottom border — openLegalNotice's look,
  //                  generalized.
  headerStyle: 'gradient-bar' | 'card-banner' | 'rule-line';
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  shadow: string;
  cardBorder: string;
  // 'fill'        = palette colors fill backgrounds (Classic, Modern).
  // 'accent-only' = palette only tints small text/rules; backgrounds stay white (Minimal).
  colorUsage: 'fill' | 'accent-only';
  pillBg: string;
  pillFg: string;
  pillRadius: number;
  pillBorder: string;
  progressFill: string;
  tableHeaderStyle: 'solid-dark' | 'bold-bottom-border' | 'minimal-row';
  qrFrame: string;
  avatarRadius: number;
  decorative: boolean;
  spaceXs: number;
  spaceSm: number;
  spaceMd: number;
  spaceLg: number;
  bodyBg: string;
}

const SKINS: Record<DocumentStyleId, DocumentSkin> = {
  classic: {
    id: 'classic',
    fontHeading: "'Segoe UI', Arial, sans-serif",
    fontBody: "'Segoe UI', Arial, sans-serif",
    googleFontLink: null,
    headerStyle: 'gradient-bar',
    radiusSm: 4, radiusMd: 6, radiusLg: 8,
    shadow: '0 4px 24px rgba(15,23,42,.12)',
    cardBorder: '1px solid #e2e8f0',
    colorUsage: 'fill',
    pillBg: '#d1fae5', pillFg: '#065f46', pillRadius: 20, pillBorder: 'none',
    progressFill: 'linear-gradient(90deg,#10b981,#059669)',
    tableHeaderStyle: 'solid-dark',
    qrFrame: 'border:2px solid rgba(255,255,255,.2);border-radius:6px;padding:2px;background:#fff',
    avatarRadius: 50,
    decorative: true,
    spaceXs: 4, spaceSm: 6, spaceMd: 10, spaceLg: 16,
    bodyBg: '#f1f5f9',
  },
  modern: {
    id: 'modern',
    fontHeading: "'Poppins', 'Segoe UI', sans-serif",
    fontBody: "'Inter', 'Segoe UI', sans-serif",
    googleFontLink: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap',
    headerStyle: 'card-banner',
    radiusSm: 10, radiusMd: 16, radiusLg: 24,
    shadow: '0 8px 30px rgba(15,23,42,.10)',
    cardBorder: 'none',
    colorUsage: 'fill',
    pillBg: '', pillFg: '#fff', pillRadius: 20, pillBorder: 'none', // pillBg resolved from palette at call time (see skinVars/pillStyle helpers)
    progressFill: '', // resolved from palette (blue400 -> indigo500) at call time
    tableHeaderStyle: 'bold-bottom-border',
    qrFrame: 'border-radius:12px;box-shadow:0 2px 8px rgba(15,23,42,.08);padding:6px;background:#fff',
    avatarRadius: 50,
    decorative: true,
    spaceXs: 6, spaceSm: 10, spaceMd: 16, spaceLg: 24,
    bodyBg: '', // resolved from palette.skyPale at call time
  },
  minimal: {
    id: 'minimal',
    fontHeading: "'Inter', Arial, sans-serif",
    fontBody: "'Inter', Arial, sans-serif",
    googleFontLink: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    headerStyle: 'rule-line',
    radiusSm: 0, radiusMd: 0, radiusLg: 0,
    shadow: 'none',
    cardBorder: 'none',
    colorUsage: 'accent-only',
    pillBg: 'transparent', pillFg: 'currentColor', pillRadius: 0, pillBorder: '1px solid currentColor',
    progressFill: '#111827',
    tableHeaderStyle: 'minimal-row',
    qrFrame: 'border:1px solid #111827',
    avatarRadius: 0,
    decorative: false,
    spaceXs: 3, spaceSm: 5, spaceMd: 8, spaceLg: 12,
    bodyBg: '#ffffff',
  },
};

export function getDocumentSkin(styleId: string | undefined | null): DocumentSkin {
  return SKINS[(styleId as DocumentStyleId) ?? 'classic'] ?? SKINS.classic;
}

// Emits a :root{} block of CSS custom properties — splice this string straight
// into each document's existing <style> block, then reference var(--token)
// wherever a literal should change per-skin. Palette-dependent Modern values
// (left blank above) are resolved here, where the palette is in hand.
export function skinVars(skin: DocumentSkin, palette: PrintPalette): string {
  const pillBg      = skin.id === 'modern' ? palette.blue500 : skin.pillBg;
  const progressFill = skin.id === 'modern'
    ? `linear-gradient(90deg,${palette.blue400},${palette.indigo500})`
    : skin.progressFill;
  const bodyBg = skin.id === 'modern' ? palette.skyPale : skin.bodyBg;

  return `:root{
    --font-heading: ${skin.fontHeading};
    --font-body: ${skin.fontBody};
    --radius-sm: ${skin.radiusSm}px;
    --radius-md: ${skin.radiusMd}px;
    --radius-lg: ${skin.radiusLg}px;
    --shadow: ${skin.shadow};
    --card-border: ${skin.cardBorder};
    --pill-bg: ${pillBg};
    --pill-fg: ${skin.pillFg};
    --pill-radius: ${skin.pillRadius}px;
    --pill-border: ${skin.pillBorder};
    --progress-fill: ${progressFill};
    --qr-frame: ${skin.qrFrame};
    --avatar-radius: ${skin.avatarRadius}%;
    --sp-xs: ${skin.spaceXs}px;
    --sp-sm: ${skin.spaceSm}px;
    --sp-md: ${skin.spaceMd}px;
    --sp-lg: ${skin.spaceLg}px;
    --body-bg: ${bodyBg};
  }`;
}

export const DOCUMENT_STYLE_META: { id: DocumentStyleId; name: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic', blurb: 'Formal, navy header — the current look' },
  { id: 'modern',  name: 'Modern',  blurb: 'Bold cards, rounded, colorful' },
  { id: 'minimal', name: 'Minimal', blurb: 'Low-ink, compact, line-based' },
];

export const DEFAULT_DOCUMENT_STYLE_ID: DocumentStyleId = 'classic';

// Shared header-color resolution for the 'gradient-bar' / 'card-banner' / 'rule-line'
// skin dimension — every document keeps its own existing box-model (bleed margin or
// not), only the header's fill/text-color tokens change per skin.
export function headerColors(skin: DocumentSkin, palette: PrintPalette) {
  const isRule = skin.headerStyle === 'rule-line';
  return {
    isRule,
    hdrBg: isRule ? '#fff' : skin.headerStyle === 'card-banner' ? palette.blue600 : `linear-gradient(135deg,${palette.navy900},${palette.navy800})`,
    hdrFg: isRule ? '#111827' : '#fff',
    hdrFgMuted: isRule ? '#6b7280' : (skin.id === 'modern' ? 'rgba(255,255,255,.75)' : palette.blue300),
    hdrRadius: isRule ? '0' : `var(--radius-sm) var(--radius-sm) 0 0`,
    hdrBorder: isRule ? 'border-bottom:2px solid #111827;' : '',
  };
}

// The highlighted "amount" box and a "status" box both fill their background
// with color in Classic/Modern but go border-only in Minimal (colorUsage:'accent-only').
export function amountBoxColors(skin: DocumentSkin, palette: PrintPalette) {
  const fill = skin.colorUsage === 'fill';
  return {
    hlBg: fill ? palette.blue600 : 'transparent',
    hlBorderColor: fill ? palette.blue600 : '#0f172a',
    hlFg: fill ? '#fff' : '#0f172a',
    hlMuted: fill ? 'rgba(255,255,255,.65)' : '#64748b',
    gnBg: fill ? '#d1fae5' : 'transparent',
    gnBorderColor: fill ? '#6ee7b7' : '#065f46',
  };
}
