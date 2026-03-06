import { z } from "zod";
import { FrameworkInfoSchema } from "./framework.js";

export const PageSummarySchema = z.object({
  url: z.string(),
  title: z.string(),
  pageType: z.string(), // "landing", "dashboard", "detail", "form"
  keyElements: z.array(z.string()), // ["header with logo", "sidebar navigation", "data table"]
});
export type PageSummary = z.infer<typeof PageSummarySchema>;

export const ComponentSummarySchema = z.object({
  type: z.string(), // "button", "card", "modal", "form"
  variants: z.number().int().nonnegative(), // How many variations detected
  examples: z.array(z.string()), // HTML snippets
});
export type ComponentSummary = z.infer<typeof ComponentSummarySchema>;

export const BrandStyleSchema = z.object({
  colors: z.array(z.string()), // Extracted color palette
  fonts: z.array(z.string()), // Font families used
  styleKeywords: z.array(z.string()), // "modern", "minimal", "colorful"
});
export type BrandStyle = z.infer<typeof BrandStyleSchema>;

export const InteractionSummarySchema = z.object({
  type: z.enum(["click", "scroll", "input", "navigation"]),
  description: z.string(),
  frequency: z.number().int().nonnegative(),
});
export type InteractionSummary = z.infer<typeof InteractionSummarySchema>;

export const RecordingSummarySchema = z.object({
  // High-level description
  description: z.string(), // "A task management dashboard with kanban boards"
  domain: z.string(), // "productivity" | "ecommerce" | "social" | "dashboard"

  // UI/UX insights
  pages: z.array(PageSummarySchema),
  components: z.array(ComponentSummarySchema),
  brandStyle: BrandStyleSchema,

  // Technical insights
  framework: FrameworkInfoSchema,
  interactions: z.array(InteractionSummarySchema),
});
export type RecordingSummary = z.infer<typeof RecordingSummarySchema>;
