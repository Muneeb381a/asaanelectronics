import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { createHash } from 'crypto';
import { authenticate } from '../../middleware/auth.js';
import { uploadToCloudinary } from '../../utils/cloudinary.js';
import { extractDocumentData } from '../../utils/ocr.js';
import { AppError } from '../../middleware/error.js';

const MIN_FILE_SIZE = 15 * 1024; // 15 KB — rejects blank/white images
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
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
  'assaan/payments':      'other',   // payment proof images
};

router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No file provided', 400);

    if (req.file.size < MIN_FILE_SIZE) {
      throw new AppError('Image is too small or blank. Please upload a clear photo.', 400);
    }

    const folder = (req.body['folder'] as string | undefined) ?? '';
    if (!ALLOWED_FOLDERS[folder]) throw new AppError('Invalid upload folder', 400);

    const hash    = createHash('sha256').update(req.file.buffer).digest('hex');
    const docType = ALLOWED_FOLDERS[folder];

    const [{ extracted, _ocrRaw }, url] = await Promise.all([
      extractDocumentData(req.file.buffer, docType),
      uploadToCloudinary(req.file.buffer, folder),
    ]);

    res.json({ success: true, data: { url, hash, extracted, _ocrRaw } });
  } catch (e) {
    next(e);
  }
});

export default router;
