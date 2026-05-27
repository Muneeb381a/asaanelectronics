import { z } from 'zod';
export declare const submitVerificationSchema: z.ZodObject<{
    status: z.ZodEnum<["APPROVED", "REJECTED"]>;
    addressVerified: z.ZodBoolean;
    employerVerified: z.ZodBoolean;
    guarantor1Reachable: z.ZodBoolean;
    guarantor2Reachable: z.ZodBoolean;
    photoEvidenceUrl: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    locationAccuracy: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "APPROVED" | "REJECTED";
    addressVerified: boolean;
    employerVerified: boolean;
    guarantor1Reachable: boolean;
    guarantor2Reachable: boolean;
    latitude: number;
    longitude: number;
    locationAccuracy: number;
    photoEvidenceUrl?: string | undefined;
    notes?: string | undefined;
}, {
    status: "APPROVED" | "REJECTED";
    addressVerified: boolean;
    employerVerified: boolean;
    guarantor1Reachable: boolean;
    guarantor2Reachable: boolean;
    latitude: number;
    longitude: number;
    locationAccuracy: number;
    photoEvidenceUrl?: string | undefined;
    notes?: string | undefined;
}>;
export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
