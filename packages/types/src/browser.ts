import { z } from "zod";

export const BrowserSessionStatusSchema = z.enum(["active", "stopped", "error"]);
export type BrowserSessionStatus = z.infer<typeof BrowserSessionStatusSchema>;

export const BrowserSessionSchema = z.object({
  id: z.string(),
  status: BrowserSessionStatusSchema,
  cdpUrl: z.string(),
  liveViewUrl: z.string().optional(),
});
export type BrowserSession = z.infer<typeof BrowserSessionSchema>;

export const ViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Viewport = z.infer<typeof ViewportSchema>;
