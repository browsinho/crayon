import { describe, expect, it } from "vitest";
import {
  parseCommand,
  parseValue,
  validateCommand,
  generateRecord,
  process,
  createMockDataProvider,
  PromptModifierError,
} from "./prompt-modifier.js";

describe("parseCommand", () => {
  describe("create/add patterns", () => {
    it("parses 'add N entity' pattern", () => {
      const result = parseCommand("add 10 emails");
      expect(result).toEqual({
        type: "create",
        entity: "emails",
        count: 10,
      });
    });

    it("parses 'create N entity' pattern", () => {
      const result = parseCommand("create 5 users");
      expect(result).toEqual({
        type: "create",
        entity: "users",
        count: 5,
      });
    });

    it("is case-insensitive", () => {
      const result = parseCommand("ADD 3 Products");
      expect(result).toEqual({
        type: "create",
        entity: "Products",
        count: 3,
      });
    });

    it("handles large counts", () => {
      const result = parseCommand("add 1000 items");
      expect(result).toEqual({
        type: "create",
        entity: "items",
        count: 1000,
      });
    });

    it("throws on zero count", () => {
      expect(() => parseCommand("add 0 users")).toThrow(PromptModifierError);
      expect(() => parseCommand("add 0 users")).toThrow("Count must be a positive number");
    });

    it("throws on count exceeding limit", () => {
      expect(() => parseCommand("add 1001 users")).toThrow(PromptModifierError);
      expect(() => parseCommand("add 1001 users")).toThrow("Count cannot exceed 1000");
    });
  });

  describe("delete patterns", () => {
    it("parses 'delete all entity' pattern", () => {
      const result = parseCommand("delete all users");
      expect(result).toEqual({
        type: "delete",
        entity: "users",
      });
    });

    it("parses 'delete entity where field=value' pattern", () => {
      const result = parseCommand("delete users where role=guest");
      expect(result).toEqual({
        type: "delete",
        entity: "users",
        where: {
          field: "role",
          value: "guest",
        },
      });
    });

    it("handles spaces around equals sign", () => {
      const result = parseCommand("delete users where role = guest");
      expect(result).toEqual({
        type: "delete",
        entity: "users",
        where: {
          field: "role",
          value: "guest",
        },
      });
    });

    it("is case-insensitive for keywords", () => {
      const result = parseCommand("DELETE ALL Users");
      expect(result).toEqual({
        type: "delete",
        entity: "Users",
      });
    });
  });

  describe("update patterns", () => {
    it("parses 'update entity set field=value' pattern", () => {
      const result = parseCommand("update users set active=false");
      expect(result).toEqual({
        type: "update",
        entity: "users",
        set: {
          field: "active",
          value: "false",
        },
      });
    });

    it("parses 'update entity set field=value where field=value' pattern", () => {
      const result = parseCommand("update users set active=false where role=guest");
      expect(result).toEqual({
        type: "update",
        entity: "users",
        set: {
          field: "active",
          value: "false",
        },
        where: {
          field: "role",
          value: "guest",
        },
      });
    });

    it("handles spaces around equals signs", () => {
      const result = parseCommand("update users set active = true where status = pending");
      expect(result).toEqual({
        type: "update",
        entity: "users",
        set: {
          field: "active",
          value: "true",
        },
        where: {
          field: "status",
          value: "pending",
        },
      });
    });
  });

  describe("mark patterns", () => {
    it("parses 'mark all entity as field' pattern", () => {
      const result = parseCommand("mark all emails as read");
      expect(result).toEqual({
        type: "mark",
        entity: "emails",
        field: "read",
      });
    });

    it("is case-insensitive", () => {
      const result = parseCommand("MARK ALL Notifications AS seen");
      expect(result).toEqual({
        type: "mark",
        entity: "Notifications",
        field: "seen",
      });
    });
  });

  describe("error handling", () => {
    it("throws on invalid command", () => {
      expect(() => parseCommand("do something weird")).toThrow(PromptModifierError);
    });

    it("throws on empty command", () => {
      expect(() => parseCommand("")).toThrow(PromptModifierError);
    });

    it("provides helpful error message with supported patterns", () => {
      try {
        parseCommand("invalid command");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PromptModifierError);
        expect((error as PromptModifierError).message).toContain("Supported patterns");
        expect((error as PromptModifierError).code).toBe("PARSE_ERROR");
      }
    });
  });
});

