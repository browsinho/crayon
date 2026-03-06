/**
 * Data Generator - Generates realistic fake data using Faker.js based on inferred schemas
 *
 * Generates:
 * - Data matching schema structure
 * - Realistic data using Faker.js
 * - Maintains referential integrity between entities
 * - Uses recorded examples as templates
 */

import { faker } from "@faker-js/faker";
import type { DataSchema, FieldSchema } from "@crayon/types";

export interface GenerationRequest {
  schema: DataSchema;
  count: number;
  examples: unknown[];
  context?: string;
}

// Faker method mapping based on field format and name patterns
type FakerGenerator = () => unknown;

const formatGenerators: Record<string, FakerGenerator> = {
  email: () => faker.internet.email(),
  url: () => faker.internet.url(),
  uuid: () => faker.string.uuid(),
  date: () => faker.date.recent().toISOString(),
};

// Name-based generators for common field patterns
const namePatternGenerators: Record<string, FakerGenerator> = {
  name: () => faker.person.fullName(),
  firstName: () => faker.person.firstName(),
  first_name: () => faker.person.firstName(),
  lastName: () => faker.person.lastName(),
  last_name: () => faker.person.lastName(),
  phone: () => faker.phone.number(),
  phoneNumber: () => faker.phone.number(),
  phone_number: () => faker.phone.number(),
  paragraph: () => faker.lorem.paragraph(),
  description: () => faker.lorem.paragraph(),
  bio: () => faker.lorem.paragraph(),
  sentence: () => faker.lorem.sentence(),
  title: () => faker.lorem.sentence(),
  address: () => faker.location.streetAddress(),
  street: () => faker.location.street(),
  city: () => faker.location.city(),
  state: () => faker.location.state(),
  country: () => faker.location.country(),
  zipCode: () => faker.location.zipCode(),
  zip_code: () => faker.location.zipCode(),
  postalCode: () => faker.location.zipCode(),
  postal_code: () => faker.location.zipCode(),
  avatar: () => faker.image.avatar(),
  image: () => faker.image.url(),
  imageUrl: () => faker.image.url(),
  image_url: () => faker.image.url(),
  username: () => faker.internet.username(),
  company: () => faker.company.name(),
  companyName: () => faker.company.name(),
  company_name: () => faker.company.name(),
  website: () => faker.internet.url(),
  price: () => faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
  amount: () => faker.number.float({ min: 1, max: 10000, fractionDigits: 2 }),
  age: () => faker.number.int({ min: 18, max: 80 }),
  count: () => faker.number.int({ min: 0, max: 100 }),
  quantity: () => faker.number.int({ min: 1, max: 100 }),
};

// Type-based fallback generators
const typeGenerators: Record<string, FakerGenerator> = {
  string: () => faker.lorem.word(),
  number: () => faker.number.int({ min: 1, max: 1000 }),
  boolean: () => faker.datatype.boolean(),
  date: () => faker.date.recent().toISOString(),
  array: () => [],
  object: () => ({}),
};

/**
 * Get generator for a field based on format, name, and type
 */
function getFieldGenerator(field: FieldSchema): FakerGenerator {
  // For array and object types, always use type-based generator
  if (field.type === "array" || field.type === "object") {
    return typeGenerators[field.type];
  }

  // First check format
  if (field.format && formatGenerators[field.format]) {
    return formatGenerators[field.format];
  }

  // Check name patterns (only for string/number types that might have semantic meaning)
  const fieldName = field.name.toLowerCase();
  for (const [pattern, generator] of Object.entries(namePatternGenerators)) {
    if (fieldName === pattern.toLowerCase() || fieldName.includes(pattern.toLowerCase())) {
      return generator;
    }
  }

  // Check for id fields (generate uuid)
  if (field.name === "id" || field.name === "_id") {
    return () => faker.string.uuid();
  }

  // Check for fields ending with "Id" or "_id" (foreign keys will be handled separately)
  if (field.name.endsWith("Id") || field.name.endsWith("_id")) {
    return () => faker.string.uuid();
  }

  // Check for timestamp/date fields by name (only for string/date types)
  // Use more specific patterns to avoid false matches like "metadata"
  if (field.type === "string" || field.type === "date") {
    if (
      fieldName.includes("date") ||
      fieldName.includes("time") ||
      fieldName.endsWith("_at") ||
      fieldName.endsWith("at") && (fieldName.startsWith("created") || fieldName.startsWith("updated") || fieldName.startsWith("deleted")) ||
      fieldName === "created" ||
      fieldName === "updated"
    ) {
      return () => faker.date.recent().toISOString();
    }
  }

  // Fallback to type-based generator
  return typeGenerators[field.type] || (() => null);
}

