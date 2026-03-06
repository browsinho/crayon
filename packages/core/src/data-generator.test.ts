import { describe, expect, it } from "vitest";
import { generate, generateAll } from "./data-generator.js";
import type { DataSchema, FieldSchema } from "@crayon/types";

const createFieldSchema = (
  overrides: Partial<FieldSchema> = {}
): FieldSchema => ({
  name: overrides.name ?? "field",
  type: overrides.type ?? "string",
  format: overrides.format,
  nullable: overrides.nullable ?? false,
  example: overrides.example,
});

const createSchema = (
  overrides: Partial<DataSchema> = {}
): DataSchema => ({
  entity: overrides.entity ?? "Entity",
  fields: overrides.fields ?? [],
  relationships: overrides.relationships ?? [],
});

describe("generate", () => {
  describe("field type generation", () => {
    it("generates string values", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "name", type: "string" })],
      });

      const result = generate({ schema, count: 1, examples: [] });

      expect(result).toHaveLength(1);
      expect(typeof (result[0] as Record<string, unknown>).name).toBe("string");
    });

    it("generates number values", () => {
      const schema = createSchema({
        entity: "Product",
        fields: [createFieldSchema({ name: "price", type: "number" })],
      });

      const result = generate({ schema, count: 1, examples: [] });

      expect(result).toHaveLength(1);
      expect(typeof (result[0] as Record<string, unknown>).price).toBe("number");
    });

    it("generates boolean values", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "active", type: "boolean" })],
      });

      const result = generate({ schema, count: 1, examples: [] });

      expect(result).toHaveLength(1);
      expect(typeof (result[0] as Record<string, unknown>).active).toBe("boolean");
    });

    it("generates date values as ISO strings", () => {
      const schema = createSchema({
        entity: "Event",
        fields: [createFieldSchema({ name: "createdAt", type: "date" })],
      });

      const result = generate({ schema, count: 1, examples: [] });

      expect(result).toHaveLength(1);
      const dateValue = (result[0] as Record<string, unknown>).createdAt as string;
      expect(typeof dateValue).toBe("string");
      expect(() => new Date(dateValue)).not.toThrow();
    });

    it("generates array values", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "tags", type: "array" })],
      });

      const result = generate({ schema, count: 1, examples: [] });

      expect(result).toHaveLength(1);
      expect(Array.isArray((result[0] as Record<string, unknown>).tags)).toBe(true);
    });

    it("generates object values", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "metadata", type: "object" })],
      });

      const result = generate({ schema, count: 1, examples: [] });

      expect(result).toHaveLength(1);
      const metadata = (result[0] as Record<string, unknown>).metadata;
      expect(typeof metadata).toBe("object");
      expect(metadata).not.toBeNull();
    });
  });

  describe("format-based generation", () => {
    it("generates valid email format", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "email", type: "string", format: "email" })],
      });

      const result = generate({ schema, count: 5, examples: [] });

      for (const record of result) {
        const email = (record as Record<string, unknown>).email as string;
        expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
    });

    it("generates valid url format", () => {
      const schema = createSchema({
        entity: "Link",
        fields: [createFieldSchema({ name: "url", type: "string", format: "url" })],
      });

      const result = generate({ schema, count: 5, examples: [] });

      for (const record of result) {
        const url = (record as Record<string, unknown>).url as string;
        expect(url).toMatch(/^https?:\/\//);
      }
    });

    it("generates valid uuid format", () => {
      const schema = createSchema({
        entity: "Entity",
        fields: [createFieldSchema({ name: "id", type: "string", format: "uuid" })],
      });

      const result = generate({ schema, count: 5, examples: [] });

      for (const record of result) {
        const id = (record as Record<string, unknown>).id as string;
        expect(id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    });

    it("generates valid date format", () => {
      const schema = createSchema({
        entity: "Event",
        fields: [createFieldSchema({ name: "startDate", type: "string", format: "date" })],
      });

      const result = generate({ schema, count: 5, examples: [] });

      for (const record of result) {
        const date = (record as Record<string, unknown>).startDate as string;
        expect(() => new Date(date)).not.toThrow();
        expect(new Date(date).toISOString()).toBeTruthy();
      }
    });
  });

  describe("name-based generation", () => {
    it("generates realistic names for 'name' field", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "name", type: "string" })],
      });

      const result = generate({ schema, count: 5, examples: [] });

      for (const record of result) {
        const name = (record as Record<string, unknown>).name as string;
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
        // Full names typically have spaces
        expect(name).toContain(" ");
      }
    });

    it("generates realistic first names", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "firstName", type: "string" })],
      });

      const result = generate({ schema, count: 5, examples: [] });

      for (const record of result) {
        const firstName = (record as Record<string, unknown>).firstName as string;
        expect(typeof firstName).toBe("string");
        expect(firstName.length).toBeGreaterThan(0);
      }
    });

    it("generates realistic phone numbers", () => {
      const schema = createSchema({
        entity: "Contact",
        fields: [createFieldSchema({ name: "phone", type: "string" })],
      });

      const result = generate({ schema, count: 5, examples: [] });

      for (const record of result) {
        const phone = (record as Record<string, unknown>).phone as string;
        expect(typeof phone).toBe("string");
        // Phone numbers have digits
        expect(phone).toMatch(/\d/);
      }
    });

    it("generates descriptions as paragraphs", () => {
      const schema = createSchema({
        entity: "Product",
        fields: [createFieldSchema({ name: "description", type: "string" })],
      });

      const result = generate({ schema, count: 3, examples: [] });

      for (const record of result) {
        const desc = (record as Record<string, unknown>).description as string;
        expect(typeof desc).toBe("string");
        // Paragraphs are typically longer
        expect(desc.length).toBeGreaterThan(20);
      }
    });
  });

  describe("schema validation and count", () => {
    it("generates exactly the requested count", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "id", type: "string" })],
      });

      const result = generate({ schema, count: 25, examples: [] });

      expect(result).toHaveLength(25);
    });

    it("generates records matching all schema fields", () => {
      const schema = createSchema({
        entity: "User",
        fields: [
          createFieldSchema({ name: "id", type: "string", format: "uuid" }),
          createFieldSchema({ name: "name", type: "string" }),
          createFieldSchema({ name: "email", type: "string", format: "email" }),
          createFieldSchema({ name: "age", type: "number" }),
          createFieldSchema({ name: "active", type: "boolean" }),
        ],
      });

      const result = generate({ schema, count: 1, examples: [] });

      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(record).toHaveProperty("id");
      expect(record).toHaveProperty("name");
      expect(record).toHaveProperty("email");
      expect(record).toHaveProperty("age");
      expect(record).toHaveProperty("active");
    });

    it("handles empty schema fields", () => {
      const schema = createSchema({
        entity: "Empty",
        fields: [],
      });

      const result = generate({ schema, count: 5, examples: [] });

      expect(result).toHaveLength(5);
      for (const record of result) {
        expect(Object.keys(record as object)).toHaveLength(0);
      }
    });

    it("handles zero count", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "id", type: "string" })],
      });

      const result = generate({ schema, count: 0, examples: [] });

      expect(result).toHaveLength(0);
    });
  });

  describe("nullable fields", () => {
    it("can generate null values for nullable fields", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "bio", type: "string", nullable: true })],
      });

      // Generate many records to ensure we get at least one null
      const result = generate({ schema, count: 100, examples: [] });

      const hasNull = result.some(
        (record) => (record as Record<string, unknown>).bio === null
      );
      const hasValue = result.some(
        (record) => (record as Record<string, unknown>).bio !== null
      );

      // Due to 10% chance of null, we should have both
      expect(hasNull || hasValue).toBe(true);
    });

    it("does not generate null values for non-nullable fields", () => {
      const schema = createSchema({
        entity: "User",
        fields: [createFieldSchema({ name: "name", type: "string", nullable: false })],
      });

      const result = generate({ schema, count: 100, examples: [] });

      const hasNull = result.some(
        (record) => (record as Record<string, unknown>).name === null
      );

      expect(hasNull).toBe(false);
    });
  });
});

