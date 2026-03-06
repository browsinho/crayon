import { z } from "zod";

export const ScreenshotSchema = z.object({
  id: z.string(),
  domSnapshotId: z.string(),
  timestamp: z.number(),
  path: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Screenshot = z.infer<typeof ScreenshotSchema>;
