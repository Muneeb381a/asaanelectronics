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

router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No file provided', 400);

    if (req.file.size < MIN_FILE_SIZE) {
      throw new AppError('Image is too small or blank. Please upload a clear photo.', 400);
    }

    const folder = (req.body['folder'] as string | undefined) ?? 'assaan';
    const hash   = createHash('sha256').update(req.file.buffer).digest('hex');

    const docType = folder.includes('cnic') || folder.includes('guarantor') ? 'cnic'
      : folder.includes('cheque') ? 'cheque'
      : 'other';

    const { extracted, _ocrRaw } = await extractDocumentData(req.file.buffer, docType as 'cnic' | 'cheque' | 'other');

    const url = await uploadToCloudinary(req.file.buffer, folder);
    res.json({ success: true, data: { url, hash, extracted, _ocrRaw } });
  } catch (e) {
    next(e);
  }
});

export default router;
