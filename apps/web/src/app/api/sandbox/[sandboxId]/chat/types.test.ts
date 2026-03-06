import { describe, test, expect } from "vitest";
import { ChatRequestSchema } from "./types";

describe("Chat API Types", () => {
  describe("ChatRequestSchema", () => {
    test("accepts valid request", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
        history: [],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe("Hello");
        expect(result.data.history).toEqual([]);
      }
    });

    test("accepts request without history (defaults to [])", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.history).toEqual([]);
      }
    });

    test("accepts valid history", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
        history: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hello!" },
        ],
      });
      expect(result.success).toBe(true);
    });

    test("rejects empty message", () => {
      const result = ChatRequestSchema.safeParse({
        message: "",
        history: [],
      });
      expect(result.success).toBe(false);
    });

    test("rejects message over limit", () => {
      const result = ChatRequestSchema.safeParse({
        message: "x".repeat(10001),
        history: [],
      });
      expect(result.success).toBe(false);
    });

    test("rejects too much history", () => {
      const history = Array(51)
        .fill(null)
        .map(() => ({ role: "user" as const, content: "msg" }));
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
        history,
      });
      expect(result.success).toBe(false);
    });

    test("rejects invalid role in history", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
        history: [{ role: "system", content: "test" }],
      });
      expect(result.success).toBe(false);
    });

    test("rejects missing message field", () => {
      const result = ChatRequestSchema.safeParse({
        history: [],
      });
      expect(result.success).toBe(false);
    });
  });
});
