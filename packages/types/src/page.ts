import { z } from "zod";
import { DOMSnapshotSchema } from "./dom.js";
import { UserEventSchema } from "./user-event.js";
import { CorrelatedEventGroupSchema } from "./event-correlation.js";

export const PageEntryTypeSchema = z.enum([
  "initial_load",
  "navigation",
  "spa_transition",
  "back_forward",
  "modal_open",
]);
export type PageEntryType = z.infer<typeof PageEntryTypeSchema>;

export const PageEntryTriggerSchema = z.object({
  type: PageEntryTypeSchema,
  triggerEventId: z.string().optional(),
  previousPageId: z.string().optional(),
});
export type PageEntryTrigger = z.infer<typeof PageEntryTriggerSchema>;

export const PageTypeSchema = z.enum([
  "page",
  "modal",
  "drawer",
  "popup",
]);
export type PageType = z.infer<typeof PageTypeSchema>;

export const PageSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().optional(),
  pageType: PageTypeSchema,
  startTimestamp: z.number(),
  endTimestamp: z.number().optional(),
  entryTrigger: PageEntryTriggerSchema,
  initialSnapshot: DOMSnapshotSchema,
  finalSnapshot: DOMSnapshotSchema.optional(),
  userEvents: z.array(UserEventSchema),
  correlatedGroups: z.array(CorrelatedEventGroupSchema),
  screenshotIds: z.array(z.string()),
  networkCallIds: z.array(z.string()),
});
export type Page = z.infer<typeof PageSchema>;
