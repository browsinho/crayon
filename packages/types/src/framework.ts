import { z } from "zod";

export const FrameworkTypeSchema = z.enum(["react", "vue", "angular", "vanilla"]);
export type FrameworkType = z.infer<typeof FrameworkTypeSchema>;

export const FrameworkInfoSchema = z.object({
  framework: FrameworkTypeSchema,
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
});
export type FrameworkInfo = z.infer<typeof FrameworkInfoSchema>;
