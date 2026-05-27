import { z } from "zod";

export const RegisterEmailCredentialBodySchema = z.object({
  customerId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8).max(300),
});

export const LoginWithEmailBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(300),
});

export const AuthTokenBodySchema = z.object({
  token: z.string().trim().min(1),
});

export const AuthCredentialParamsSchema = z.object({
  credentialId: z.string().trim().min(1),
});
