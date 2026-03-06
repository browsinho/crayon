import { describe, expect, it } from "vitest";
import { infer } from "./schema-inferrer.js";
import type { APIRoute } from "@crayon/types";

const createRoute = (
  overrides: Partial<{
    method: string;
    path: string;
    pattern: "list" | "get" | "create" | "update" | "delete" | "custom";
    examples: { request?: unknown; response: unknown }[];
  }> = {}
): APIRoute => ({
  method: overrides.method ?? "GET",
  path: overrides.path ?? "/api/users",
  pattern: overrides.pattern ?? "list",
  examples: overrides.examples ?? [],
});

describe("infer", () => {
  describe("type inference", () => {
    it("infers string type", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ name: "John" }] }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas).toHaveLength(1);
      const nameField = schemas[0].fields.find((f) => f.name === "name");
      expect(nameField?.type).toBe("string");
    });

    it("infers number type", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ age: 30 }] }],
        }),
      ];

      const schemas = infer(routes);

      const ageField = schemas[0].fields.find((f) => f.name === "age");
      expect(ageField?.type).toBe("number");
    });

    it("infers boolean type", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ active: true }] }],
        }),
      ];

      const schemas = infer(routes);

      const activeField = schemas[0].fields.find((f) => f.name === "active");
      expect(activeField?.type).toBe("boolean");
    });

    it("infers date type from ISO date string", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ createdAt: "2024-01-15T10:30:00Z" }] }],
        }),
      ];

      const schemas = infer(routes);

      const createdAtField = schemas[0].fields.find((f) => f.name === "createdAt");
      expect(createdAtField?.type).toBe("date");
    });

    it("infers array type", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ tags: ["admin", "user"] }] }],
        }),
      ];

      const schemas = infer(routes);

      const tagsField = schemas[0].fields.find((f) => f.name === "tags");
      expect(tagsField?.type).toBe("array");
    });

    it("infers object type", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ address: { city: "NYC" } }] }],
        }),
      ];

      const schemas = infer(routes);

      const addressField = schemas[0].fields.find((f) => f.name === "address");
      expect(addressField?.type).toBe("object");
    });
  });

  describe("format detection", () => {
    it("detects email format", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ email: "john@example.com" }] }],
        }),
      ];

      const schemas = infer(routes);

      const emailField = schemas[0].fields.find((f) => f.name === "email");
      expect(emailField?.type).toBe("string");
      expect(emailField?.format).toBe("email");
    });

    it("detects url format", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ website: "https://example.com" }] }],
        }),
      ];

      const schemas = infer(routes);

      const websiteField = schemas[0].fields.find((f) => f.name === "website");
      expect(websiteField?.type).toBe("string");
      expect(websiteField?.format).toBe("url");
    });

    it("detects uuid format", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ id: "550e8400-e29b-41d4-a716-446655440000" }] }],
        }),
      ];

      const schemas = infer(routes);

      const idField = schemas[0].fields.find((f) => f.name === "id");
      expect(idField?.type).toBe("string");
      expect(idField?.format).toBe("uuid");
    });

    it("detects date format from ISO 8601 pattern", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/events",
          examples: [{ response: [{ startDate: "2024-01-15" }] }],
        }),
      ];

      const schemas = infer(routes);

      const startDateField = schemas[0].fields.find((f) => f.name === "startDate");
      expect(startDateField?.format).toBe("date");
    });
  });

  describe("relationship detection", () => {
    it("identifies foreign keys with _id suffix", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/posts",
          examples: [{ response: [{ id: 1, title: "Test", user_id: 42 }] }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas[0].relationships).toHaveLength(1);
      expect(schemas[0].relationships[0].field).toBe("user_id");
      expect(schemas[0].relationships[0].relatedEntity).toBe("User");
    });

    it("identifies foreign keys with Id suffix (camelCase)", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/comments",
          examples: [{ response: [{ id: 1, text: "Nice!", postId: 10 }] }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas[0].relationships).toHaveLength(1);
      expect(schemas[0].relationships[0].field).toBe("postId");
      expect(schemas[0].relationships[0].relatedEntity).toBe("Post");
    });

    it("identifies multiple relationships", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/orders",
          examples: [{ response: [{ id: 1, userId: 10, productId: 20 }] }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas[0].relationships).toHaveLength(2);
      const relatedEntities = schemas[0].relationships.map((r) => r.relatedEntity);
      expect(relatedEntities).toContain("User");
      expect(relatedEntities).toContain("Product");
    });
  });

  describe("arrays and nested objects", () => {
    it("handles array response by extracting first item", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          pattern: "list",
          examples: [
            {
              response: [
                { id: 1, name: "John", email: "john@example.com" },
                { id: 2, name: "Jane", email: "jane@example.com" },
              ],
            },
          ],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas).toHaveLength(1);
      expect(schemas[0].fields).toHaveLength(3);
      expect(schemas[0].fields.map((f) => f.name)).toContain("id");
      expect(schemas[0].fields.map((f) => f.name)).toContain("name");
      expect(schemas[0].fields.map((f) => f.name)).toContain("email");
    });

    it("handles single object response", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users/:userId",
          pattern: "get",
          examples: [{ response: { id: 1, name: "John" } }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas).toHaveLength(1);
      expect(schemas[0].fields).toHaveLength(2);
    });

    it("handles nested objects as object type", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [
            {
              response: [
                {
                  id: 1,
                  profile: {
                    bio: "Developer",
                    avatar: "https://example.com/avatar.png",
                  },
                },
              ],
            },
          ],
        }),
      ];

      const schemas = infer(routes);

      const profileField = schemas[0].fields.find((f) => f.name === "profile");
      expect(profileField?.type).toBe("object");
      expect(profileField?.example).toEqual({
        bio: "Developer",
        avatar: "https://example.com/avatar.png",
      });
    });
  });

  describe("nullable detection", () => {
    it("detects nullable fields from null values", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [
            { response: [{ id: 1, nickname: null }] },
            { response: [{ id: 2, nickname: "Johnny" }] },
          ],
        }),
      ];

      const schemas = infer(routes);

      const nicknameField = schemas[0].fields.find((f) => f.name === "nickname");
      expect(nicknameField?.nullable).toBe(true);
    });

    it("marks non-nullable fields correctly", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [
            { response: [{ id: 1, name: "John" }] },
            { response: [{ id: 2, name: "Jane" }] },
          ],
        }),
      ];

      const schemas = infer(routes);

      const nameField = schemas[0].fields.find((f) => f.name === "name");
      expect(nameField?.nullable).toBe(false);
    });
  });

  describe("entity naming", () => {
    it("extracts entity name from path", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ id: 1 }] }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas[0].entity).toBe("User");
    });

    it("handles singular resource names", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/user/:userId",
          examples: [{ response: { id: 1 } }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas[0].entity).toBe("User");
    });

    it("handles -ies plural ending", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/categories",
          examples: [{ response: [{ id: 1, name: "Electronics" }] }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas[0].entity).toBe("Category");
    });

    it("handles -es plural ending", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/boxes",
          examples: [{ response: [{ id: 1, size: "large" }] }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas[0].entity).toBe("Box");
    });

    it("skips api version prefixes", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/v1/products",
          examples: [{ response: [{ id: 1 }] }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas[0].entity).toBe("Product");
    });
  });

  describe("schema merging", () => {
    it("merges schemas from same entity", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          pattern: "list",
          examples: [{ response: [{ id: 1, name: "John" }] }],
        }),
        createRoute({
          path: "/api/users/:userId",
          pattern: "get",
          examples: [{ response: { id: 1, name: "John", email: "john@example.com" } }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas).toHaveLength(1);
      expect(schemas[0].entity).toBe("User");
      expect(schemas[0].fields.map((f) => f.name)).toContain("id");
      expect(schemas[0].fields.map((f) => f.name)).toContain("name");
      expect(schemas[0].fields.map((f) => f.name)).toContain("email");
    });

    it("preserves nullable across merged schemas", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ id: 1, bio: null }] }],
        }),
        createRoute({
          path: "/api/users/:userId",
          examples: [{ response: { id: 1, bio: "Developer" } }],
        }),
      ];

      const schemas = infer(routes);

      const bioField = schemas[0].fields.find((f) => f.name === "bio");
      expect(bioField?.nullable).toBe(true);
    });
  });

  describe("real-world scenario: user JSON with email format", () => {
    it("infers schema with email format detected", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          pattern: "list",
          examples: [
            {
              response: [
                {
                  id: 1,
                  name: "John Doe",
                  email: "john.doe@example.com",
                  createdAt: "2024-01-15T10:30:00Z",
                  active: true,
                },
              ],
            },
          ],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas).toHaveLength(1);
      expect(schemas[0].entity).toBe("User");

      const idField = schemas[0].fields.find((f) => f.name === "id");
      expect(idField?.type).toBe("number");

      const nameField = schemas[0].fields.find((f) => f.name === "name");
      expect(nameField?.type).toBe("string");

      const emailField = schemas[0].fields.find((f) => f.name === "email");
      expect(emailField?.type).toBe("string");
      expect(emailField?.format).toBe("email");

      const createdAtField = schemas[0].fields.find((f) => f.name === "createdAt");
      expect(createdAtField?.type).toBe("date");
      expect(createdAtField?.format).toBe("date");

      const activeField = schemas[0].fields.find((f) => f.name === "active");
      expect(activeField?.type).toBe("boolean");
    });
  });

  describe("edge cases", () => {
    it("handles empty routes array", () => {
      const schemas = infer([]);
      expect(schemas).toEqual([]);
    });

    it("handles routes with no examples", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas).toEqual([]);
    });

    it("handles routes with null response", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: null }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas).toEqual([]);
    });

    it("handles routes with empty array response", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [] }],
        }),
      ];

      const schemas = infer(routes);

      expect(schemas).toEqual([]);
    });

    it("stores example values", () => {
      const routes: APIRoute[] = [
        createRoute({
          path: "/api/users",
          examples: [{ response: [{ id: 42, name: "Alice" }] }],
        }),
      ];

      const schemas = infer(routes);

      const idField = schemas[0].fields.find((f) => f.name === "id");
      expect(idField?.example).toBe(42);

      const nameField = schemas[0].fields.find((f) => f.name === "name");
      expect(nameField?.example).toBe("Alice");
    });
  });
});
