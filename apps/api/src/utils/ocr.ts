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

// ─── Groq vision path ────────────────────────────────────────────────────────
// Llama 4 Scout on Groq: free tier, ~2 s response, handles dark/blurry/rotated
// images natively, and returns structured JSON — no regex parsing needed.

const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const CNIC_PROMPT = `You are an OCR specialist for Pakistani identity documents.
Look at this CNIC (Computerised National Identity Card) and extract every visible field.
Reply with ONLY a valid JSON object — no markdown, no explanation, nothing else.
Use this exact schema (set null for any field you cannot read clearly):
{
  "cnic": "XXXXX-XXXXXXX-X",
  "name": "Full Name",
  "fatherName": "Father / Husband Name",
  "dob": "DD.MM.YYYY",
  "expiryDate": "DD.MM.YYYY",
  "address": "full address text"
}`;

const CHEQUE_PROMPT = `You are an OCR specialist for bank cheques.
Extract visible information from this cheque image.
Reply with ONLY a valid JSON object — no markdown, no explanation:
{
  "bankName": "Bank Name or null",
  "accountNo": "account number digits only or null",
  "chequeNo": "cheque number or null"
}`;

interface GroqChoice { message: { content: string } }
interface GroqResponse { choices: GroqChoice[] }

async function groqVision(buffer: Buffer, prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      temperature: 0,
      max_tokens:  512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API ${res.status}: ${body}`);
  }

  const json = (await res.json()) as GroqResponse;
  return json.choices[0]?.message?.content?.trim() ?? '';
}

// Strip ```json ... ``` fences that models sometimes add despite the prompt
function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

async function extractCnicViaGroq(buffer: Buffer): Promise<DocumentExtracted> {
  const raw = await groqVision(buffer, CNIC_PROMPT);
  console.log('[Groq CNIC raw]:', raw);

  try {
    const parsed = JSON.parse(stripFences(raw)) as Partial<DocumentExtracted>;
    return {
      ...EMPTY,
      cnic:       parsed.cnic       ?? null,
      name:       parsed.name       ?? null,
      fatherName: parsed.fatherName ?? null,
      dob:        parsed.dob        ?? null,
      expiryDate: parsed.expiryDate ?? null,
      address:    parsed.address    ?? null,
    };
  } catch {
    // Model returned plain text instead of JSON — fall back to regex parsing
    console.warn('[Groq] JSON parse failed, falling back to regex on raw text');
    return extractCnicFromText(raw);
  }
}

async function extractChequeViaGroq(buffer: Buffer): Promise<DocumentExtracted> {
  const raw = await groqVision(buffer, CHEQUE_PROMPT);
  console.log('[Groq cheque raw]:', raw);

  try {
    const parsed = JSON.parse(stripFences(raw)) as { bankName?: string; accountNo?: string; chequeNo?: string };
    return { ...EMPTY, bankName: parsed.bankName ?? null, accountNo: parsed.accountNo ?? null, chequeNo: parsed.chequeNo ?? null };
  } catch {
    return extractChequeFromText(raw);
  }
}

// ─── Fallback regex parsers (used locally with Tesseract, or if Groq JSON fails) ──

const CNIC_REGEX = /(\d{5})[\s\-–—]*(\d{7})[\s\-–—]*(\d)(?!\d)/;
const DATE_RE    = /\d{2}[.\-\/]\d{2}[.\-\/]\d{2,4}/;
const NON_NAME   = /\b(?:republic|national|pakistan|identity|card|stay|country|of|the|gender|male|female|father|husband|wife|name|date|issue|expiry|number|valid|till|born|birth|signature|domicile|province|district|cnic|nadra|islamic|holder)\b/i;

function ascii(s: string) { return s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim(); }
function titleCase(s: string) { return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }
function tryDate8(s: string): string | null {
  const m = s.match(/\b(\d{2})(\d{2})(\d{4})\b/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return (+dd >= 1 && +dd <= 31 && +mm >= 1 && +mm <= 12 && +yyyy >= 2000 && +yyyy <= 2050) ? `${dd}.${mm}.${yyyy}` : null;
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

function extractCnicFromText(rawText: string): DocumentExtracted {
  const cm   = rawText.match(CNIC_REGEX);
  const cnic = cm ? `${cm[1]}-${cm[2]}-${cm[3]}` : null;

  const lines = rawText.split(/\r?\n/).map(ascii).filter(Boolean);
  let name: string | null = null, fatherName: string | null = null;
  let dob: string | null  = null, expiryDate: string | null  = null;
  let address: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], low = line.toLowerCase(), next = lines[i + 1] ?? '';
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
    const nl = lines.filter(isNameLine);
    if (!name && nl[0]) name = titleCase(nl[0]);
    if (!fatherName && nl[1]) fatherName = titleCase(nl[1]);
  }
  if (!expiryDate) {
    for (const l of lines) { const d = tryDate8(l); if (d && d !== dob) { expiryDate = d; break; } }
  }
  return { ...EMPTY, cnic, name, fatherName, dob, expiryDate, address };
}

function extractChequeFromText(rawText: string): DocumentExtracted {
  const lines    = rawText.split('\n').map(ascii).filter(Boolean);
  const fullText = lines.join(' ').toLowerCase();

  const BANK_MAP: [string, string][] = [
    ['meezan','Meezan Bank'],['hbl','HBL'],['habib','HBL'],['ubl','UBL'],['mcb','MCB Bank'],
    ['allied','Allied Bank'],['askari','Askari Bank'],['faysal','Faysal Bank'],
    ['alfalah','Bank Alfalah'],['summit','Summit Bank'],['silk','Silk Bank'],
    ['islami','Bank Islami'],['bop','Bank of Punjab'],['punjab','Bank of Punjab'],
    ['sindh','Sindh Bank'],['nbp','National Bank of Pakistan'],['soneri','Soneri Bank'],
    ['js bank','JS Bank'],['standard chartered','Standard Chartered'],
    ['zarai','Zarai Taraqiati Bank'],['samba','Samba Bank'],['nib','NIB Bank'],
  ];
  const bankName = BANK_MAP.find(([kw]) => fullText.includes(kw))?.[1] ?? null;

  let accountNo: string | null = null;
  for (const line of lines) {
    const m = line.match(/[Pp][Kk]\d{2}\s*[A-Za-z]{4}([\d\s]{16,})/);
    if (m) { const d = m[1].replace(/\D/g,'').slice(0,16); if (d.length >= 12) { accountNo = d; break; } }
  }
  if (!accountNo) { const ac = rawText.match(/\b(\d{10,18})\b/); accountNo = ac?.[1] ?? null; }

  let chequeNo: string | null = null;
  for (const line of lines) {
    const m = line.match(/cheque\s*no\.?\s*[A-Z0-9]*[-]?(\d{4,10})/i);
    if (m) { chequeNo = m[1]; break; }
  }
  if (!chequeNo) { const m = rawText.match(/\b(\d{6})\b/); chequeNo = m?.[1] ?? null; }

  return { ...EMPTY, bankName, accountNo, chequeNo };
}

// ─── Tesseract fallback (local dev, no API key) ───────────────────────────────

import type { Worker as TesseractWorker } from 'tesseract.js';
let _worker: TesseractWorker | null = null;

async function getTesseractWorker(): Promise<TesseractWorker> {
  if (!_worker) {
    _worker = await createWorker('eng', 1, { logger: () => {} });
    await (_worker as any).setParameters({ tessedit_ocr_engine_mode: '1', tessedit_pageseg_mode: '11' });
  }
  return _worker;
}

async function preprocessStd(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: 960, withoutEnlargement: true })
    .grayscale().normalize().sharpen({ sigma: 1 })
    .png().toBuffer();
}

async function extractViaTesseract(buffer: Buffer, docType: 'cnic' | 'cheque'): Promise<DocumentExtracted> {
  const base   = await preprocessStd(buffer);
  const worker = await getTesseractWorker();
  const CNIC_R = /(\d{5})[\s\-–—]*(\d{7})[\s\-–—]*(\d)(?!\d)/;

  let bestText = '';
  let bestConf = 0;

  for (const deg of [0, 180, 90, 270]) {
    const buf = deg === 0 ? base : await sharp(base).rotate(deg).png().toBuffer();
    const { data } = await worker.recognize(buf);
    if (docType === 'cnic' && CNIC_R.test(data.text)) { bestText = data.text; break; }
    if (data.confidence > bestConf) { bestConf = data.confidence; bestText = data.text; }
    if (data.confidence >= 50) break;
  }

  return docType === 'cnic' ? extractCnicFromText(bestText) : extractChequeFromText(bestText);
}

// ─── Timeout guard ────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function extractDocumentData(
  buffer: Buffer,
  docType: 'cnic' | 'cheque' | 'other',
): Promise<{ extracted: DocumentExtracted; _ocrRaw: string }> {
  if (docType === 'other') return { extracted: EMPTY, _ocrRaw: '' };

  try {
    let extracted: DocumentExtracted;

    if (env.GROQ_API_KEY) {
      console.log('[OCR] path: Groq vision');
      const fn = docType === 'cnic' ? extractCnicViaGroq : extractChequeViaGroq;
      extracted = await withTimeout(fn(buffer), 15_000, EMPTY);
    } else {
      console.log('[OCR] path: Tesseract (set GROQ_API_KEY for production)');
      extracted = await withTimeout(extractViaTesseract(buffer, docType), 45_000, EMPTY);
    }

    console.log('[OCR extracted]:', extracted);
    return { extracted, _ocrRaw: JSON.stringify(extracted) };

  } catch (err) {
    console.error('[OCR error]:', err);
    return { extracted: EMPTY, _ocrRaw: String(err) };
  }
}
