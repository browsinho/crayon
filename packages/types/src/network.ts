import { z } from "zod";

export const NetworkRequestSchema = z.object({
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string()),
  body: z.string().optional(),
});
export type NetworkRequest = z.infer<typeof NetworkRequestSchema>;

export const NetworkResponseSchema = z.object({
  status: z.number().int(),
  headers: z.record(z.string()),
  body: z.string().optional(),
  contentType: z.string(),
});
export type NetworkResponse = z.infer<typeof NetworkResponseSchema>;

export const NetworkCallSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  request: NetworkRequestSchema,
  response: NetworkResponseSchema,
});
export type NetworkCall = z.infer<typeof NetworkCallSchema>;
