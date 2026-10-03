import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must contain at least 8 characters.').max(128),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8, 'Enter your current password.'),
  newPassword: z.string().min(12, 'Use at least 12 characters.').max(128),
  confirmPassword: z.string(),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ['confirmPassword'], message: 'Passwords do not match.',
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ['newPassword'], message: 'Choose a different password.',
});

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
