/**
 * Schema Inferrer - Infers data schemas from API response examples
 *
 * Analyzes API routes to extract:
 * - Field names and types from JSON responses
 * - Formats (email, url, date, uuid)
 * - Relationships (foreign keys)
 * - Arrays and nested objects
 */

import type {
  APIRoute,
  DataSchema,
  FieldFormat,
  FieldSchema,
  FieldType,
  Relationship,
} from "@crayon/types";

// Format detection patterns
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const URL_REGEX = /^https?:\/\//;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;

// Foreign key patterns
const FOREIGN_KEY_SUFFIX_REGEX = /^(.+?)(_id|Id)$/;

const detectFormat = (value: string): FieldFormat | undefined => {
  if (EMAIL_REGEX.test(value)) return "email";
  if (URL_REGEX.test(value)) return "url";
  if (UUID_REGEX.test(value)) return "uuid";
  if (ISO_DATE_REGEX.test(value)) return "date";
  return undefined;
};

const inferType = (value: unknown): FieldType => {
  if (value === null) return "string"; // treat null as nullable string
  if (typeof value === "string") {
    // Check if it's a date string
    if (ISO_DATE_REGEX.test(value)) return "date";
    return "string";
  }
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "string";
};

const isNullable = (values: unknown[]): boolean => {
  return values.some((v) => v === null || v === undefined);
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/**
 * Extract entity name from API route path
 * e.g., "/api/users/:userId" -> "User"
 *       "/api/v1/posts/:postId/comments" -> "Comment"
 */
const extractEntityName = (path: string): string => {
  const segments = path.split("/").filter((s) => s && !s.startsWith(":"));
  // Skip common prefixes like 'api', 'v1', 'v2', etc.
  const filtered = segments.filter(
    (s) => !["api", "v1", "v2", "v3"].includes(s.toLowerCase())
  );
  const lastSegment = filtered[filtered.length - 1] || segments[segments.length - 1];
  if (!lastSegment) return "Entity";

  // Convert to singular PascalCase
  let singular = lastSegment;
  if (singular.endsWith("ies")) {
    singular = singular.slice(0, -3) + "y";
  } else if (singular.endsWith("es") && singular.length > 3) {
    singular = singular.slice(0, -2);
  } else if (singular.endsWith("s") && singular.length > 1) {
    singular = singular.slice(0, -1);
  }

  return singular.charAt(0).toUpperCase() + singular.slice(1);
};

/**
 * Detect relationships (foreign keys) from field names
 */
const detectRelationship = (fieldName: string): Relationship | undefined => {
  const match = fieldName.match(FOREIGN_KEY_SUFFIX_REGEX);
  if (match) {
    const entityName = match[1];
    // Convert to PascalCase
    const relatedEntity =
      entityName.charAt(0).toUpperCase() + entityName.slice(1);
    return {
      field: fieldName,
      relatedEntity,
    };
  }
  return undefined;
};

interface FieldInfo {
  values: unknown[];
  types: Set<FieldType>;
  formats: Set<FieldFormat>;
}

/**
 * Collect field information from multiple examples
 */
const collectFieldInfo = (
  examples: unknown[]
): Map<string, FieldInfo> => {
  const fieldMap = new Map<string, FieldInfo>();

  for (const example of examples) {
    if (!isObject(example)) continue;

    for (const [key, value] of Object.entries(example)) {
      if (!fieldMap.has(key)) {
        fieldMap.set(key, {
          values: [],
          types: new Set(),
          formats: new Set(),
        });
      }

      const info = fieldMap.get(key)!;
      info.values.push(value);
      info.types.add(inferType(value));

      if (typeof value === "string") {
        const format = detectFormat(value);
        if (format) {
          info.formats.add(format);
        }
      }
    }
  }

  return fieldMap;
};

/**
 * Build field schema from collected field info
 */
const buildFieldSchema = (
  name: string,
  info: FieldInfo
): FieldSchema => {
  // Determine the most specific type
  let type: FieldType = "string";
  if (info.types.size === 1) {
    type = Array.from(info.types)[0];
  } else if (info.types.has("object")) {
    type = "object";
  } else if (info.types.has("array")) {
    type = "array";
  } else if (info.types.has("number")) {
    type = "number";
  } else if (info.types.has("boolean")) {
    type = "boolean";
  } else if (info.types.has("date")) {
    type = "date";
  }

  // Determine format (use the most common one)
  let format: FieldFormat | undefined;
  if (info.formats.size === 1) {
    format = Array.from(info.formats)[0];
  } else if (info.formats.size > 1) {
    // If there are multiple formats, don't set any
    format = undefined;
  }

  // Get a representative example value
  const example = info.values.find((v) => v !== null && v !== undefined);

  return {
    name,
    type,
    format,
    nullable: isNullable(info.values),
    example,
  };
};

/**
 * Extract response examples from an API route
 */
const extractExamples = (route: APIRoute): unknown[] => {
  const examples: unknown[] = [];

  for (const ex of route.examples) {
    const response = ex.response;
    if (response === undefined || response === null) continue;

    // If it's an array, get the first item as an example
    if (Array.isArray(response)) {
      if (response.length > 0 && isObject(response[0])) {
        examples.push(response[0]);
      }
    } else if (isObject(response)) {
      examples.push(response);
    }
  }

  return examples;
};

/**
 * Infer schema for a single API route
 */
const inferRouteSchema = (route: APIRoute): DataSchema | undefined => {
  const examples = extractExamples(route);
  if (examples.length === 0) return undefined;

  const entityName = extractEntityName(route.path);
  const fieldInfoMap = collectFieldInfo(examples);

  const fields: FieldSchema[] = [];
  const relationships: Relationship[] = [];

  for (const [name, info] of fieldInfoMap) {
    const fieldSchema = buildFieldSchema(name, info);
    fields.push(fieldSchema);

    // Check for relationship
    const relationship = detectRelationship(name);
    if (relationship) {
      relationships.push(relationship);
    }
  }

  return {
    entity: entityName,
    fields,
    relationships,
  };
};

/**
 * Merge multiple schemas for the same entity
 */
const mergeSchemas = (schemas: DataSchema[]): DataSchema => {
  const mergedFields = new Map<string, FieldSchema>();
  const mergedRelationships = new Map<string, Relationship>();

  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (!mergedFields.has(field.name)) {
        mergedFields.set(field.name, field);
      } else {
        // Merge nullable status (if any instance is nullable, the field is nullable)
        const existing = mergedFields.get(field.name)!;
        if (field.nullable) {
          mergedFields.set(field.name, { ...existing, nullable: true });
        }
      }
    }

    for (const rel of schema.relationships) {
      if (!mergedRelationships.has(rel.field)) {
        mergedRelationships.set(rel.field, rel);
      }
    }
  }

  return {
    entity: schemas[0].entity,
    fields: Array.from(mergedFields.values()),
    relationships: Array.from(mergedRelationships.values()),
  };
};

/**
 * Infer data schemas from API routes
 *
 * @param routes - Array of API routes to analyze
 * @returns Array of inferred data schemas
 */
export const infer = (routes: APIRoute[]): DataSchema[] => {
  // Group schemas by entity name
  const schemasByEntity = new Map<string, DataSchema[]>();

  for (const route of routes) {
    const schema = inferRouteSchema(route);
    if (!schema) continue;

    if (!schemasByEntity.has(schema.entity)) {
      schemasByEntity.set(schema.entity, []);
    }
    schemasByEntity.get(schema.entity)!.push(schema);
  }

  // Merge schemas for each entity
  const results: DataSchema[] = [];
  for (const [, schemas] of schemasByEntity) {
    results.push(mergeSchemas(schemas));
  }

  return results;
};
