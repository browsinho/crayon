import { z } from "zod";

export const APIRoutePatternSchema = z.enum([
  "list",
  "get",
  "create",
  "update",
  "delete",
  "custom",
]);
export type APIRoutePattern = z.infer<typeof APIRoutePatternSchema>;

export const APIRouteExampleSchema = z.object({
  request: z.unknown().optional(),
  response: z.unknown(),
});
export type APIRouteExample = z.infer<typeof APIRouteExampleSchema>;

export const APIRouteSchema = z.object({
  method: z.string(),
  path: z.string(),
  pattern: APIRoutePatternSchema,
  requestSchema: z.record(z.unknown()).optional(),
  responseSchema: z.record(z.unknown()).optional(),
  examples: z.array(APIRouteExampleSchema),
});
export type APIRoute = z.infer<typeof APIRouteSchema>;
