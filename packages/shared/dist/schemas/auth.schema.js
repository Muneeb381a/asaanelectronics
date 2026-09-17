import { z } from 'zod';
export const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export const loginSchema = z.object({
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(1, 'Password is required').max(128),
});
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});
export const verifyOtpSchema = z.object({
    otpToken: z.string().min(1).max(4096),
    code: z.string().min(4).max(8),
});
export const resendOtpSchema = z.object({
    otpToken: z.string().min(1).max(4096),
});
export const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email').max(255),
});
export const resetPasswordSchema = z.object({
    email: z.string().email('Invalid email').max(255),
    code: z.string().min(4).max(8),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});
export const refreshTokenSchema = z.object({
    token: z.string().min(1).max(4096),
});
export const updateProfileSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email('Invalid email').max(255).optional(),
});
