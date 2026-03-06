/**
 * Prompt Modifier - Modifies sandbox data via simple command parsing
 *
 * Parses natural language commands to data operations and executes them.
 * Supports add/create, delete, update, and mark operations.
 * Generates realistic data using Faker.js when adding records.
 */

import { faker } from "@faker-js/faker";
import { z } from "zod";

// Result types
export interface PromptChange {
  entity: string;
  operation: "create" | "update" | "delete";
  count: number;
}

export interface PromptResult {
  success: boolean;
  changes: PromptChange[];
  error?: string;
}

// Parsed command types
type ParsedCommand =
  | { type: "create"; entity: string; count: number }
  | { type: "delete"; entity: string; where?: { field: string; value: string } }
  | { type: "update"; entity: string; set: { field: string; value: string }; where?: { field: string; value: string } }
  | { type: "mark"; entity: string; field: string };

// Data provider interface for sandbox data operations
export interface DataProvider {
  create(entity: string, data: Record<string, unknown>): Promise<void>;
  update(entity: string, field: string, value: unknown, where?: { field: string; value: string }): Promise<number>;
  delete(entity: string, where?: { field: string; value: string }): Promise<number>;
  getSchema(entity?: string): Promise<EntitySchema | null>;
}

export interface EntitySchema {
  entity: string;
  fields: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "date" | "array" | "object";
    format?: string;
  }>;
}

export type PromptModifierErrorCode = "PARSE_ERROR" | "VALIDATION_ERROR" | "OPERATION_FAILED" | "PROVIDER_ERROR";

export class PromptModifierError extends Error {
  constructor(
    message: string,
    public readonly code: PromptModifierErrorCode
  ) {
    super(message);
    this.name = "PromptModifierError";
  }
}

// Input validation schema
const ProcessInputSchema = z.object({
  command: z.string().min(1),
  sandboxId: z.string().min(1),
});

// Entity name generators for realistic data
const entityGenerators: Record<string, () => Record<string, unknown>> = {
  email: () => ({
    id: faker.string.uuid(),
    from: faker.internet.email(),
    to: faker.internet.email(),
    subject: faker.lorem.sentence(),
    body: faker.lorem.paragraphs(2),
    read: faker.datatype.boolean(),
    createdAt: faker.date.recent().toISOString(),
  }),
  emails: () => entityGenerators.email(),
  user: () => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    username: faker.internet.username(),
    avatar: faker.image.avatar(),
    role: faker.helpers.arrayElement(["admin", "user", "guest"]),
    active: faker.datatype.boolean(),
    createdAt: faker.date.recent().toISOString(),
  }),
  users: () => entityGenerators.user(),
  product: () => ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
    category: faker.commerce.department(),
    inStock: faker.datatype.boolean(),
    createdAt: faker.date.recent().toISOString(),
  }),
  products: () => entityGenerators.product(),
  order: () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    total: faker.number.float({ min: 10, max: 5000, fractionDigits: 2 }),
    status: faker.helpers.arrayElement(["pending", "processing", "shipped", "delivered"]),
    createdAt: faker.date.recent().toISOString(),
  }),
  orders: () => entityGenerators.order(),
  comment: () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    postId: faker.string.uuid(),
    content: faker.lorem.paragraph(),
    createdAt: faker.date.recent().toISOString(),
  }),
  comments: () => entityGenerators.comment(),
  post: () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraphs(3),
    published: faker.datatype.boolean(),
    createdAt: faker.date.recent().toISOString(),
  }),
  posts: () => entityGenerators.post(),
  message: () => ({
    id: faker.string.uuid(),
    senderId: faker.string.uuid(),
    receiverId: faker.string.uuid(),
    content: faker.lorem.sentence(),
    read: faker.datatype.boolean(),
    createdAt: faker.date.recent().toISOString(),
  }),
  messages: () => entityGenerators.message(),
  task: () => ({
    id: faker.string.uuid(),
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    status: faker.helpers.arrayElement(["todo", "in_progress", "done"]),
    priority: faker.helpers.arrayElement(["low", "medium", "high"]),
    assigneeId: faker.string.uuid(),
    createdAt: faker.date.recent().toISOString(),
  }),
  tasks: () => entityGenerators.task(),
  notification: () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    title: faker.lorem.sentence(),
    message: faker.lorem.sentence(),
    read: faker.datatype.boolean(),
    type: faker.helpers.arrayElement(["info", "warning", "error", "success"]),
    createdAt: faker.date.recent().toISOString(),
  }),
  notifications: () => entityGenerators.notification(),
};

