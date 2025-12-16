import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export const registerSchema = z.object({
  full_name: z.string().min(2, { message: 'Full name must be at least 2 characters' }),
  email_id: z.string().email({ message: 'Please enter a valid email address' }),
  billing_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pin_code: z.string().max(10, { message: 'PIN code cannot exceed 10 characters' }).optional(),
  contact_no: z.string().max(15, { message: 'Contact number cannot exceed 15 characters' }).optional(),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});