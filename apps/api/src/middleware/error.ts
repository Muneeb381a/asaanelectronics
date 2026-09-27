import type { Request, Response, NextFunction } from 'express';
import { isAllowedOrigin } from '../config/cors.js';

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}

// Map PostgreSQL error codes to user-friendly messages without leaking schema details
function pgErrorMessage(code: string): { status: number; message: string } | null {
  switch (code) {
    case '23505': return { status: 409, message: 'A record with these details already exists.' };
    case '23503': return { status: 409, message: 'Cannot complete this action — a related record is in use.' };
    case '23502': return { status: 400, message: 'A required field is missing.' };
    case '22001': return { status: 400, message: 'One or more values are too long.' };
    case '42501': return { status: 403, message: 'Insufficient database permissions.' };
    case '22007': return { status: 400, message: 'Invalid date or time value.' };
    case '22008': return { status: 400, message: 'Date/time field value out of range.' };
    case '22P02': return { status: 400, message: 'Invalid input value for the operation.' };
    case '42703': return { status: 500, message: 'Database column not found — a migration may be missing.' };
    case '42P01': return { status: 500, message: 'Database table not found — a migration may be missing.' };
    default:      return null;
  }
}

export function errorMiddleware(
  err: Error & { code?: string },
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Guarantee CORS headers on every error response so the browser can read the status code
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin) && !res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, data: null, error: err.message });
  }

  // Handle known PostgreSQL errors without leaking schema details
  if (err.code) {
    const pg = pgErrorMessage(err.code);
    if (pg) {
      console.error(`[DB error ${err.code}]`, err.message);
      return res.status(pg.status).json({ success: false, data: null, error: pg.message });
    }
  }

  // body-parser/raw-body throw plain errors with a `status` (413 too-large, 400 bad JSON)
  // — without this they fell through to the generic 500 below, logging a scary
  // "Internal server error" for what's actually a client mistake.
  const httpErr = err as Error & { status?: number; statusCode?: number; type?: string };
  const clientStatus = httpErr.status ?? httpErr.statusCode;
  if (clientStatus && clientStatus >= 400 && clientStatus < 500) {
    const message = httpErr.type === 'entity.too.large'
      ? 'Request body is too large.'
      : httpErr.type === 'entity.parse.failed'
        ? 'Malformed request body.'
        : 'Bad request.';
    return res.status(clientStatus).json({ success: false, data: null, error: message });
  }

  console.error('[Unhandled error]', { message: err.message, code: (err as Error & { code?: string }).code, stack: err.stack });
  res.status(500).json({ success: false, data: null, error: 'Internal server error' });
}