describe("parseValue", () => {
  it("parses boolean true", () => {
    expect(parseValue("true")).toBe(true);
    expect(parseValue("TRUE")).toBe(true);
    expect(parseValue("True")).toBe(true);
  });

  it("parses boolean false", () => {
    expect(parseValue("false")).toBe(false);
    expect(parseValue("FALSE")).toBe(false);
    expect(parseValue("False")).toBe(false);
  });

  it("parses integers", () => {
    expect(parseValue("42")).toBe(42);
    expect(parseValue("0")).toBe(0);
    expect(parseValue("-10")).toBe(-10);
  });

  it("parses floats", () => {
    expect(parseValue("3.14")).toBe(3.14);
    expect(parseValue("-0.5")).toBe(-0.5);
  });

  it("parses double-quoted strings", () => {
    expect(parseValue('"hello world"')).toBe("hello world");
  });

  it("parses single-quoted strings", () => {
    expect(parseValue("'hello world'")).toBe("hello world");
  });

  it("returns unquoted strings as-is", () => {
    expect(parseValue("hello")).toBe("hello");
    expect(parseValue("guest")).toBe("guest");
  });
});

describe("validateCommand", () => {
  it("accepts valid entity names", () => {
    expect(() =>
      validateCommand({
        type: "create",
        entity: "users",
        count: 5,
      })
    ).not.toThrow();

    expect(() =>
      validateCommand({
        type: "create",
        entity: "user_profiles",
        count: 5,
      })
    ).not.toThrow();

    expect(() =>
      validateCommand({
        type: "create",
        entity: "User123",
        count: 5,
      })
    ).not.toThrow();
  });

  it("rejects invalid entity names", () => {
    expect(() =>
      validateCommand({
        type: "create",
        entity: "123users",
        count: 5,
      })
    ).toThrow(PromptModifierError);

    expect(() =>
      validateCommand({
        type: "create",
        entity: "user-profiles",
        count: 5,
      })
    ).toThrow(PromptModifierError);
  });

  it("validates field names in update commands", () => {
    expect(() =>
      validateCommand({
        type: "update",
        entity: "users",
        set: { field: "active", value: "true" },
      })
    ).not.toThrow();

    expect(() =>
      validateCommand({
        type: "update",
        entity: "users",
        set: { field: "123invalid", value: "true" },
      })
    ).toThrow(PromptModifierError);
  });

  it("validates field names in mark commands", () => {
    expect(() =>
      validateCommand({
        type: "mark",
        entity: "emails",
        field: "read",
      })
    ).not.toThrow();

    expect(() =>
      validateCommand({
        type: "mark",
        entity: "emails",
        field: "has-read",
      })
    ).toThrow(PromptModifierError);
  });

  it("validates where clause field names", () => {
    expect(() =>
      validateCommand({
        type: "delete",
        entity: "users",
        where: { field: "role", value: "guest" },
      })
    ).not.toThrow();

    expect(() =>
      validateCommand({
        type: "delete",
        entity: "users",
        where: { field: "user-role", value: "guest" },
      })
    ).toThrow(PromptModifierError);
  });
});

describe("generateRecord", () => {
  it("generates email records with expected fields", () => {
    const record = generateRecord("email");
    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("from");
    expect(record).toHaveProperty("to");
    expect(record).toHaveProperty("subject");
    expect(record).toHaveProperty("body");
    expect(record).toHaveProperty("read");
    expect(typeof record.read).toBe("boolean");
  });

  it("generates user records with expected fields", () => {
    const record = generateRecord("user");
    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("name");
    expect(record).toHaveProperty("email");
    expect(record).toHaveProperty("username");
  });

  it("handles plural entity names", () => {
    const emailRecord = generateRecord("emails");
    expect(emailRecord).toHaveProperty("from");

    const userRecord = generateRecord("users");
    expect(userRecord).toHaveProperty("email");
  });

  it("generates generic records for unknown entities", () => {
    const record = generateRecord("unknown_entity");
    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("name");
    expect(record).toHaveProperty("description");
    expect(record).toHaveProperty("createdAt");
  });

  it("generates product records with realistic data", () => {
    const record = generateRecord("product");
    expect(record).toHaveProperty("name");
    expect(record).toHaveProperty("price");
    expect(typeof record.price).toBe("number");
    expect(record.price).toBeGreaterThan(0);
  });

  it("generates unique ids for each record", () => {
    const ids = new Set<unknown>();
    for (let i = 0; i < 100; i++) {
      const record = generateRecord("user");
      ids.add(record.id);
    }
    expect(ids.size).toBe(100);
  });
});

