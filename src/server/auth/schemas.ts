import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const strongPassword = z
  .string()
  .min(8)
  .regex(/[a-zA-Z]/, "Must contain a letter")
  .regex(/[0-9]/, "Must contain a number");

export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email().trim().toLowerCase(),
  password: strongPassword,
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: strongPassword,
});
