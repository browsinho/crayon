import { describe, it, expect } from "vitest";
import {
  FileNodeSchema,
  TableRowSchema,
  TableColumnSchema,
  McpToolSchema,
  McpConfigSchema,
  LogEntrySchema,
} from "./types";

describe("Sandbox Types Validation", () => {
  describe("FileNodeSchema", () => {
    it("should validate a file node", () => {
      const file = {
        name: "page.tsx",
        path: "src/app/page.tsx",
        type: "file",
      };

      const result = FileNodeSchema.safeParse(file);
      expect(result.success).toBe(true);
    });

    it("should validate a directory node with children", () => {
      const directory = {
        name: "src",
        path: "src",
        type: "directory",
        children: [
          {
            name: "index.ts",
            path: "src/index.ts",
            type: "file",
          },
        ],
      };

      const result = FileNodeSchema.safeParse(directory);
      expect(result.success).toBe(true);
    });

    it("should reject invalid type", () => {
      const invalid = {
        name: "file.txt",
        path: "file.txt",
        type: "invalid",
      };

      const result = FileNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("TableRowSchema", () => {
    it("should validate a table row", () => {
      const row = {
        id: "1",
        data: { name: "Test", price: 29.99 },
      };

      const result = TableRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    });

    it("should reject row without id", () => {
      const invalid = {
        data: { name: "Test" },
      };

      const result = TableRowSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("TableColumnSchema", () => {
    it("should validate a table column", () => {
      const column = {
        name: "price",
        type: "number",
      };

      const result = TableColumnSchema.safeParse(column);
      expect(result.success).toBe(true);
    });
  });

  describe("McpToolSchema", () => {
    it("should validate an MCP tool", () => {
      const tool = {
        name: "navigate",
        description: "Navigate to a URL",
      };

      const result = McpToolSchema.safeParse(tool);
      expect(result.success).toBe(true);
    });
  });

  describe("McpConfigSchema", () => {
    it("should validate MCP config", () => {
      const config = {
        url: "http://localhost:3002/mcp",
        apiKey: "sk-test-key",
        tools: [
          { name: "click", description: "Click on element" },
          { name: "type", description: "Type text" },
        ],
      };

      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should allow empty tools array", () => {
      const config = {
        url: "http://localhost:3002/mcp",
        apiKey: "sk-test-key",
        tools: [],
      };

      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe("LogEntrySchema", () => {
    it("should validate a log entry", () => {
      const log = {
        timestamp: "12:34:56",
        message: "Server started",
        level: "info",
      };

      const result = LogEntrySchema.safeParse(log);
      expect(result.success).toBe(true);
    });

    it("should validate log entry without level", () => {
      const log = {
        timestamp: "12:34:56",
        message: "Server started",
      };

      const result = LogEntrySchema.safeParse(log);
      expect(result.success).toBe(true);
    });

    it("should validate error level", () => {
      const log = {
        timestamp: "12:34:56",
        message: "Connection failed",
        level: "error",
      };

      const result = LogEntrySchema.safeParse(log);
      expect(result.success).toBe(true);
    });

    it("should reject invalid level", () => {
      const log = {
        timestamp: "12:34:56",
        message: "Test",
        level: "invalid",
      };

      const result = LogEntrySchema.safeParse(log);
      expect(result.success).toBe(false);
    });
  });
});
