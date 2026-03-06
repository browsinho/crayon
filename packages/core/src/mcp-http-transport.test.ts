/**
 * Tests for MCP HTTP Transport
 */

import { describe, test, expect, beforeEach } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { createMcpRouter } from "./mcp-http-transport.js";
import type { ToolRegistry } from "./mcp-tool-registry.js";

// ==================== MOCKS ====================

function createMockToolRegistry(): ToolRegistry {
  return {
    getToolDefinitions() {
      return [
        {
          name: "sandbox_read_file",
          description: "Read a file",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
            },
            required: ["path"],
          },
        },
        {
          name: "sandbox_list_files",
          description: "List files",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      ];
    },

    async executeTool(name, args) {
      if (name === "sandbox_read_file") {
        return {
          success: true,
          output: `File content for: ${args.path}`,
        };
      }

      if (name === "sandbox_list_files") {
        return {
          success: true,
          output: "src/\n├── App.tsx\n└── index.tsx",
        };
      }

      return {
        success: false,
        output: `Unknown tool: ${name}`,
      };
    },
  };
}

// ==================== TESTS ====================

describe("MCP HTTP Transport", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe("Authentication", () => {
    test("allows requests when no validator configured", async () => {
      const router = createMcpRouter({
        sandboxResolver: async (id) => {
          if (id === "test-sandbox") {
            return { sandboxPath: "/tmp/test", status: "running" };
          }
          return null;
        },
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);

      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

      expect(res.status).toBe(200);
      expect(res.body.result).toBeDefined();
    });

    test("rejects missing API key when validator configured", async () => {
      const router = createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        apiKeyValidator: async (key) => key === "valid-key",
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);

      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(-32000);
      expect(res.body.error.message).toContain("Missing API key");
    });

    test("rejects invalid API key", async () => {
      const router = createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        apiKeyValidator: async (key) => key === "valid-key",
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);

      const res = await request(app)
        .post("/mcp/test-sandbox")
        .set("x-api-key", "invalid-key")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(-32000);
      expect(res.body.error.message).toContain("Invalid API key");
    });

    test("accepts valid API key", async () => {
      const router = createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        apiKeyValidator: async (key) => key === "valid-key",
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);

      const res = await request(app)
        .post("/mcp/test-sandbox")
        .set("x-api-key", "valid-key")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

      expect(res.status).toBe(200);
      expect(res.body.result).toBeDefined();
    });
  });

  describe("Sandbox Resolution", () => {
    test("returns 404 for unknown sandbox", async () => {
      const router = createMcpRouter({
        sandboxResolver: async (id) => {
          if (id === "test-sandbox") {
            return { sandboxPath: "/tmp/test", status: "running" };
          }
          return null;
        },
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);

      const res = await request(app)
        .post("/mcp/unknown-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(-32001);
      expect(res.body.error.message).toContain("not found");
    });

    test("resolves existing sandbox", async () => {
      const router = createMcpRouter({
        sandboxResolver: async (id) => {
          if (id === "test-sandbox") {
            return { sandboxPath: "/tmp/test", status: "running" };
          }
          return null;
        },
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);

      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

      expect(res.status).toBe(200);
    });
  });

  describe("tools/list", () => {
    beforeEach(() => {
      const router = createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);
    });

    test("returns tool definitions", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

      expect(res.status).toBe(200);
      expect(res.body.jsonrpc).toBe("2.0");
      expect(res.body.id).toBe(1);
      expect(res.body.result.tools).toBeInstanceOf(Array);
      expect(res.body.result.tools.length).toBeGreaterThan(0);
      expect(res.body.result.tools[0].name).toBe("sandbox_read_file");
    });
  });

  describe("tools/call", () => {
    beforeEach(() => {
      const router = createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);
    });

    test("executes tool and returns result", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "sandbox_list_files", arguments: {} },
        });

      expect(res.status).toBe(200);
      expect(res.body.jsonrpc).toBe("2.0");
      expect(res.body.id).toBe(1);
      expect(res.body.result.content).toBeInstanceOf(Array);
      expect(res.body.result.content[0].type).toBe("text");
      expect(res.body.result.content[0].text).toContain("src/");
      expect(res.body.result.isError).toBe(false);
    });

    test("passes arguments to tool", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "sandbox_read_file",
            arguments: { path: "src/App.tsx" },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.result.content[0].text).toContain("src/App.tsx");
    });

    test("returns error for missing tool name", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { arguments: {} },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32602);
      expect(res.body.error.message).toContain("Missing tool name");
    });

    test("returns error for unknown tool", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "unknown_tool", arguments: {} },
        });

      expect(res.body.result.isError).toBe(true);
      expect(res.body.result.content[0].text).toContain("Unknown tool");
    });

    test("calls onToolCall callback when provided", async () => {
      let callbackCalled = false;
      let callbackData: {
        sandboxId?: string;
        toolName?: string;
        input?: Record<string, unknown>;
        timestamp?: Date;
      } | null = null;

      const router = createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        toolRegistry: createMockToolRegistry(),
        onToolCall: (event) => {
          callbackCalled = true;
          callbackData = event;
        },
      });

      const callbackApp = express();
      callbackApp.use(express.json());
      callbackApp.use("/mcp", router);

      await request(callbackApp)
        .post("/mcp/test-sandbox")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "sandbox_read_file",
            arguments: { path: "test.txt" },
          },
        });

      expect(callbackCalled).toBe(true);
      expect(callbackData?.sandboxId).toBe("test-sandbox");
      expect(callbackData?.toolName).toBe("sandbox_read_file");
      expect(callbackData?.input).toEqual({ path: "test.txt" });
      expect(callbackData?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("JSON-RPC validation", () => {
    beforeEach(() => {
      const router = createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);
    });

    test("rejects invalid jsonrpc version", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "1.0", id: 1, method: "tools/list" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32600);
      expect(res.body.error.message).toContain("Invalid JSON-RPC version");
    });

    test("rejects unknown method", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "unknown/method" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32601);
      expect(res.body.error.message).toContain("Unknown method");
    });

    test("handles string id", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: "request-123", method: "tools/list" });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("request-123");
    });

    test("handles null id", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: null, method: "tools/list" });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(null);
    });
  });

  describe("SSE endpoint", () => {
    beforeEach(() => {
      const router = createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);
    });

    test("returns event stream headers", () => {
      return new Promise<void>((resolve, reject) => {
        request(app)
          .get("/mcp/test-sandbox")
          .parse((res, callback) => {
            // Parse only headers, don't wait for body
            let data = '';
            res.on('data', (chunk) => {
              data += chunk.toString();
              // Once we get some initial data, check headers and abort
              if (data.length > 0) {
                try {
                  expect(res.headers["content-type"]).toContain("text/event-stream");
                  expect(res.headers["cache-control"]).toBe("no-cache");
                  expect(res.headers["connection"]).toBe("keep-alive");
                  res.destroy(); // Close the connection
                  callback(null, data);
                } catch (err) {
                  reject(err);
                }
              }
            });
          })
          .end((err) => {
            // Test completes when connection is closed
            if (err) reject(err);
            else resolve();
          });
      });
    });

    test("sends connected event", () => {
      return new Promise<void>((resolve, reject) => {
        request(app)
          .get("/mcp/test-sandbox")
          .parse((res, callback) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk.toString();
              // Once we get the connected event, check and abort
              if (data.includes('event: connected')) {
                try {
                  expect(data).toContain("event: connected");
                  expect(data).toContain('"sandboxId":"test-sandbox"');
                  res.destroy(); // Close the connection
                  callback(null, data);
                } catch (err) {
                  reject(err);
                }
              }
            });
          })
          .end((err) => {
            if (err) reject(err);
            else resolve();
          });
      });
    });
  });

  describe("Convenience endpoint", () => {
    beforeEach(() => {
      const router = createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        toolRegistry: createMockToolRegistry(),
      });

      app.use("/mcp", router);
    });

    test("returns tool list", async () => {
      const res = await request(app).get("/mcp/test-sandbox/tools");

      expect(res.status).toBe(200);
      expect(res.body.tools).toBeInstanceOf(Array);
      expect(res.body.tools.length).toBeGreaterThan(0);
    });
  });
});
