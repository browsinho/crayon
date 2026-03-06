import { z } from "zod";

export const CookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
});
export type Cookie = z.infer<typeof CookieSchema>;

export const BrowserStateSchema = z.object({
  localStorage: z.record(z.string()),
  cookies: z.array(CookieSchema),
});
export type BrowserState = z.infer<typeof BrowserStateSchema>;

export const CheckpointSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.coerce.date(),
  databasePath: z.string(),
  browserState: BrowserStateSchema,
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;
