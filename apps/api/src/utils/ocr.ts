import Tesseract from 'tesseract.js';
import sharp from 'sharp';

export interface DocumentExtracted {
  cnic: string | null;
  name: string | null;
  fatherName: string | null;
  dob: string | null;
  expiryDate: string | null;
  address: string | null;
  bankName: string | null;
  accountNo: string | null;
  chequeNo: string | null;
}

const EMPTY: DocumentExtracted = {
  cnic: null, name: null, fatherName: null, dob: null, expiryDate: null,
  address: null, bankName: null, accountNo: null, chequeNo: null,
};

// Handles: 33100-1234567-2  |  33100 1234567 2  |  3310012345672
const CNIC_REGEX = /(\d{5})[\s\-–—]*(\d{7})[\s\-–—]*(\d)(?!\d)/;

// Standard date with separators: 21.12.1997 or 21-12-97
const DATE_RE = /\d{2}[.\-\/]\d{2}[.\-\/]\d{2,4}/;

const NON_NAME = /\b(?:republic|national|pakistan|identity|card|stay|country|of|the|gender|male|female|father|husband|wife|name|date|issue|expiry|number|valid|till|born|birth|signature|domicile|province|district|cnic|nadra|islamic|holder)\b/i;

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function ascii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tryDate8(s: string): string | null {
  const m = s.match(/\b(\d{2})(\d{2})(\d{4})\b/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  if (+dd >= 1 && +dd <= 31 && +mm >= 1 && +mm <= 12 && +yyyy >= 2000 && +yyyy <= 2050) {
    return `${dd}.${mm}.${yyyy}`;
  }
  return null;
}

function extractNameWords(line: string): string | null {
  const clean = line.replace(/[|:;\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const caps = (clean.match(/\b[A-Z]{2,}\b/g) ?? []).filter((w) => !NON_NAME.test(w));
  if (caps.length >= 2 && caps.length <= 5) return titleCase(caps.join(' '));
  const title = (clean.match(/\b[A-Z][a-z]{1,}\b/g) ?? []).filter((w) => !NON_NAME.test(w));
  if (title.length >= 2 && title.length <= 5) return title.join(' ');
  return null;
}

function capWordsAfter(line: string, kw: RegExp): string | null {
  const m = kw.exec(line.toLowerCase());
  if (!m) return null;
  return extractNameWords(line.slice(m.index + m[0].length));
}

function isNameLine(line: string): boolean {
  if (!/^[A-Z][A-Z ]{3,50}$/.test(line)) return false;
  const words = line.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  if (words.some((w) => w.length < 2)) return false;
  if (NON_NAME.test(line)) return false;
  return true;
}

function parseCnic(lines: string[]) {
  let name: string | null       = null;
  let fatherName: string | null = null;
  let dob: string | null        = null;
  let expiryDate: string | null = null;
  let address: string | null    = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const low  = line.toLowerCase();
    const next = lines[i + 1] ?? '';

    if (!name && /\bname\b/.test(low) && !/father|husband/.test(low)) {
      name = capWordsAfter(line, /\bname\b/) ?? extractNameWords(next);
    }
    if (!fatherName && /\b(?:father|husband)\b/.test(low)) {
      fatherName = capWordsAfter(line, /\b(?:father|husband)\b/) ?? extractNameWords(next);
    }
    if (!dob && /birth|d\.?o\.?b/.test(low) && !/expir/.test(low)) {
      dob = line.match(DATE_RE)?.[0] ?? next.match(DATE_RE)?.[0]
         ?? tryDate8(line) ?? tryDate8(next) ?? null;
    }
    if (!expiryDate && /expir/.test(low)) {
      expiryDate = line.match(DATE_RE)?.[0] ?? next.match(DATE_RE)?.[0]
               ?? tryDate8(line) ?? tryDate8(next) ?? null;
    }
    if (!address && /address/.test(low)) {
      const after = line.replace(/.*address[:\s]*/i, '').trim();
      address = after.length >= 5 ? after : (next.length >= 5 ? next : null);
    }
  }

  if (!name || !fatherName) {
    const nameLines = lines.filter(isNameLine);
    if (!name       && nameLines[0]) name       = titleCase(nameLines[0]);
    if (!fatherName && nameLines[1]) fatherName = titleCase(nameLines[1]);
  }
  if (!expiryDate) {
    for (const line of lines) {
      const d = tryDate8(line);
      if (d && d !== dob) { expiryDate = d; break; }
    }
  }

  return { name, fatherName, dob, expiryDate, address };
}

// ─── Preprocessing strategies ───────────────────────────────────────────────
// Three strategies run in parallel so bad images (dark, blurry, faded) are
// still readable without sequential retries.

async function buildPreprocessed(raw: Buffer): Promise<{ std: Buffer; hc: Buffer; lg: Buffer }> {
  // EXIF-correct once, then derive three variants in parallel
  const base = await sharp(raw).rotate().png().toBuffer();

  const [std, hc, lg] = await Promise.all([

    // Strategy A — standard: good for clear, well-lit images
    sharp(base)
      .resize({ width: 960, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1 })
      .png().toBuffer(),

    // Strategy B — high-contrast: recovers dark/green-background CNICs
    sharp(base)
      .resize({ width: 960, withoutEnlargement: true })
      .grayscale()
      .linear(1.9, -55)   // aggressive contrast boost
      .normalize()
      .sharpen({ sigma: 1.5 })
      .png().toBuffer(),

    // Strategy C — large + denoised: recovers blurry/low-res images
    sharp(base)
      .resize({ width: 1300, withoutEnlargement: true })
      .grayscale()
      .median(1)           // light denoise before sharpening
      .normalize()
      .sharpen({ sigma: 2 })
      .png().toBuffer(),
  ]);

  return { std, hc, lg };
}

// ─── OCR runner ──────────────────────────────────────────────────────────────

const TESS_OPTIONS = {
  logger: () => {},
  tessedit_ocr_engine_mode: '1',  // LSTM-only — faster and more accurate than legacy
  tessedit_pageseg_mode: '11',    // sparse text — best for CNIC / cheque layouts
} as Parameters<typeof Tesseract.recognize>[2];

async function runOcr(buf: Buffer): Promise<{ text: string; conf: number }> {
  const { data } = await Tesseract.recognize(buf, 'eng', TESS_OPTIONS);
  return { text: data.text, conf: data.confidence };
}

// Score a candidate: CNIC number found = highest priority, else use raw confidence
function scoreResult(r: { text: string; conf: number }, docType: string): number {
  if (docType === 'cnic' && CNIC_REGEX.test(r.text)) return 200 + r.conf;
  return r.conf;
}

// Run OCR on a single preprocessed image at all 4 rotations simultaneously
async function ocrAllAngles(buf: Buffer): Promise<{ text: string; conf: number }[]> {
  return Promise.all([
    runOcr(buf),
    sharp(buf).rotate(90).png().toBuffer().then(runOcr),
    sharp(buf).rotate(180).png().toBuffer().then(runOcr),
    sharp(buf).rotate(270).png().toBuffer().then(runOcr),
  ]);
}

// Pick best result from a list of candidates
function best(
  results: { text: string; conf: number }[],
  docType: string,
): { text: string; conf: number } {
  return results.reduce((b, r) => scoreResult(r, docType) > scoreResult(b, docType) ? r : b);
}

async function ocrDocument(buffer: Buffer, docType: 'cnic' | 'cheque'): Promise<string> {
  const { std, hc, lg } = await buildPreprocessed(buffer);

  // ── Round 1: standard preprocessing, all 4 angles in parallel ──
  const round1 = await ocrAllAngles(std);
  const winner1 = best(round1, docType);

  if (docType === 'cnic' && CNIC_REGEX.test(winner1.text)) return winner1.text;
  if (winner1.conf >= 55) return winner1.text;

  // ── Round 2: high-contrast AND large preprocessing, both sets of 4 angles,
  //            run simultaneously — gives 8 more candidates in one async batch ──
  const [round2a, round2b] = await Promise.all([
    ocrAllAngles(hc),
    ocrAllAngles(lg),
  ]);

  const allCandidates = [...round1, ...round2a, ...round2b];
  return best(allCandidates, docType).text;
}

// ─── Timeout guard ───────────────────────────────────────────────────────────

const OCR_TIMEOUT_MS = 45_000; // 45 s hard cap — function max is 60 s

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function extractDocumentData(
  buffer: Buffer,
  docType: 'cnic' | 'cheque' | 'other',
): Promise<{ extracted: DocumentExtracted; _ocrRaw: string }> {
  if (docType === 'other') return { extracted: EMPTY, _ocrRaw: '' };

  try {
    const rawText = await withTimeout(ocrDocument(buffer, docType), OCR_TIMEOUT_MS, '');
    const _ocrRaw = rawText.slice(0, 800);

    if (docType === 'cnic') {
      const cm   = rawText.match(CNIC_REGEX);
      const cnic = cm ? `${cm[1]}${cm[2]}${cm[3]}` : null;

      const lines = rawText.split(/\r?\n/).map(ascii).filter(Boolean);
      console.log('[OCR lines]:', JSON.stringify(lines));
      const { name, fatherName, dob, expiryDate, address } = parseCnic(lines);
      console.log('[OCR result]:', { cnic, name, fatherName, dob, expiryDate });

      return { extracted: { ...EMPTY, cnic, name, fatherName, dob, expiryDate, address }, _ocrRaw };
    }

    if (docType === 'cheque') {
      const lines = rawText.split('\n').map(ascii).filter(Boolean);
      console.log('[OCR cheque lines]:', JSON.stringify(lines));

      const BANK_MAP: [string, string][] = [
        ['meezan',             'Meezan Bank'],
        ['hbl',                'HBL'],
        ['habib',              'HBL'],
        ['ubl',                'UBL'],
        ['mcb',                'MCB Bank'],
        ['allied',             'Allied Bank'],
        ['askari',             'Askari Bank'],
        ['faysal',             'Faysal Bank'],
        ['alfalah',            'Bank Alfalah'],
        ['summit',             'Summit Bank'],
        ['silk',               'Silk Bank'],
        ['islami',             'Bank Islami'],
        ['bop',                'Bank of Punjab'],
        ['punjab',             'Bank of Punjab'],
        ['sindh',              'Sindh Bank'],
        ['nbp',                'National Bank of Pakistan'],
        ['soneri',             'Soneri Bank'],
        ['js bank',            'JS Bank'],
        ['standard chartered', 'Standard Chartered'],
        ['zarai',              'Zarai Taraqiati Bank'],
        ['samba',              'Samba Bank'],
        ['nib',                'NIB Bank'],
      ];
      const fullText = lines.join(' ').toLowerCase();
      const bankName = BANK_MAP.find(([kw]) => fullText.includes(kw))?.[1] ?? null;

      let accountNo: string | null = null;
      for (const line of lines) {
        const m = line.match(/[Pp][Kk]\d{2}\s*[A-Za-z]{4}([\d\s]{16,})/);
        if (m) {
          const digits = m[1].replace(/\D/g, '').slice(0, 16);
          if (digits.length >= 12) { accountNo = digits; break; }
        }
      }
      if (!accountNo) {
        const ac = rawText.match(/\b(\d{10,18})\b/);
        accountNo = ac?.[1] ?? null;
      }

      let chequeNo: string | null = null;
      for (const line of lines) {
        const m = line.match(/cheque\s*no\.?\s*[A-Z0-9]*[-]?(\d{4,10})/i);
        if (m) { chequeNo = m[1]; break; }
      }
      if (!chequeNo) {
        const m = rawText.match(/\b(\d{6})\b/);
        chequeNo = m?.[1] ?? null;
      }

      console.log('[OCR cheque result]:', { bankName, accountNo, chequeNo });
      return { extracted: { ...EMPTY, bankName, accountNo, chequeNo }, _ocrRaw };
    }

    return { extracted: EMPTY, _ocrRaw };
  } catch (err) {
    console.error('[OCR error]:', err);
    return { extracted: EMPTY, _ocrRaw: String(err) };
  }
}
