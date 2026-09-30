import { THEME_PRESETS, DEFAULT_THEME_ID } from './themes.ts';

// Print templates (bill.ts, receipt.ts, CustomerAgreementPrint.tsx,
// CustomerStatementPrint.tsx) build raw HTML strings with inline hex colors —
// they never touch the app's CSS variables, so a shop's chosen Appearance
// theme wouldn't otherwise show up on anything a customer actually holds in
// their hand. This derives the same handful of "brand" shades those
// templates already hardcode (a dark header gradient + a handful of accent
// values) from the shop's THEME_PRESETS ramp, so receipts/bills/agreements
// match the in-app color instead of a fixed, unrelated blue. Status colors
// (paid/overdue/pending pills) are semantic and never come from here.
export interface PrintPalette {
  navy900: string;
  navy800: string;
  blue700: string;
  blue600: string;
  blue500: string;
  blue400: string;
  blue300: string;
  indigo500: string;
  skyPale: string;
  skyBorder: string;
  skyText: string;
}

export function getPrintPalette(themeId: string | undefined | null): PrintPalette {
  const t = THEME_PRESETS.find((p) => p.id === themeId) ?? THEME_PRESETS.find((p) => p.id === DEFAULT_THEME_ID)!;
  return {
    navy900:   t.blue['950'],
    navy800:   t.blue['900'],
    blue700:   t.blue['700'],
    blue600:   t.blue['600'],
    blue500:   t.blue['500'],
    blue400:   t.blue['400'],
    blue300:   t.blue['300'],
    indigo500: t.indigo['500'],
    skyPale:   t.blue['50'],
    skyBorder: t.blue['200'],
    skyText:   t.blue['700'],
  };
}
