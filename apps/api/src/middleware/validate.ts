import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from './error.js';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Express 5 leaves req.body undefined when there is no body; treat it as {} so optional-only schemas pass.
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(new AppError(result.error.errors[0]?.message ?? 'Validation error', 422));
    }
    req.body = result.data;
    next();
  };
}
