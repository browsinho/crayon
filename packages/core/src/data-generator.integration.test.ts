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

describe("data-generator integration tests", () => {
  describe("generate 10 user records", () => {
    it("generates 10 valid user records", () => {
      const userSchema = createSchema({
        entity: "User",
        fields: [
          createFieldSchema({ name: "id", type: "string", format: "uuid" }),
          createFieldSchema({ name: "name", type: "string" }),
          createFieldSchema({ name: "email", type: "string", format: "email" }),
          createFieldSchema({ name: "phone", type: "string" }),
          createFieldSchema({ name: "age", type: "number" }),
          createFieldSchema({ name: "active", type: "boolean" }),
          createFieldSchema({ name: "createdAt", type: "date", format: "date" }),
        ],
      });

      const users = generate({ schema: userSchema, count: 10, examples: [] });

      expect(users).toHaveLength(10);

      for (const user of users) {
        const u = user as Record<string, unknown>;

        // Verify id is a valid UUID
        expect(u.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );

        // Verify name is a non-empty string
        expect(typeof u.name).toBe("string");
        expect((u.name as string).length).toBeGreaterThan(0);

        // Verify email looks like an email
        expect(u.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

        // Verify phone has digits
        expect(typeof u.phone).toBe("string");
        expect(u.phone).toMatch(/\d/);

        // Verify age is a positive number
        expect(typeof u.age).toBe("number");
        expect(u.age).toBeGreaterThan(0);

        // Verify active is boolean
        expect(typeof u.active).toBe("boolean");

        // Verify createdAt is a valid date string
        expect(typeof u.createdAt).toBe("string");
        expect(() => new Date(u.createdAt as string)).not.toThrow();
        expect(new Date(u.createdAt as string).toString()).not.toBe("Invalid Date");
      }
    });

    it("generates unique user ids", () => {
      const userSchema = createSchema({
        entity: "User",
        fields: [
          createFieldSchema({ name: "id", type: "string", format: "uuid" }),
        ],
      });

      const users = generate({ schema: userSchema, count: 100, examples: [] });
      const ids = users.map((u) => (u as Record<string, unknown>).id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
    });
  });

  describe("generate users + emails with foreign keys", () => {
    it("generates users and emails with valid foreign key relationships", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "User",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "name", type: "string" }),
            createFieldSchema({ name: "email", type: "string", format: "email" }),
          ],
        }),
        createSchema({
          entity: "Email",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "userId", type: "string" }),
            createFieldSchema({ name: "address", type: "string", format: "email" }),
            createFieldSchema({ name: "verified", type: "boolean" }),
            createFieldSchema({ name: "createdAt", type: "date", format: "date" }),
          ],
          relationships: [{ field: "userId", relatedEntity: "User" }],
        }),
      ];

      const result = generateAll(schemas, {});

      expect(result.User.length).toBeGreaterThan(0);
      expect(result.Email.length).toBeGreaterThan(0);

      // Collect all user IDs
      const userIds = new Set(
        result.User.map((u) => (u as Record<string, unknown>).id)
      );

      // Verify each email's userId references a valid user
      for (const email of result.Email) {
        const e = email as Record<string, unknown>;

        expect(userIds.has(e.userId)).toBe(true);
        expect(e.address).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        expect(typeof e.verified).toBe("boolean");
      }
    });

    it("generates nested relationships (user -> post -> comment)", () => {
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
            createFieldSchema({ name: "content", type: "string" }),
            createFieldSchema({ name: "userId", type: "string" }),
          ],
          relationships: [{ field: "userId", relatedEntity: "User" }],
        }),
        createSchema({
          entity: "Comment",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "text", type: "string" }),
            createFieldSchema({ name: "postId", type: "string" }),
            createFieldSchema({ name: "userId", type: "string" }),
          ],
          relationships: [
            { field: "postId", relatedEntity: "Post" },
            { field: "userId", relatedEntity: "User" },
          ],
        }),
      ];

      const result = generateAll(schemas, {});

      const userIds = new Set(
        result.User.map((u) => (u as Record<string, unknown>).id)
      );
      const postIds = new Set(
        result.Post.map((p) => (p as Record<string, unknown>).id)
      );

      // Verify all posts reference valid users
      for (const post of result.Post) {
        expect(userIds.has((post as Record<string, unknown>).userId)).toBe(true);
      }

      // Verify all comments reference valid posts and users
      for (const comment of result.Comment) {
        const c = comment as Record<string, unknown>;
        expect(postIds.has(c.postId)).toBe(true);
        expect(userIds.has(c.userId)).toBe(true);
      }
    });
  });

  describe("generate from real schema with realistic output", () => {
    it("generates realistic e-commerce data", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "Customer",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "firstName", type: "string" }),
            createFieldSchema({ name: "lastName", type: "string" }),
            createFieldSchema({ name: "email", type: "string", format: "email" }),
            createFieldSchema({ name: "phone", type: "string" }),
            createFieldSchema({ name: "address", type: "string" }),
            createFieldSchema({ name: "city", type: "string" }),
            createFieldSchema({ name: "createdAt", type: "date", format: "date" }),
          ],
        }),
        createSchema({
          entity: "Product",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "name", type: "string" }),
            createFieldSchema({ name: "description", type: "string" }),
            createFieldSchema({ name: "price", type: "number" }),
            createFieldSchema({ name: "imageUrl", type: "string", format: "url" }),
            createFieldSchema({ name: "quantity", type: "number" }),
            createFieldSchema({ name: "active", type: "boolean" }),
          ],
        }),
        createSchema({
          entity: "Order",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "customerId", type: "string" }),
            createFieldSchema({ name: "productId", type: "string" }),
            createFieldSchema({ name: "quantity", type: "number" }),
            createFieldSchema({ name: "totalPrice", type: "number" }),
            createFieldSchema({ name: "status", type: "string" }),
            createFieldSchema({ name: "createdAt", type: "date", format: "date" }),
          ],
          relationships: [
            { field: "customerId", relatedEntity: "Customer" },
            { field: "productId", relatedEntity: "Product" },
          ],
        }),
      ];

      const result = generateAll(schemas, {});

      // Verify customers have realistic data
      for (const customer of result.Customer) {
        const c = customer as Record<string, unknown>;
        expect(typeof c.firstName).toBe("string");
        expect((c.firstName as string).length).toBeGreaterThan(0);
        expect(typeof c.lastName).toBe("string");
        expect((c.lastName as string).length).toBeGreaterThan(0);
        expect(c.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }

      // Verify products have realistic data
      for (const product of result.Product) {
        const p = product as Record<string, unknown>;
        expect(typeof p.name).toBe("string");
        expect(typeof p.description).toBe("string");
        expect((p.description as string).length).toBeGreaterThan(10);
        expect(typeof p.price).toBe("number");
        expect(p.price).toBeGreaterThan(0);
        expect(p.imageUrl).toMatch(/^https?:\/\//);
      }

      // Verify orders have valid foreign keys
      const customerIds = new Set(
        result.Customer.map((c) => (c as Record<string, unknown>).id)
      );
      const productIds = new Set(
        result.Product.map((p) => (p as Record<string, unknown>).id)
      );

      for (const order of result.Order) {
        const o = order as Record<string, unknown>;
        expect(customerIds.has(o.customerId)).toBe(true);
        expect(productIds.has(o.productId)).toBe(true);
        expect(typeof o.quantity).toBe("number");
      }
    });

    it("generates realistic blog data", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "Author",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "name", type: "string" }),
            createFieldSchema({ name: "email", type: "string", format: "email" }),
            createFieldSchema({ name: "bio", type: "string" }),
            createFieldSchema({ name: "avatar", type: "string", format: "url" }),
          ],
        }),
        createSchema({
          entity: "Article",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "title", type: "string" }),
            createFieldSchema({ name: "content", type: "string" }),
            createFieldSchema({ name: "authorId", type: "string" }),
            createFieldSchema({ name: "publishedAt", type: "date", format: "date" }),
            createFieldSchema({ name: "published", type: "boolean" }),
          ],
          relationships: [{ field: "authorId", relatedEntity: "Author" }],
        }),
      ];

      const result = generateAll(schemas, {});

      // Verify authors
      for (const author of result.Author) {
        const a = author as Record<string, unknown>;
        expect(typeof a.name).toBe("string");
        expect((a.name as string).length).toBeGreaterThan(0);
        expect(a.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        expect(typeof a.bio).toBe("string");
        expect((a.bio as string).length).toBeGreaterThan(10); // Bio should be a paragraph
        expect(a.avatar).toMatch(/^https?:\/\//);
      }

      // Verify articles reference valid authors
      const authorIds = new Set(
        result.Author.map((a) => (a as Record<string, unknown>).id)
      );

      for (const article of result.Article) {
        const art = article as Record<string, unknown>;
        expect(authorIds.has(art.authorId)).toBe(true);
        expect(typeof art.title).toBe("string");
        expect(typeof art.published).toBe("boolean");
      }
    });
  });

  describe("data quality validation", () => {
    it("emails look like real emails", () => {
      const schema = createSchema({
        entity: "User",
        fields: [
          createFieldSchema({ name: "email", type: "string", format: "email" }),
        ],
      });

      const users = generate({ schema, count: 50, examples: [] });

      for (const user of users) {
        const email = (user as Record<string, unknown>).email as string;
        // Valid email format
        expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        // Has at least 5 characters
        expect(email.length).toBeGreaterThanOrEqual(5);
        // Contains @ symbol
        expect(email).toContain("@");
        // Has domain with at least one dot
        const parts = email.split("@");
        expect(parts[1]).toContain(".");
      }
    });

    it("names look like real names", () => {
      const schema = createSchema({
        entity: "User",
        fields: [
          createFieldSchema({ name: "name", type: "string" }),
          createFieldSchema({ name: "firstName", type: "string" }),
          createFieldSchema({ name: "lastName", type: "string" }),
        ],
      });

      const users = generate({ schema, count: 50, examples: [] });

      for (const user of users) {
        const u = user as Record<string, unknown>;

        // Full name should have at least 2 words
        const fullName = u.name as string;
        expect(fullName.length).toBeGreaterThan(0);

        // First name should be a single word or have some length
        const firstName = u.firstName as string;
        expect(firstName.length).toBeGreaterThan(0);

        // Last name should be a single word or have some length
        const lastName = u.lastName as string;
        expect(lastName.length).toBeGreaterThan(0);
      }
    });

    it("urls look like real urls", () => {
      const schema = createSchema({
        entity: "Resource",
        fields: [
          createFieldSchema({ name: "url", type: "string", format: "url" }),
          createFieldSchema({ name: "website", type: "string" }),
          createFieldSchema({ name: "imageUrl", type: "string" }),
        ],
      });

      const resources = generate({ schema, count: 50, examples: [] });

      for (const resource of resources) {
        const r = resource as Record<string, unknown>;

        // url field (with format) should be a valid URL
        expect(r.url).toMatch(/^https?:\/\//);

        // website field should be detected by name and be a valid URL
        expect(r.website).toMatch(/^https?:\/\//);

        // imageUrl field should be detected by name and be a valid URL
        expect(r.imageUrl).toMatch(/^https?:\/\//);
      }
    });

    it("foreign keys reference valid records", () => {
      const schemas: DataSchema[] = [
        createSchema({
          entity: "Category",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "name", type: "string" }),
          ],
        }),
        createSchema({
          entity: "Product",
          fields: [
            createFieldSchema({ name: "id", type: "string", format: "uuid" }),
            createFieldSchema({ name: "name", type: "string" }),
            createFieldSchema({ name: "categoryId", type: "string" }),
          ],
          relationships: [{ field: "categoryId", relatedEntity: "Category" }],
        }),
      ];

      const result = generateAll(schemas, {});

      const categoryIds = new Set(
        result.Category.map((c) => (c as Record<string, unknown>).id)
      );

      // Every product must have a valid categoryId
      for (const product of result.Product) {
        const categoryId = (product as Record<string, unknown>).categoryId;
        expect(categoryIds.has(categoryId)).toBe(true);
      }
    });
  });
});
