import { z } from "zod";
import { DOMSnapshotSchema } from "./dom.js";
import { NetworkCallSchema } from "./network.js";
import { ScreenshotSchema } from "./screenshot.js";
import { UserEventSchema } from "./user-event.js";
import { CorrelatedEventGroupSchema } from "./event-correlation.js";
import { PageSchema } from "./page.js";

export const RecordingStatusSchema = z.enum(["recording", "completed"]);
export type RecordingStatus = z.infer<typeof RecordingStatusSchema>;

export const RecordingStatsSchema = z.object({
  domSnapshots: z.number().int().nonnegative(),
  networkCalls: z.number().int().nonnegative(),
  screenshots: z.number().int().nonnegative(),
});
export type RecordingStats = z.infer<typeof RecordingStatsSchema>;

export const RecordingStatsV2Schema = RecordingStatsSchema.extend({
  userEvents: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
});
export type RecordingStatsV2 = z.infer<typeof RecordingStatsV2Schema>;

export const RecordingMetadataSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  startUrl: z.string(),
  status: RecordingStatusSchema,
  stats: RecordingStatsSchema,
});
export type RecordingMetadata = z.infer<typeof RecordingMetadataSchema>;

export const RecordingMetadataV2Schema = z.object({
  id: z.string(),
  createdAt: z.string(),
  startUrl: z.string(),
  status: RecordingStatusSchema,
  stats: RecordingStatsV2Schema,
  version: z.literal(2),
});
export type RecordingMetadataV2 = z.infer<typeof RecordingMetadataV2Schema>;

export const RecordingSchema = z.object({
  metadata: RecordingMetadataSchema,
  domSnapshots: z.array(DOMSnapshotSchema),
  networkCalls: z.array(NetworkCallSchema),
  screenshots: z.array(ScreenshotSchema),
});
export type Recording = z.infer<typeof RecordingSchema>;

export const RecordingV2Schema = z.object({
  metadata: RecordingMetadataV2Schema,
  domSnapshots: z.array(DOMSnapshotSchema),
  networkCalls: z.array(NetworkCallSchema),
  screenshots: z.array(ScreenshotSchema),
  userEvents: z.array(UserEventSchema),
  correlatedGroups: z.array(CorrelatedEventGroupSchema),
  pages: z.array(PageSchema),
});
export type RecordingV2 = z.infer<typeof RecordingV2Schema>;