/**
 * Generate a generic record for unknown entity types
 */
function generateGenericRecord(): Record<string, unknown> {
  return {
    id: faker.string.uuid(),
    name: faker.lorem.word(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.recent().toISOString(),
  };
}

/**
 * Generate a record based on entity type
 */
export function generateRecord(entity: string): Record<string, unknown> {
  const normalizedEntity = entity.toLowerCase();
  const generator = entityGenerators[normalizedEntity];
  return generator ? generator() : generateGenericRecord();
}

/**
 * Parse command patterns (case-insensitive)
 */
export function parseCommand(command: string): ParsedCommand {
  const normalized = command.trim();

  // Pattern: add N {entity} | create N {entity}
  const createMatch = normalized.match(/^(?:add|create)\s+(\d+)\s+(\w+)$/i);
  if (createMatch) {
    const count = parseInt(createMatch[1], 10);
    if (count <= 0) {
      throw new PromptModifierError("Count must be a positive number", "VALIDATION_ERROR");
    }
    if (count > 1000) {
      throw new PromptModifierError("Count cannot exceed 1000", "VALIDATION_ERROR");
    }
    return {
      type: "create",
      entity: createMatch[2],
      count,
    };
  }

  // Pattern: delete all {entity}
  const deleteAllMatch = normalized.match(/^delete\s+all\s+(\w+)$/i);
  if (deleteAllMatch) {
    return {
      type: "delete",
      entity: deleteAllMatch[1],
    };
  }

  // Pattern: delete {entity} where {field}={value}
  const deleteWhereMatch = normalized.match(/^delete\s+(\w+)\s+where\s+(\w+)\s*=\s*(.+)$/i);
  if (deleteWhereMatch) {
    return {
      type: "delete",
      entity: deleteWhereMatch[1],
      where: {
        field: deleteWhereMatch[2],
        value: deleteWhereMatch[3].trim(),
      },
    };
  }

  // Pattern: update {entity} set {field}={value} where {field}={value}
  const updateWhereMatch = normalized.match(
    /^update\s+(\w+)\s+set\s+(\w+)\s*=\s*([^\s]+)\s+where\s+(\w+)\s*=\s*(.+)$/i
  );
  if (updateWhereMatch) {
    return {
      type: "update",
      entity: updateWhereMatch[1],
      set: {
        field: updateWhereMatch[2],
        value: updateWhereMatch[3].trim(),
      },
      where: {
        field: updateWhereMatch[4],
        value: updateWhereMatch[5].trim(),
      },
    };
  }

  // Pattern: update {entity} set {field}={value}
  const updateMatch = normalized.match(/^update\s+(\w+)\s+set\s+(\w+)\s*=\s*(.+)$/i);
  if (updateMatch) {
    return {
      type: "update",
      entity: updateMatch[1],
      set: {
        field: updateMatch[2],
        value: updateMatch[3].trim(),
      },
    };
  }

  // Pattern: mark all {entity} as {field}
  const markMatch = normalized.match(/^mark\s+all\s+(\w+)\s+as\s+(\w+)$/i);
  if (markMatch) {
    return {
      type: "mark",
      entity: markMatch[1],
      field: markMatch[2],
    };
  }

  throw new PromptModifierError(
    `Unable to parse command: "${command}". Supported patterns: ` +
      '"add N {entity}", "create N {entity}", "delete all {entity}", ' +
      '"delete {entity} where {field}={value}", "update {entity} set {field}={value}", ' +
      '"update {entity} set {field}={value} where {field}={value}", "mark all {entity} as {field}"',
    "PARSE_ERROR"
  );
}

/**
 * Parse value string to appropriate type
 */
export function parseValue(value: string): unknown {
  // Handle boolean values
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;

  // Handle numeric values
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "") return num;

  // Handle quoted strings (remove quotes)
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Return as string
  return value;
}

/**
 * Validate command before execution
 */
