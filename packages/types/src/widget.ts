import { z } from "zod";

export const WidgetTypeSchema = z.enum(["oauth-google", "stripe", "maps", "recaptcha"]);
export type WidgetType = z.infer<typeof WidgetTypeSchema>;

export const WidgetInfoSchema = z.object({
  type: WidgetTypeSchema,
  selector: z.string(),
  provider: z.string(),
});
export type WidgetInfo = z.infer<typeof WidgetInfoSchema>;
