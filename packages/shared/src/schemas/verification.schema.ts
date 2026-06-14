import { z } from 'zod';

export const submitVerificationSchema = z.object({
  status:              z.enum(['APPROVED', 'REJECTED']),
  addressVerified:     z.boolean(),
  employerVerified:    z.boolean(),
  guarantor1Reachable: z.boolean(),
  guarantor2Reachable: z.boolean(),
  photoEvidenceUrl:    z.string().url().optional(),
  notes:               z.string().max(500).optional(),
  latitude:            z.number(),
  longitude:           z.number(),
  locationAccuracy:    z.number(),
});

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;

export const ownerVerifySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  notes:  z.string().max(500).optional(),
});

export type OwnerVerifyInput = z.infer<typeof ownerVerifySchema>;