export function validateCommand(parsed: ParsedCommand): void {
  // Entity name validation
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(parsed.entity)) {
    throw new PromptModifierError(
      `Invalid entity name: "${parsed.entity}". Must start with a letter and contain only letters, numbers, and underscores.`,
      "VALIDATION_ERROR"
    );
  }

  // Field name validation for update/mark commands
  if (parsed.type === "update" || parsed.type === "mark") {
    const fieldName = parsed.type === "mark" ? parsed.field : parsed.set.field;
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldName)) {
      throw new PromptModifierError(
        `Invalid field name: "${fieldName}". Must start with a letter and contain only letters, numbers, and underscores.`,
        "VALIDATION_ERROR"
      );
    }
  }

  // Where clause field validation
  if ((parsed.type === "delete" || parsed.type === "update") && parsed.where) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(parsed.where.field)) {
      throw new PromptModifierError(
        `Invalid field name in where clause: "${parsed.where.field}". Must start with a letter and contain only letters, numbers, and underscores.`,
        "VALIDATION_ERROR"
      );
    }
  }
}

/**
 * Execute parsed command against data provider
 */
async function executeCommand(parsed: ParsedCommand, provider: DataProvider): Promise<PromptChange> {
  switch (parsed.type) {
    case "create": {
      for (let i = 0; i < parsed.count; i++) {
        const record = generateRecord(parsed.entity);
        await provider.create(parsed.entity, record);
      }
      return {
        entity: parsed.entity,
        operation: "create",
        count: parsed.count,
      };
    }

    case "delete": {
      const count = await provider.delete(parsed.entity, parsed.where);
      return {
        entity: parsed.entity,
        operation: "delete",
        count,
      };
    }

    case "update": {
      const value = parseValue(parsed.set.value);
      const count = await provider.update(parsed.entity, parsed.set.field, value, parsed.where);
      return {
        entity: parsed.entity,
        operation: "update",
        count,
      };
    }

    case "mark": {
      // Mark is a special case of update that sets a boolean field to true
      const count = await provider.update(parsed.entity, parsed.field, true);
      return {
        entity: parsed.entity,
        operation: "update",
        count,
      };
    }
  }
}

/**
 * Process a natural language command to modify sandbox data
 */
export async function process(command: string, sandboxId: string, provider: DataProvider): Promise<PromptResult> {
  try {
    // Validate input
    ProcessInputSchema.parse({ command, sandboxId });

    // Parse the command
    const parsed = parseCommand(command);

    // Validate the parsed command
    validateCommand(parsed);

    // Execute the command
    const change = await executeCommand(parsed, provider);

    return {
      success: true,
      changes: [change],
    };
  } catch (error) {
    if (error instanceof PromptModifierError) {
      return {
        success: false,
        changes: [],
        error: error.message,
      };
    }

    if (error instanceof z.ZodError) {
      return {
        success: false,
        changes: [],
        error: `Invalid input: ${error.errors.map((e) => e.message).join(", ")}`,
      };
    }

    return {
      success: false,
      changes: [],
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Create a mock data provider for testing
 */
export function createMockDataProvider(): DataProvider & {
  getData(): Record<string, Record<string, unknown>[]>;
  setData(entity: string, records: Record<string, unknown>[]): void;
} {
  const data: Record<string, Record<string, unknown>[]> = {};

  return {
    async create(entity: string, record: Record<string, unknown>): Promise<void> {
      if (!data[entity]) {
        data[entity] = [];
      }
      data[entity].push(record);
    },

    async update(
      entity: string,
      field: string,
      value: unknown,
      where?: { field: string; value: string }
    ): Promise<number> {
      const records = data[entity] || [];
      let count = 0;

      for (const record of records) {
        if (where) {
          const recordValue = record[where.field];
          const whereValue = parseValue(where.value);
          if (recordValue !== whereValue) {
            continue;
          }
        }
        record[field] = value;
        count++;
      }

      return count;
    },

    async delete(entity: string, where?: { field: string; value: string }): Promise<number> {
      const records = data[entity] || [];
      if (!where) {
        const count = records.length;
        data[entity] = [];
        return count;
      }

      const whereValue = parseValue(where.value);
      const originalLength = records.length;
      data[entity] = records.filter((record) => record[where.field] !== whereValue);
      return originalLength - data[entity].length;
    },

    async getSchema(): Promise<EntitySchema | null> {
      return null;
    },

    getData(): Record<string, Record<string, unknown>[]> {
      return data;
    },

    setData(entity: string, records: Record<string, unknown>[]): void {
      data[entity] = records;
    },
  };
}
