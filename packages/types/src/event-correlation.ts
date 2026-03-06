import { z } from "zod";
import { MutationSchema } from "./dom.js";
import { UserEventSchema } from "./user-event.js";

export const UIStateChangeTypeSchema = z.enum([
  "page_transition",
  "modal_open",
  "modal_close",
  "dropdown_open",
  "dropdown_close",
  "accordion_toggle",
  "tab_switch",
  "content_load",
  "form_validation",
  "notification",
  "minor_update",
]);
export type UIStateChangeType = z.infer<typeof UIStateChangeTypeSchema>;

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const AffectedAreaSchema = z.object({
  isFullPage: z.boolean(),
  isOverlay: z.boolean(),
  isLocalized: z.boolean(),
  boundingBox: BoundingBoxSchema.optional(),
});
export type AffectedArea = z.infer<typeof AffectedAreaSchema>;

export const CorrelationMetricsSchema = z.object({
  domNodesAdded: z.number(),
  domNodesRemoved: z.number(),
  domAttributesChanged: z.number(),
  contentChangeRatio: z.number().min(0).max(1),
  hasUrlChange: z.boolean(),
  hasHistoryChange: z.boolean(),
  affectedArea: AffectedAreaSchema,
});
export type CorrelationMetrics = z.infer<typeof CorrelationMetricsSchema>;

export const CorrelatedEventGroupSchema = z.object({
  id: z.string(),
  triggerEvent: UserEventSchema,
  timestamp: z.number(),
  domMutations: z.array(MutationSchema),
  networkCallIds: z.array(z.string()),
  uiStateChange: UIStateChangeTypeSchema,
  confidence: z.number().min(0).max(1),
  metrics: CorrelationMetricsSchema,
});
export type CorrelatedEventGroup = z.infer<typeof CorrelatedEventGroupSchema>;
