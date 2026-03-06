import { z } from "zod";
import { RecordingMetadataSchema } from "./recording.js";
import { SandboxSchema } from "./sandbox.js";

export const ProjectStatusSchema = z.enum([
  "draft",
  "recording",
  "recorded",
  "analyzing",
  "generating",
  "ready",
  "error",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  thumbnail: z.string().nullable(),
  status: ProjectStatusSchema,
  sourceUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  recording: RecordingMetadataSchema.nullable(),
  sandbox: SandboxSchema.nullable(),
  tags: z.array(z.string()),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectListFiltersSchema = z.object({
  status: z.array(ProjectStatusSchema).optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
});
export type ProjectListFilters = z.infer<typeof ProjectListFiltersSchema>;

export const ProjectSortFieldSchema = z.enum([
  "name",
  "createdAt",
  "updatedAt",
  "status",
]);
export type ProjectSortField = z.infer<typeof ProjectSortFieldSchema>;

export const ProjectSortOrderSchema = z.enum(["asc", "desc"]);
export type ProjectSortOrder = z.infer<typeof ProjectSortOrderSchema>;

export const ProjectSortSchema = z.object({
  field: ProjectSortFieldSchema,
  order: ProjectSortOrderSchema,
});
export type ProjectSort = z.infer<typeof ProjectSortSchema>;

export const CreateProjectDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  sourceUrl: z.string(),
  tags: z.array(z.string()).optional(),
});
export type CreateProjectData = z.infer<typeof CreateProjectDataSchema>;

export const UpdateProjectDataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  thumbnail: z.string().nullable().optional(),
  status: ProjectStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateProjectData = z.infer<typeof UpdateProjectDataSchema>;
