import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { env } from '../config/env.js';

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

const CNIC_REGEX = /(\d{5})[\s\-–—]*(\d{7})[\s\-–—]*(\d)(?!\d)/;
const DATE_RE    = /\d{2}[.\-\/]\d{2}[.\-\/]\d{2,4}/;

const NON_NAME = /\b(?:republic|national|pakistan|identity|card|stay|country|of|the|gender|male|female|father|husband|wife|name|date|issue|expiry|number|valid|till|born|birth|signature|domicile|province|district|cnic|nadra|islamic|holder)\b/i;

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
function ascii(s: string) {
  return s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}
function tryDate8(s: string): string | null {
  const m = s.match(/\b(\d{2})(\d{2})(\d{4})\b/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return (+dd >= 1 && +dd <= 31 && +mm >= 1 && +mm <= 12 && +yyyy >= 2000 && +yyyy <= 2050)
    ? `${dd}.${mm}.${yyyy}` : null;
}
function extractNameWords(line: string): string | null {
  const clean = line.replace(/[|:;\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const caps  = (clean.match(/\b[A-Z]{2,}\b/g) ?? []).filter((w) => !NON_NAME.test(w));
  if (caps.length >= 2 && caps.length <= 5) return titleCase(caps.join(' '));
  const title = (clean.match(/\b[A-Z][a-z]{1,}\b/g) ?? []).filter((w) => !NON_NAME.test(w));
  if (title.length >= 2 && title.length <= 5) return title.join(' ');
  return null;
}
function capWordsAfter(line: string, kw: RegExp): string | null {
  const m = kw.exec(line.toLowerCase());
  return m ? extractNameWords(line.slice(m.index + m[0].length)) : null;
}
function isNameLine(line: string): boolean {
  if (!/^[A-Z][A-Z ]{3,50}$/.test(line)) return false;
  const words = line.trim().split(/\s+/);
  return words.length >= 2 && words.length <= 5 && words.every((w) => w.length >= 2) && !NON_NAME.test(line);
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

    if (!name && /\bname\b/.test(low) && !/father|husband/.test(low))
      name = capWordsAfter(line, /\bname\b/) ?? extractNameWords(next);

    if (!fatherName && /\b(?:father|husband)\b/.test(low))
      fatherName = capWordsAfter(line, /\b(?:father|husband)\b/) ?? extractNameWords(next);

    if (!dob && /birth|d\.?o\.?b/.test(low) && !/expir/.test(low))
      dob = line.match(DATE_RE)?.[0] ?? next.match(DATE_RE)?.[0] ?? tryDate8(line) ?? tryDate8(next) ?? null;

    if (!expiryDate && /expir/.test(low))
      expiryDate = line.match(DATE_RE)?.[0] ?? next.match(DATE_RE)?.[0] ?? tryDate8(line) ?? tryDate8(next) ?? null;

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

// ─── Path 1: Google Vision API ───────────────────────────────────────────────
// Used in production. Handles orientation, bad lighting, and blurry images
// natively. Response arrives in 1–3 seconds — no cold-start penalty.

async function extractTextViaVision(buffer: Buffer): Promise<string> {
  const apiKey = env.GOOGLE_VISION_API_KEY!;
  const body = JSON.stringify({
    requests: [{
      image:    { content: buffer.toString('base64') },
      features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
      imageContext: { languageHints: ['en'] },
    }],
  });

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
  );

  if (!res.ok) throw new Error(`Vision API ${res.status}: ${await res.text()}`);

  const json = await res.json() as {
    responses: Array<{
      fullTextAnnotation?: { text: string };
      error?: { message: string };
    }>;
  };

  const r = json.responses[0];
  if (r?.error) throw new Error(`Vision API error: ${r.error.message}`);
  return r?.fullTextAnnotation?.text ?? '';
}

// ─── Path 2: Tesseract (local dev fallback) ──────────────────────────────────
// ONE persistent worker reused for all calls — avoids 12× cold-start penalty
// that the previous parallel approach caused on Vercel.

import type { Worker as TesseractWorker } from 'tesseract.js';
let _worker: TesseractWorker | null = null;

async function getTesseractWorker(): Promise<TesseractWorker> {
  if (!_worker) {
    _worker = await createWorker('eng', 1, { logger: () => {} });
    await (_worker as any).setParameters({
      tessedit_ocr_engine_mode: '1',
      tessedit_pageseg_mode:    '11',
    });
  }
  return _worker;
}

async function preprocessStd(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: 960, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1 })
    .png()
    .toBuffer();
}

async function extractTextViaTesseract(buffer: Buffer, docType: 'cnic' | 'cheque'): Promise<string> {
  const base   = await preprocessStd(buffer);
  const worker = await getTesseractWorker();

  // Try upright first — most common case
  const r0 = await worker.recognize(base);
  if (docType === 'cnic' && CNIC_REGEX.test(r0.data.text)) return r0.data.text;
  if (r0.data.confidence >= 50) return r0.data.text;

  // Sequential rotation attempts — one worker, no memory explosion
  let best = r0.data;
  for (const deg of [180, 90, 270]) {
    const rotated = await sharp(base).rotate(deg).png().toBuffer();
    const r       = await worker.recognize(rotated);
    if (docType === 'cnic' && CNIC_REGEX.test(r.data.text)) return r.data.text;
    if (r.data.confidence > best.confidence) best = r.data;
    if (r.data.confidence >= 50) break;
  }
  return best.text;
}

// ─── Timeout guard ───────────────────────────────────────────────────────────

const OCR_TIMEOUT_MS = 45_000;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

// ─── Public entry point ──────────────────────────────────────────────────────

async function getRawText(buffer: Buffer, docType: 'cnic' | 'cheque'): Promise<string> {
  if (env.GOOGLE_VISION_API_KEY) {
    console.log('[OCR] using Google Vision');
    return withTimeout(extractTextViaVision(buffer), 10_000, '');
  }
  console.log('[OCR] using Tesseract (no GOOGLE_VISION_API_KEY set)');
  return withTimeout(extractTextViaTesseract(buffer, docType), OCR_TIMEOUT_MS, '');
}

export async function extractDocumentData(
  buffer: Buffer,
  docType: 'cnic' | 'cheque' | 'other',
): Promise<{ extracted: DocumentExtracted; _ocrRaw: string }> {
  if (docType === 'other') return { extracted: EMPTY, _ocrRaw: '' };

  try {
    const rawText = await getRawText(buffer, docType);
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
      const lines    = rawText.split('\n').map(ascii).filter(Boolean);
      const fullText = lines.join(' ').toLowerCase();

      const BANK_MAP: [string, string][] = [
        ['meezan', 'Meezan Bank'], ['hbl', 'HBL'], ['habib', 'HBL'], ['ubl', 'UBL'],
        ['mcb', 'MCB Bank'], ['allied', 'Allied Bank'], ['askari', 'Askari Bank'],
        ['faysal', 'Faysal Bank'], ['alfalah', 'Bank Alfalah'], ['summit', 'Summit Bank'],
        ['silk', 'Silk Bank'], ['islami', 'Bank Islami'], ['bop', 'Bank of Punjab'],
        ['punjab', 'Bank of Punjab'], ['sindh', 'Sindh Bank'],
        ['nbp', 'National Bank of Pakistan'], ['soneri', 'Soneri Bank'],
        ['js bank', 'JS Bank'], ['standard chartered', 'Standard Chartered'],
        ['zarai', 'Zarai Taraqiati Bank'], ['samba', 'Samba Bank'], ['nib', 'NIB Bank'],
      ];
      const bankName = BANK_MAP.find(([kw]) => fullText.includes(kw))?.[1] ?? null;

      let accountNo: string | null = null;
      for (const line of lines) {
        const m = line.match(/[Pp][Kk]\d{2}\s*[A-Za-z]{4}([\d\s]{16,})/);
        if (m) {
          const digits = m[1].replace(/\D/g, '').slice(0, 16);
          if (digits.length >= 12) { accountNo = digits; break; }
        }
      }
      if (!accountNo) { const ac = rawText.match(/\b(\d{10,18})\b/); accountNo = ac?.[1] ?? null; }

      let chequeNo: string | null = null;
      for (const line of lines) {
        const m = line.match(/cheque\s*no\.?\s*[A-Z0-9]*[-]?(\d{4,10})/i);
        if (m) { chequeNo = m[1]; break; }
      }
      if (!chequeNo) { const m = rawText.match(/\b(\d{6})\b/); chequeNo = m?.[1] ?? null; }

      console.log('[OCR cheque]:', { bankName, accountNo, chequeNo });
      return { extracted: { ...EMPTY, bankName, accountNo, chequeNo }, _ocrRaw };
    }

    return { extracted: EMPTY, _ocrRaw };
  } catch (err) {
    console.error('[OCR error]:', err);
    return { extracted: EMPTY, _ocrRaw: String(err) };
  }
}
