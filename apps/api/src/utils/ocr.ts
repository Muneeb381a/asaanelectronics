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

// Strip non-ASCII (Urdu OCR artefacts) and collapse spaces
function ascii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Parse an 8-digit run as DDMMYYYY → "DD.MM.YYYY", null if not a valid date
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
  const after = line.slice(m.index + m[0].length);
  return extractNameWords(after);
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
  let name: string | null        = null;
  let fatherName: string | null  = null;
  let dob: string | null         = null;
  let expiryDate: string | null  = null;
  let address: string | null     = null;

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
      dob = line.match(DATE_RE)?.[0]
         ?? next.match(DATE_RE)?.[0]
         ?? tryDate8(line)
         ?? tryDate8(next)
         ?? null;
    }

    if (!expiryDate && /expir/.test(low)) {
      expiryDate = line.match(DATE_RE)?.[0]
               ?? next.match(DATE_RE)?.[0]
               ?? tryDate8(line)
               ?? tryDate8(next)
               ?? null;
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

/**
 * Preprocess image with sharp: fix EXIF orientation, upscale to 1600px wide
 * (without enlarging), convert to grayscale, auto-normalize contrast, sharpen.
 * Returns a clean PNG buffer ready for Tesseract.
 */
async function preprocess(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()                                        // auto-fix EXIF/HEIC orientation
    .resize({ width: 900, withoutEnlargement: true }) // 900px — fast enough for CNIC text
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1 })
    .png()
    .toBuffer();
}

async function runOcr(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const { data } = await Tesseract.recognize(buffer, 'eng', {
    logger: () => {},
    // LSTM engine only (faster). PSM 11 = sparse text (good for CNIC layout).
    tessedit_ocr_engine_mode: '1',
    tessedit_pageseg_mode: '11',
  } as Parameters<typeof Tesseract.recognize>[2]);
  return { text: data.text, confidence: data.confidence };
}

/**
 * OCR with automatic orientation correction.
 * 1. Fix EXIF rotation and preprocess the image.
 * 2. If Tesseract confidence is ≥ 60 (or CNIC pattern found), return immediately.
 * 3. Otherwise try 90°, 180°, 270° rotations and return the best result.
 */
async function ocrWithAutoRotate(buffer: Buffer, docType: 'cnic' | 'cheque'): Promise<string> {
  const base = await preprocess(buffer);
  const r0 = await runOcr(base);

  // Best case: CNIC number found or confidence is acceptable — done in one pass
  if (docType === 'cnic' && CNIC_REGEX.test(r0.text)) return r0.text;
  if (r0.confidence >= 50) return r0.text;

  // Only attempt rotations when confidence is very low (image may be sideways/upside-down)
  let best = r0;
  for (const deg of [180, 90, 270]) {          // 180° first — most common mis-orientation
    const rotated = await sharp(base).rotate(deg).png().toBuffer();
    const r = await runOcr(rotated);

    if (docType === 'cnic' && CNIC_REGEX.test(r.text)) return r.text;
    if (r.confidence > best.confidence) best = r;
    if (r.confidence >= 50) break;             // good enough — stop early
  }

  return best.text;
}

export async function extractDocumentData(
  buffer: Buffer,
  docType: 'cnic' | 'cheque' | 'other',
): Promise<{ extracted: DocumentExtracted; _ocrRaw: string }> {
  if (docType === 'other') return { extracted: EMPTY, _ocrRaw: '' };
  try {
    const rawText = await ocrWithAutoRotate(buffer, docType);
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
