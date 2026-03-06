import { describe, expect, it, beforeEach } from "vitest";
import { process, createMockDataProvider, type DataProvider } from "./prompt-modifier.js";

describe("prompt-modifier integration", () => {
  let provider: DataProvider & {
    getData(): Record<string, Record<string, unknown>[]>;
    setData(entity: string, records: Record<string, unknown>[]): void;
  };

  beforeEach(() => {
    provider = createMockDataProvider();
  });

  describe("add 5 emails creates 5 records in DB", () => {
    it("creates 5 email records with realistic data", async () => {
      const result = await process("add 5 emails", "sandbox-123", provider);

      expect(result.success).toBe(true);
      expect(result.changes).toEqual([
        { entity: "emails", operation: "create", count: 5 },
      ]);

      const emails = provider.getData().emails;
      expect(emails).toHaveLength(5);

      // Verify each email has realistic data
      for (const email of emails) {
        expect(email).toHaveProperty("id");
        expect(email).toHaveProperty("from");
        expect(email).toHaveProperty("to");
        expect(email).toHaveProperty("subject");
        expect(email).toHaveProperty("body");
        expect(email).toHaveProperty("read");
        expect(email).toHaveProperty("createdAt");

        // Verify email format
        expect((email.from as string)).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        expect((email.to as string)).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

        // Verify types
        expect(typeof email.id).toBe("string");
        expect(typeof email.subject).toBe("string");
        expect(typeof email.body).toBe("string");
        expect(typeof email.read).toBe("boolean");
      }
    });

    it("generates unique IDs for each email", async () => {
      await process("add 10 emails", "sandbox-123", provider);

      const emails = provider.getData().emails;
      const ids = emails.map((e) => e.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10);
    });
  });

  describe("delete all users removes records", () => {
    it("removes all user records from DB", async () => {
      // Setup: Create some users
      provider.setData("users", [
        { id: "1", name: "Alice", email: "alice@example.com" },
        { id: "2", name: "Bob", email: "bob@example.com" },
        { id: "3", name: "Charlie", email: "charlie@example.com" },
      ]);

      expect(provider.getData().users).toHaveLength(3);

      const result = await process("delete all users", "sandbox-123", provider);

      expect(result.success).toBe(true);
      expect(result.changes).toEqual([
        { entity: "users", operation: "delete", count: 3 },
      ]);

      expect(provider.getData().users).toHaveLength(0);
    });

    it("returns count of 0 when no records exist", async () => {
      const result = await process("delete all users", "sandbox-123", provider);

      expect(result.success).toBe(true);
      expect(result.changes).toEqual([
        { entity: "users", operation: "delete", count: 0 },
      ]);
    });
  });

  describe("mark all emails as read updates records", () => {
    it("sets read=true for all email records", async () => {
      // Setup: Create emails with read=false
      provider.setData("emails", [
        { id: "1", subject: "Email 1", read: false },
        { id: "2", subject: "Email 2", read: false },
        { id: "3", subject: "Email 3", read: false },
      ]);

      const result = await process("mark all emails as read", "sandbox-123", provider);

      expect(result.success).toBe(true);
      expect(result.changes).toEqual([
        { entity: "emails", operation: "update", count: 3 },
      ]);

      const emails = provider.getData().emails;
      for (const email of emails) {
        expect(email.read).toBe(true);
      }
    });

    it("marks mixed read/unread emails as read", async () => {
      provider.setData("emails", [
        { id: "1", subject: "Email 1", read: true },
        { id: "2", subject: "Email 2", read: false },
        { id: "3", subject: "Email 3", read: false },
      ]);

      const result = await process("mark all emails as read", "sandbox-123", provider);

      expect(result.success).toBe(true);
      expect(result.changes[0].count).toBe(3);

      for (const email of provider.getData().emails) {
        expect(email.read).toBe(true);
      }
    });
  });

  describe("complex workflows", () => {
    it("creates then deletes records", async () => {
      // Create users
      await process("add 10 users", "sandbox-123", provider);
      expect(provider.getData().users).toHaveLength(10);

      // Delete all
      const deleteResult = await process("delete all users", "sandbox-123", provider);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.changes[0].count).toBe(10);
      expect(provider.getData().users).toHaveLength(0);
    });

    it("creates then updates records", async () => {
      // Create emails
      await process("add 5 emails", "sandbox-123", provider);

      // All emails should have random read status from faker
      const emailsBefore = provider.getData().emails;
      expect(emailsBefore).toHaveLength(5);

      // Mark all as read
      const updateResult = await process("mark all emails as read", "sandbox-123", provider);
      expect(updateResult.success).toBe(true);
      expect(updateResult.changes[0].count).toBe(5);

      // Verify all are now read
      for (const email of provider.getData().emails) {
        expect(email.read).toBe(true);
      }
    });

    it("handles selective delete with where clause", async () => {
      provider.setData("users", [
        { id: "1", name: "Admin", role: "admin" },
        { id: "2", name: "Guest 1", role: "guest" },
        { id: "3", name: "Guest 2", role: "guest" },
        { id: "4", name: "User 1", role: "user" },
      ]);

      const result = await process("delete users where role=guest", "sandbox-123", provider);

      expect(result.success).toBe(true);
      expect(result.changes[0].count).toBe(2);

      const remainingUsers = provider.getData().users;
      expect(remainingUsers).toHaveLength(2);
      expect(remainingUsers.map((u) => u.role)).toEqual(["admin", "user"]);
    });

    it("handles selective update with where clause", async () => {
      provider.setData("users", [
        { id: "1", name: "Admin", role: "admin", active: true },
        { id: "2", name: "Guest 1", role: "guest", active: true },
        { id: "3", name: "Guest 2", role: "guest", active: true },
      ]);

      const result = await process("update users set active=false where role=guest", "sandbox-123", provider);

      expect(result.success).toBe(true);
      expect(result.changes[0].count).toBe(2);

      const users = provider.getData().users;
      expect(users[0].active).toBe(true); // admin unchanged
      expect(users[1].active).toBe(false); // guest updated
      expect(users[2].active).toBe(false); // guest updated
    });
  });

  describe("data generation quality", () => {
    it("generates products with valid prices", async () => {
      await process("add 20 products", "sandbox-123", provider);

      const products = provider.getData().products;
      expect(products).toHaveLength(20);

      for (const product of products) {
        expect(typeof product.price).toBe("number");
        expect(product.price).toBeGreaterThan(0);
        expect(product.price).toBeLessThanOrEqual(1000);
      }
    });

    it("generates orders with valid statuses", async () => {
      await process("add 10 orders", "sandbox-123", provider);

      const orders = provider.getData().orders;
      const validStatuses = ["pending", "processing", "shipped", "delivered"];

      for (const order of orders) {
        expect(validStatuses).toContain(order.status);
      }
    });

    it("generates tasks with valid priorities", async () => {
      await process("add 10 tasks", "sandbox-123", provider);

      const tasks = provider.getData().tasks;
      const validPriorities = ["low", "medium", "high"];
      const validStatuses = ["todo", "in_progress", "done"];

      for (const task of tasks) {
        expect(validPriorities).toContain(task.priority);
        expect(validStatuses).toContain(task.status);
      }
    });
  });

  describe("error scenarios in integration context", () => {
    it("handles invalid commands gracefully", async () => {
      // Setup some data
      provider.setData("users", [{ id: "1", name: "Test" }]);

      const result = await process("invalid command here", "sandbox-123", provider);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Data should remain unchanged
      expect(provider.getData().users).toHaveLength(1);
    });

    it("handles operations on empty collections", async () => {
      const result = await process("update users set active=true", "sandbox-123", provider);

      expect(result.success).toBe(true);
      expect(result.changes[0].count).toBe(0);
    });
  });

  describe("multiple sandbox isolation", () => {
    it("different sandbox operations remain isolated", async () => {
      const provider1 = createMockDataProvider();
      const provider2 = createMockDataProvider();

      await process("add 5 users", "sandbox-1", provider1);
      await process("add 3 users", "sandbox-2", provider2);

      expect(provider1.getData().users).toHaveLength(5);
      expect(provider2.getData().users).toHaveLength(3);
    });
  });
});