describe("process", () => {
  describe("create operations", () => {
    it("creates records via data provider", async () => {
      const provider = createMockDataProvider();

      const result = await process("add 5 emails", "sandbox-1", provider);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toEqual({
        entity: "emails",
        operation: "create",
        count: 5,
      });
      expect(provider.getData().emails).toHaveLength(5);
    });

    it("generates realistic faker data", async () => {
      const provider = createMockDataProvider();

      await process("add 3 users", "sandbox-1", provider);

      const users = provider.getData().users;
      expect(users).toHaveLength(3);
      for (const user of users) {
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect((user.email as string)).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
    });
  });

  describe("delete operations", () => {
    it("deletes all records", async () => {
      const provider = createMockDataProvider();
      provider.setData("users", [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
        { id: "3", name: "Charlie" },
      ]);

      const result = await process("delete all users", "sandbox-1", provider);

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        entity: "users",
        operation: "delete",
        count: 3,
      });
      expect(provider.getData().users).toHaveLength(0);
    });

    it("deletes records matching where clause", async () => {
      const provider = createMockDataProvider();
      provider.setData("users", [
        { id: "1", name: "Alice", role: "admin" },
        { id: "2", name: "Bob", role: "guest" },
        { id: "3", name: "Charlie", role: "guest" },
      ]);

      const result = await process("delete users where role=guest", "sandbox-1", provider);

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        entity: "users",
        operation: "delete",
        count: 2,
      });
      expect(provider.getData().users).toHaveLength(1);
      expect(provider.getData().users[0].name).toBe("Alice");
    });
  });

  describe("update operations", () => {
    it("updates all records", async () => {
      const provider = createMockDataProvider();
      provider.setData("users", [
        { id: "1", name: "Alice", active: true },
        { id: "2", name: "Bob", active: true },
      ]);

      const result = await process("update users set active=false", "sandbox-1", provider);

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        entity: "users",
        operation: "update",
        count: 2,
      });
      for (const user of provider.getData().users) {
        expect(user.active).toBe(false);
      }
    });

    it("updates records matching where clause", async () => {
      const provider = createMockDataProvider();
      provider.setData("users", [
        { id: "1", name: "Alice", role: "admin", active: false },
        { id: "2", name: "Bob", role: "guest", active: true },
        { id: "3", name: "Charlie", role: "guest", active: true },
      ]);

      const result = await process("update users set active=false where role=guest", "sandbox-1", provider);

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        entity: "users",
        operation: "update",
        count: 2,
      });
      expect(provider.getData().users[0].active).toBe(false); // unchanged
      expect(provider.getData().users[1].active).toBe(false);
      expect(provider.getData().users[2].active).toBe(false);
    });
  });

  describe("mark operations", () => {
    it("marks all records with boolean true", async () => {
      const provider = createMockDataProvider();
      provider.setData("emails", [
        { id: "1", subject: "Hello", read: false },
        { id: "2", subject: "World", read: false },
      ]);

      const result = await process("mark all emails as read", "sandbox-1", provider);

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        entity: "emails",
        operation: "update",
        count: 2,
      });
      for (const email of provider.getData().emails) {
        expect(email.read).toBe(true);
      }
    });
  });

  describe("error handling", () => {
    it("returns error for invalid command", async () => {
      const provider = createMockDataProvider();

      const result = await process("do something invalid", "sandbox-1", provider);

      expect(result.success).toBe(false);
      expect(result.changes).toHaveLength(0);
      expect(result.error).toContain("Unable to parse command");
    });

    it("returns error for empty command", async () => {
      const provider = createMockDataProvider();

      const result = await process("", "sandbox-1", provider);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns error for empty sandboxId", async () => {
      const provider = createMockDataProvider();

      const result = await process("add 5 users", "", provider);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid input");
    });

    it("returns error for invalid entity name", async () => {
      const provider = createMockDataProvider();

      const result = await process("add 5 123invalid", "sandbox-1", provider);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid entity name");
    });
  });
});

describe("createMockDataProvider", () => {
  it("creates isolated data stores", () => {
    const provider1 = createMockDataProvider();
    const provider2 = createMockDataProvider();

    provider1.setData("users", [{ id: "1" }]);

    expect(provider1.getData().users).toHaveLength(1);
    expect(provider2.getData().users).toBeUndefined();
  });

  it("handles create operations", async () => {
    const provider = createMockDataProvider();

    await provider.create("users", { id: "1", name: "Test" });

    expect(provider.getData().users).toHaveLength(1);
    expect(provider.getData().users[0]).toEqual({ id: "1", name: "Test" });
  });

  it("handles update with where clause using correct value parsing", async () => {
    const provider = createMockDataProvider();
    provider.setData("items", [
      { id: "1", status: "active", value: 10 },
      { id: "2", status: "inactive", value: 20 },
    ]);

    const count = await provider.update("items", "value", 0, { field: "status", value: "inactive" });

    expect(count).toBe(1);
    expect(provider.getData().items[0].value).toBe(10);
    expect(provider.getData().items[1].value).toBe(0);
  });
});
