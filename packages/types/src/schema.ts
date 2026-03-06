import { z } from "zod";

export const FieldTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "object",
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const FieldFormatSchema = z.enum(["email", "url", "uuid", "date"]);
export type FieldFormat = z.infer<typeof FieldFormatSchema>;

export const FieldSchemaSchema = z.object({
  name: z.string(),
  type: FieldTypeSchema,
  format: FieldFormatSchema.optional(),
  nullable: z.boolean(),
  example: z.unknown(),
});
export type FieldSchema = z.infer<typeof FieldSchemaSchema>;

export const RelationshipSchema = z.object({
  field: z.string(),
  relatedEntity: z.string(),
});
export type Relationship = z.infer<typeof RelationshipSchema>;

export const DataSchemaSchema = z.object({
  entity: z.string(),
  fields: z.array(FieldSchemaSchema),
  relationships: z.array(RelationshipSchema),
});
export type DataSchema = z.infer<typeof DataSchemaSchema>;
