import { z } from "zod";

export const AuthTypeSchema = z.enum(["form", "oauth", "token", "none"]);
export type AuthType = z.infer<typeof AuthTypeSchema>;

export const OAuthProviderSchema = z.enum(["google", "github", "facebook"]);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

export const TokenStorageSchema = z.enum(["localStorage", "cookie"]);
export type TokenStorage = z.infer<typeof TokenStorageSchema>;

export const FormAuthSchema = z.object({
  loginUrl: z.string(),
  usernameField: z.string(),
  passwordField: z.string(),
});
export type FormAuth = z.infer<typeof FormAuthSchema>;

export const OAuthInfoSchema = z.object({
  provider: OAuthProviderSchema,
  buttonSelector: z.string(),
});
export type OAuthInfo = z.infer<typeof OAuthInfoSchema>;

export const TokenAuthSchema = z.object({
  headerName: z.string(),
  storage: TokenStorageSchema,
});
export type TokenAuth = z.infer<typeof TokenAuthSchema>;

export const AuthInfoSchema = z.object({
  type: AuthTypeSchema,
  form: FormAuthSchema.optional(),
  oauth: OAuthInfoSchema.optional(),
  token: TokenAuthSchema.optional(),
});
export type AuthInfo = z.infer<typeof AuthInfoSchema>;
