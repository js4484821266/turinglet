import { z } from 'zod';

export const RegisterSchema = z.object({
  displayName: z.string().optional(),
  enableRecoveryCode: z.boolean().default(false)
});

export const LoginSchema = z.object({
  qrPayload: z.string().min(10)
});

export const RecoverSchema = z.object({
  recoveryCode: z.string().min(8)
});

export const MessageSchema = z.object({
  content: z.string().min(1).max(5000)
});

export const TypingSchema = z.object({
  isTyping: z.boolean()
});