/**
 * Generate a value using example as template when available
 */
function generateFieldValue(
  field: FieldSchema,
  examples: unknown[],
  generatedData: Map<string, unknown[]>
): unknown {
  // Handle nullable fields
  if (field.nullable && Math.random() < 0.1) {
    return null;
  }

  // Check if this is a foreign key relationship
  const foreignKeyMatch = field.name.match(/^(.+?)(_id|Id)$/);
  if (foreignKeyMatch) {
    const relatedEntity = foreignKeyMatch[1].charAt(0).toUpperCase() + foreignKeyMatch[1].slice(1);
    const relatedData = generatedData.get(relatedEntity);
    if (relatedData && relatedData.length > 0) {
      // Pick a random ID from the related entity
      const randomRecord = relatedData[Math.floor(Math.random() * relatedData.length)] as Record<
        string,
        unknown
      >;
      if (randomRecord && "id" in randomRecord) {
        return randomRecord.id;
      }
    }
  }

  // Use example value if available and it makes sense as a template
  if (field.example !== undefined && field.example !== null) {
    // For arrays, return a copy
    if (Array.isArray(field.example)) {
      return [...field.example];
    }
    // For objects, return a copy
    if (typeof field.example === "object") {
      return { ...field.example };
    }
    // For primitives, use the generator to get variety
  }

  // Generate value using appropriate generator
  const generator = getFieldGenerator(field);
  return generator();
}

/**
 * Generate a single record based on schema
 */
function generateRecord(
  schema: DataSchema,
  examples: unknown[],
  generatedData: Map<string, unknown[]>
): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  for (const field of schema.fields) {
    record[field.name] = generateFieldValue(field, examples, generatedData);
  }

  return record;
}

/**
 * Generate multiple records for a schema
 */
export function generate(request: GenerationRequest): unknown[] {
  const { schema, count, examples } = request;
  const results: unknown[] = [];
  const generatedData = new Map<string, unknown[]>();

  // Generate the requested number of records
  for (let i = 0; i < count; i++) {
    const record = generateRecord(schema, examples, generatedData);
    results.push(record);
  }

  return results;
}

/**
 * Generate data for multiple schemas with referential integrity
 *
 * Generates data in dependency order to ensure foreign keys reference valid records.
 * Schemas without relationships are generated first, then schemas that depend on them.
 */
export function generateAll(
  schemas: DataSchema[],
  examples: Record<string, unknown[]>
): Record<string, unknown[]> {
  const results: Record<string, unknown[]> = {};
  const generatedData = new Map<string, unknown[]>();

  // Sort schemas by dependency order
  const orderedSchemas = sortByDependencies(schemas);

  for (const schema of orderedSchemas) {
    const entityExamples = examples[schema.entity] || [];
    const count = entityExamples.length > 0 ? Math.max(entityExamples.length, 10) : 10;

    const records: unknown[] = [];
    for (let i = 0; i < count; i++) {
      const record = generateRecord(schema, entityExamples, generatedData);
      records.push(record);
    }

    results[schema.entity] = records;
    generatedData.set(schema.entity, records);
  }

  return results;
}

/**
 * Sort schemas by dependencies (schemas without dependencies first)
 */
function sortByDependencies(schemas: DataSchema[]): DataSchema[] {
  const entitySet = new Set(schemas.map((s) => s.entity));
  const resolved = new Set<string>();
  const result: DataSchema[] = [];

  // Keep iterating until all schemas are resolved
  while (result.length < schemas.length) {
    let progress = false;

    for (const schema of schemas) {
      if (resolved.has(schema.entity)) continue;

      // Check if all dependencies are resolved
      const unresolvedDeps = schema.relationships.filter(
        (rel) => entitySet.has(rel.relatedEntity) && !resolved.has(rel.relatedEntity)
      );

      if (unresolvedDeps.length === 0) {
        result.push(schema);
        resolved.add(schema.entity);
        progress = true;
      }
    }

    // If no progress was made, we have a circular dependency
    // Just add remaining schemas in order
    if (!progress) {
      for (const schema of schemas) {
        if (!resolved.has(schema.entity)) {
          result.push(schema);
          resolved.add(schema.entity);
        }
      }
    }
  }

  return result;
}
