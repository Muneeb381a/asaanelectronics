import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_OTP_SECRET: z.string().min(32),
  JWT_PORTAL_SECRET: z.string().min(32),
  CNIC_HASH_PEPPER: z.string().min(16),
  CLOUDINARY_URL: z.string(),
  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().optional(),
  CORS_ORIGIN: z.string(),
  GROQ_API_KEY: z.string().optional(),
  JAZZCASH_MERCHANT_ID:   z.string().optional(),
  JAZZCASH_PASSWORD:      z.string().optional(),
  JAZZCASH_INTEGRITY_SALT: z.string().optional(),
  JAZZCASH_RETURN_URL:    z.string().optional(),
  JAZZCASH_SANDBOX:       z.coerce.boolean().default(true),
  NADRA_API_URL:          z.string().url().optional(),
  NADRA_API_KEY:          z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
});

export const env = schema.parse(process.env);
