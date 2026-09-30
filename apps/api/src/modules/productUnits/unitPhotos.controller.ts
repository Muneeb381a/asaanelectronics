import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { UnitPhotosService } from './unitPhotos.service.js';
import { success } from '../../utils/response.js';
import { AppError } from '../../middleware/error.js';
import { uploadToCloudinary } from '../../utils/cloudinary.js';

const svc = new UnitPhotosService();

export async function listPhotos(req: AuthRequest, res: Response) {
  success(res, await svc.list(req.params['unitId']!, req.user!.sellerId!));
}

export async function addPhoto(req: AuthRequest, res: Response, next: (e: unknown) => void) {
  try {
    if (!req.file) throw new AppError('No file provided', 400);
    const url = await uploadToCloudinary(req.file.buffer, 'assaan/units');
    const label = (req.body?.label as string | undefined) ?? undefined;
    const photo = await svc.add(req.params['unitId']!, req.user!.sellerId!, req.user!.userId, url, label);
    success(res, photo, 201);
  } catch (e) { next(e); }
}

export async function removePhoto(req: AuthRequest, res: Response) {
  success(res, await svc.remove(req.params['photoId']!, req.user!.sellerId!));
}
