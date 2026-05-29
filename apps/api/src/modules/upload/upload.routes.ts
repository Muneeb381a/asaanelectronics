import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { createHash } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { uploadToCloudinary } from '../../utils/cloudinary.js';
import { extractDocumentData, type DocumentExtracted } from '../../utils/ocr.js';
import { AppError } from '../../middleware/error.js';
import { db } from '../../db/index.js';
import { ocrCache } from '../../db/schema.js';

const MIN_FILE_SIZE = 15 * 1024;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // client compresses to ~400 KB; 8 MB gives headroom
const ALLOWED_MIME  = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new AppError('Invalid file type. Only JPG, PNG, WEBP, or HEIC allowed.', 400));
  },
});

router.use(authenticate);

const ALLOWED_FOLDERS: Record<string, 'cnic' | 'cheque' | 'other'> = {
  'assaan/cnic':          'cnic',
  'assaan/guarantors':    'cnic',
  'assaan/customers':     'other',
  'assaan/cheques':       'cheque',
  'assaan/verifications': 'other',
  'assaan/payments':      'other',
};

// ── L1: in-memory cache ──────────────────────────────────────────────────────
// Holds up to MAX_MEM entries. Survives within a Lambda container lifetime
// (typically several minutes — covers repeated uploads in the same session).
const MAX_MEM = 300;
const memCache = new Map<string, DocumentExtracted>();

function memGet(key: string): DocumentExtracted | undefined {
  return memCache.get(key);
}
function memSet(key: string, val: DocumentExtracted) {
  if (memCache.size >= MAX_MEM) {
    // Evict oldest entry (Map preserves insertion order)
    const oldest = memCache.keys().next().value;
    if (oldest) memCache.delete(oldest);
  }
  memCache.set(key, val);
}

// ── L2: DB cache lookup ──────────────────────────────────────────────────────

async function dbGet(hash: string, docType: string): Promise<DocumentExtracted | null> {
  const rows = await db
    .select({ result: ocrCache.result })
    .from(ocrCache)
    .where(and(eq(ocrCache.hash, hash), eq(ocrCache.docType, docType)))
    .limit(1);
  return rows.length ? (rows[0].result as DocumentExtracted) : null;
}

function dbSet(hash: string, docType: string, result: DocumentExtracted) {
  // Fire-and-forget — never block the response on a cache write
  void db
    .insert(ocrCache)
    .values({ hash, docType, result })
    .onConflictDoNothing()
    .catch((e) => console.error('[OCR cache write error]', e));
}

// ── Route ────────────────────────────────────────────────────────────────────

router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No file provided', 400);
    if (req.file.size < MIN_FILE_SIZE) throw new AppError('Image is too small or blank. Please upload a clear photo.', 400);

    const folder = (req.body['folder'] as string | undefined) ?? '';
    if (!ALLOWED_FOLDERS[folder]) throw new AppError('Invalid upload folder', 400);

    const hash     = createHash('sha256').update(req.file.buffer).digest('hex');
    const docType  = ALLOWED_FOLDERS[folder];
    const cacheKey = `${hash}:${docType}`;

    // Cloudinary upload always starts immediately in the background — no waiting.
    // This way cache hits cost only a DB read, not a Groq call.
    const cloudinaryPromise = uploadToCloudinary(req.file.buffer, folder);

    // ── L1 check (sync, zero latency) ──
    const memHit = memGet(cacheKey);
    if (memHit) {
      console.log('[OCR] L1 cache hit');
      const url = await cloudinaryPromise;
      return res.json({ success: true, data: { url, hash, extracted: memHit, _ocrRaw: 'mem-cached' } });
    }

    // ── L2 check + Cloudinary in parallel ──
    const [dbHit, url] = await Promise.all([
      docType !== 'other' ? dbGet(hash, docType) : Promise.resolve(null),
      cloudinaryPromise,
    ]);

    if (dbHit) {
      console.log('[OCR] L2 DB cache hit');
      memSet(cacheKey, dbHit); // promote to L1 for next call in this container
      return res.json({ success: true, data: { url, hash, extracted: dbHit, _ocrRaw: 'db-cached' } });
    }

    // ── Cache miss: call Groq ──
    console.log('[OCR] cache miss — calling Groq');
    const { extracted, _ocrRaw } = await extractDocumentData(req.file.buffer, docType);

    // Persist to both caches (L1 sync, L2 fire-and-forget)
    memSet(cacheKey, extracted);
    if (docType !== 'other') dbSet(hash, docType, extracted);

    res.json({ success: true, data: { url, hash, extracted, _ocrRaw } });
  } catch (e) {
    next(e);
  }
});

export default router;
