import { z } from "zod";
import { ViewportSchema } from "./browser.js";
import { PageMetadataSchema } from "./page-metadata.js";

export const MutationSchema = z.object({
  type: z.enum(["childList", "attributes", "characterData"]),
  target: z.string(),
  addedNodes: z.array(z.string()).optional(),
  removedNodes: z.array(z.string()).optional(),
  attributeName: z.string().optional(),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
});
export type Mutation = z.infer<typeof MutationSchema>;

export const DOMSnapshotTypeSchema = z.enum(["full", "diff"]);
export type DOMSnapshotType = z.infer<typeof DOMSnapshotTypeSchema>;

export const DOMSnapshotSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  url: z.string(),
  type: DOMSnapshotTypeSchema,
  html: z.string().optional(),
  mutations: z.array(MutationSchema).optional(),
  viewport: ViewportSchema,
  metadata: PageMetadataSchema.optional(),
});
export type DOMSnapshot = z.infer<typeof DOMSnapshotSchema>;