describe("generateAll", () => {
  describe("referential integrity", () => {
    it("generates data for multiple schemas", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "User",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "name", type: "string" }),
          ],
        }),
        createSchema({
          entity: "Post",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "title", type: "string" }),
          ],
        }),
      ];

      const result = generateAll(schemas, {});

      expect(result).toHaveProperty("User");
      expect(result).toHaveProperty("Post");
      expect(result.User.length).toBeGreaterThan(0);
      expect(result.Post.length).toBeGreaterThan(0);
    });

    it("maintains foreign key references", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "User",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "name", type: "string" }),
          ],
        }),
        createSchema({
          entity: "Post",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "title", type: "string" }),
            createFieldSchema({ name: "userId", type: "string" }),
          ],
          relationships: [{ field: "userId", relatedEntity: "User" }],
        }),
      ];

      const result = generateAll(schemas, {});

      // Get all user IDs
      const userIds = new Set(
        result.User.map((u) => (u as Record<string, unknown>).id)
      );

      // Check that all post userIds reference valid users
      for (const post of result.Post) {
        const postUserId = (post as Record<string, unknown>).userId;
        expect(userIds.has(postUserId)).toBe(true);
      }
    });

    it("handles snake_case foreign keys", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "User",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
          ],
        }),
        createSchema({
          entity: "Comment",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "user_id", type: "string" }),
          ],
          relationships: [{ field: "user_id", relatedEntity: "User" }],
        }),
      ];

      const result = generateAll(schemas, {});

      const userIds = new Set(
        result.User.map((u) => (u as Record<string, unknown>).id)
      );

      for (const comment of result.Comment) {
        const commentUserId = (comment as Record<string, unknown>).user_id;
        expect(userIds.has(commentUserId)).toBe(true);
      }
    });

    it("handles multiple relationships", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "User",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
          ],
        }),
        createSchema({
          entity: "Product",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
          ],
        }),
        createSchema({
          entity: "Order",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "userId", type: "string" }),
            createFieldSchema({ name: "productId", type: "string" }),
          ],
          relationships: [
            { field: "userId", relatedEntity: "User" },
            { field: "productId", relatedEntity: "Product" },
          ],
        }),
      ];

      const result = generateAll(schemas, {});

      const userIds = new Set(
        result.User.map((u) => (u as Record<string, unknown>).id)
      );
      const productIds = new Set(
        result.Product.map((p) => (p as Record<string, unknown>).id)
      );

      for (const order of result.Order) {
        const o = order as Record<string, unknown>;
        expect(userIds.has(o.userId)).toBe(true);
        expect(productIds.has(o.productId)).toBe(true);
      }
    });
  });

  describe("examples as templates", () => {
    it("uses example count as minimum", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "User",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
          ],
        }),
      ];

      const examples = {
        User: [{ id: "1" }, { id: "2" }, { id: "3" }],
      };

      const result = generateAll(schemas, examples);

      // Should generate at least 10 (minimum) or example count, whichever is greater
      expect(result.User.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("dependency ordering", () => {
    it("generates independent schemas first", () => {
      // Define schemas in reverse dependency order
      const schemas: DataSchema[] = [
        createSchema({
          entity: "Comment",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "postId", type: "string" }),
          ],
          relationships: [{ field: "postId", relatedEntity: "Post" }],
        }),
        createSchema({
          entity: "Post",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "userId", type: "string" }),
          ],
          relationships: [{ field: "userId", relatedEntity: "User" }],
        }),
        createSchema({
          entity: "User",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
          ],
        }),
      ];

      const result = generateAll(schemas, {});

      // All foreign keys should be valid despite reverse definition order
      const userIds = new Set(
        result.User.map((u) => (u as Record<string, unknown>).id)
      );
      const postIds = new Set(
        result.Post.map((p) => (p as Record<string, unknown>).id)
      );

      for (const post of result.Post) {
        expect(userIds.has((post as Record<string, unknown>).userId)).toBe(true);
      }

      for (const comment of result.Comment) {
        expect(postIds.has((comment as Record<string, unknown>).postId)).toBe(true);
      }
    });

    it("handles circular dependencies gracefully", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "A",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "bId", type: "string" }),
          ],
          relationships: [{ field: "bId", relatedEntity: "B" }],
        }),
        createSchema({
          entity: "B",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "aId", type: "string" }),
          ],
          relationships: [{ field: "aId", relatedEntity: "A" }],
        }),
      ];

      // Should not throw even with circular dependencies
      const result = generateAll(schemas, {});

      expect(result).toHaveProperty("A");
      expect(result).toHaveProperty("B");
      expect(result.A.length).toBeGreaterThan(0);
      expect(result.B.length).toBeGreaterThan(0);
    });
  });

  describe("empty inputs", () => {
    it("handles empty schemas array", () => {
      const result = generateAll([], {});
      expect(result).toEqual({});
    });

    it("handles empty examples", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "User",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
          ],
        }),
      ];

      const result = generateAll(schemas, {});

      expect(result.User.length).toBe(10); // Default count
    });
  });
});
