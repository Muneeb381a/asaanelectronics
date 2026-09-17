import { type ZodErrorMap } from 'zod';
export declare const friendlyErrorMap: ZodErrorMap;
/** Installs the friendly messages on this package's zod instance (schemas are built with it). */
export declare function applyFriendlyZodMessages(): void;
