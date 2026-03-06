# MCP HTTP Transport

HTTP/SSE transport layer for the MCP server, enabling external AI clients to connect via HTTP.

## ⚠️ External Integration

**USE WEB SEARCH** for documentation on:
- Search: "MCP SDK HTTP transport typescript 2025"
- Search: "@modelcontextprotocol/sdk SSE server-sent events"
- Search: "Express SSE streaming response typescript"
- Search: "MCP JSON-RPC protocol specification"

**Reference existing implementation**: Study `packages/core/src/mcp-server.ts` for current stdio transport.

## Purpose

The existing MCP server uses stdio transport, which only works for CLI-launched tools. External AI clients like Cursor need HTTP-based connections. This spec adds HTTP/SSE transport support.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT (stdio only)                          │
│                                                                  │
│  CLI Tool ──stdin/stdout──▶ McpServer                           │
│                             └── StdioServerTransport             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                              ▼

┌─────────────────────────────────────────────────────────────────┐
│                    NEW (stdio + HTTP)                            │
│                                                                  │
│  CLI Tool ──stdin/stdout──▶ McpServer                           │
│                             ├── StdioServerTransport             │
│                             │                                    │
│  Cursor ────HTTP/SSE──────▶ └── HttpServerTransport (NEW)       │
│  Claude                                                          │
│  Other MCP Clients                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] HTTP transport created as Express router
- [ ] SSE endpoint for server-to-client events (`GET /mcp/:sandboxId`)
- [ ] JSON-RPC endpoint for tool calls (`POST /mcp/:sandboxId`)
- [ ] Follows MCP JSON-RPC protocol format
- [ ] Supports `tools/list` method
- [ ] Supports `tools/call` method
- [ ] Connection keep-alive with heartbeat
- [ ] Proper error responses with MCP error codes

## Interface

```typescript
// packages/core/src/mcp-http-transport.ts

import { Router } from "express";

// ==================== CONFIGURATION ====================

export interface HttpTransportConfig {
  /**
   * Resolve sandbox info from sandboxId.
   * Return null if sandbox doesn't exist.
   */
  sandboxResolver: (sandboxId: string) => Promise<SandboxInfo | null>;
  
  /**
   * Validate API key. Return true if valid.
   * If not provided, all requests are allowed.
   */
  apiKeyValidator?: (apiKey: string) => Promise<boolean>;
  
  /**
   * Tool registry with available tools.
   */
  toolRegistry: ToolRegistry;
  
  /**
   * Called when a tool is invoked (for logging).
   */
  onToolCall?: (event: ToolCallEvent) => void;
}

export interface SandboxInfo {
  sandboxPath: string;
  containerId?: string;
  status: "running" | "stopped" | "error";
}

export interface ToolCallEvent {
  sandboxId: string;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: Date;
}

// ==================== TOOL REGISTRY ====================

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface ToolRegistry {
  getToolDefinitions(): ToolDefinition[];
  executeTool(
    name: string,
    args: Record<string, unknown>,
    context: { sandboxPath: string; containerId?: string }
  ): Promise<{ success: boolean; output: string }>;
}

// ==================== FACTORY ====================

/**
 * Create an Express router for MCP HTTP transport.
 */
export function createMcpRouter(config: HttpTransportConfig): Router;
```

## HTTP Endpoints

```
┌────────────────────────────────────────────────────────────────┐
│ GET /mcp/:sandboxId                                             │
│                                                                 │
│ SSE endpoint for server-to-client events.                       │
│                                                                 │
│ Headers:                                                        │
│   x-api-key: cry_xxxxxxxxxxxx                                   │
│                                                                 │
│ Response: text/event-stream                                     │
│   event: connected                                              │
│   data: {"sandboxId": "abc123"}                                │
│                                                                 │
│   :keepalive (every 15s)                                        │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ POST /mcp/:sandboxId                                            │
│                                                                 │
│ JSON-RPC endpoint for MCP requests.                             │
│                                                                 │
│ Headers:                                                        │
│   Content-Type: application/json                                │
│   x-api-key: cry_xxxxxxxxxxxx                                   │
│                                                                 │
│ Request Body (tools/list):                                      │
│   {                                                             │
│     "jsonrpc": "2.0",                                          │
│     "id": 1,                                                    │
│     "method": "tools/list"                                      │
│   }                                                             │
│                                                                 │
│ Response:                                                       │
│   {                                                             │
│     "jsonrpc": "2.0",                                          │
│     "id": 1,                                                    │
│     "result": {                                                 │
│       "tools": [...]                                            │
│     }                                                           │
│   }                                                             │
│                                                                 │
│ Request Body (tools/call):                                      │
│   {                                                             │
│     "jsonrpc": "2.0",                                          │
│     "id": 2,                                                    │
│     "method": "tools/call",                                     │
│     "params": {                                                 │
│       "name": "sandbox_read_file",                              │
│       "arguments": { "path": "src/App.tsx" }                    │
│     }                                                           │
│   }                                                             │
│                                                                 │
│ Response:                                                       │
│   {                                                             │
│     "jsonrpc": "2.0",                                          │
│     "id": 2,                                                    │
│     "result": {                                                 │
│       "content": [{ "type": "text", "text": "..." }],          │
│       "isError": false                                          │
│     }                                                           │
│   }                                                             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ GET /mcp/:sandboxId/tools                                       │
│                                                                 │
│ Convenience endpoint to list available tools.                   │
│                                                                 │
│ Response:                                                       │
│   { "tools": [...] }                                            │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

## MCP Error Codes

```typescript
const MCP_ERRORS = {
  PARSE_ERROR: -32700,      // Invalid JSON
  INVALID_REQUEST: -32600,  // Not valid JSON-RPC
  METHOD_NOT_FOUND: -32601, // Unknown method
  INVALID_PARAMS: -32602,   // Invalid method params
  INTERNAL_ERROR: -32603,   // Internal error
  
  // Custom errors (application-defined)
  AUTH_ERROR: -32000,       // Invalid API key
  SANDBOX_NOT_FOUND: -32001, // Sandbox doesn't exist
  TOOL_NOT_FOUND: -32002,   // Tool doesn't exist
  TOOL_ERROR: -32003,       // Tool execution failed
};
```

## Implementation

```typescript
// packages/core/src/mcp-http-transport.ts

import { Router, Request, Response, NextFunction } from "express";

export function createMcpRouter(config: HttpTransportConfig): Router {
  const router = Router();
  
  // ==================== MIDDLEWARE ====================
  
  // API key validation
  const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (!config.apiKeyValidator) {
      return next();
    }
    
    const apiKey = req.headers["x-api-key"] as string;
    
    if (!apiKey) {
      return res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Missing API key" },
      });
    }
    
    const valid = await config.apiKeyValidator(apiKey);
    if (!valid) {
      return res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Invalid API key" },
      });
    }
    
    next();
  };
  
  // Sandbox resolution
  const sandboxMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const { sandboxId } = req.params;
    
    const sandbox = await config.sandboxResolver(sandboxId);
    if (!sandbox) {
      return res.status(404).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: `Sandbox '${sandboxId}' not found` },
      });
    }
    
    // Attach to request
    (req as any).sandbox = sandbox;
    (req as any).sandboxId = sandboxId;
    
    next();
  };
  
  // Apply middleware
  router.use("/:sandboxId", authMiddleware, sandboxMiddleware);
  
  // ==================== SSE ENDPOINT ====================
  
  router.get("/:sandboxId", (req: Request, res: Response) => {
    const sandboxId = (req as any).sandboxId;
    
    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    
    // Send connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ sandboxId })}\n\n`);
    
    // Keep-alive heartbeat
    const heartbeat = setInterval(() => {
      res.write(":keepalive\n\n");
    }, 15000);
    
    // Cleanup on disconnect
    req.on("close", () => {
      clearInterval(heartbeat);
    });
  });
  
  // ==================== JSON-RPC ENDPOINT ====================
  
  router.post("/:sandboxId", async (req: Request, res: Response) => {
    const sandboxId = (req as any).sandboxId;
    const sandbox = (req as any).sandbox as SandboxInfo;
    const { jsonrpc, id, method, params } = req.body;
    
    // Validate JSON-RPC format
    if (jsonrpc !== "2.0") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: id ?? null,
        error: { code: -32600, message: "Invalid JSON-RPC version" },
      });
    }
    
    try {
      switch (method) {
        case "tools/list": {
          const tools = config.toolRegistry.getToolDefinitions();
          return res.json({
            jsonrpc: "2.0",
            id,
            result: { tools },
          });
        }
        
        case "tools/call": {
          const { name, arguments: args = {} } = params || {};
          
          if (!name) {
            return res.status(400).json({
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: "Missing tool name" },
            });
          }
          
          // Log tool call
          if (config.onToolCall) {
            config.onToolCall({
              sandboxId,
              toolName: name,
              input: args,
              timestamp: new Date(),
            });
          }
          
          // Execute tool
          const result = await config.toolRegistry.executeTool(
            name,
            args,
            {
              sandboxPath: sandbox.sandboxPath,
              containerId: sandbox.containerId,
            }
          );
          
          return res.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: result.output }],
              isError: !result.success,
            },
          });
        }
        
        default:
          return res.status(400).json({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Unknown method: ${method}` },
          });
      }
    } catch (error) {
      return res.status(500).json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      });
    }
  });
  
  // ==================== CONVENIENCE ENDPOINT ====================
  
  router.get("/:sandboxId/tools", (req: Request, res: Response) => {
    const tools = config.toolRegistry.getToolDefinitions();
    res.json({ tools });
  });
  
  return router;
}
```

## Tool Registry Implementation

```typescript
// packages/core/src/mcp-tool-registry.ts

import {
  readFile,
  writeFile,
  editFile,
  listFiles,
  runBuild,
  CODE_TOOL_DEFINITIONS,
  type CodeToolContext,
} from "./mcp-code-tools.js";

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, {
    definition: ToolDefinition;
    execute: (args: Record<string, unknown>, context: CodeToolContext) => Promise<ToolResult>;
  }>();
  
  // Register code tools
  tools.set("sandbox_read_file", {
    definition: CODE_TOOL_DEFINITIONS[0],
    execute: (args, ctx) => readFile(args as any, ctx),
  });
  
  tools.set("sandbox_write_file", {
    definition: CODE_TOOL_DEFINITIONS[1],
    execute: (args, ctx) => writeFile(args as any, ctx),
  });
  
  tools.set("sandbox_edit_file", {
    definition: CODE_TOOL_DEFINITIONS[2],
    execute: (args, ctx) => editFile(args as any, ctx),
  });
  
  tools.set("sandbox_list_files", {
    definition: CODE_TOOL_DEFINITIONS[3],
    execute: (args, ctx) => listFiles(args as any, ctx),
  });
  
  tools.set("sandbox_run_build", {
    definition: CODE_TOOL_DEFINITIONS[4],
    execute: (args, ctx) => runBuild(args as any, ctx),
  });
  
  return {
    getToolDefinitions() {
      return Array.from(tools.values()).map(t => t.definition);
    },
    
    async executeTool(name, args, context) {
      const tool = tools.get(name);
      if (!tool) {
        return {
          success: false,
          output: `Unknown tool: ${name}`,
        };
      }
      
      return tool.execute(args, context);
    },
  };
}
```

## Dependencies

Add to `packages/core/package.json`:

```json
{
  "dependencies": {
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21"
  }
}
```

## Testing Requirements

### Unit Tests (`mcp-http-transport.test.ts`)

```typescript
import request from "supertest";
import express from "express";

describe("MCP HTTP Transport", () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
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
  });
  
  describe("Authentication", () => {
    test("allows requests when no validator configured", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
      
      expect(res.status).toBe(200);
    });
    
    test("rejects missing API key when validator configured", async () => {
      // Reconfigure with validator
      const validatorApp = express();
      validatorApp.use(express.json());
      validatorApp.use("/mcp", createMcpRouter({
        sandboxResolver: async () => ({ sandboxPath: "/tmp", status: "running" }),
        apiKeyValidator: async (key) => key === "valid-key",
        toolRegistry: createMockToolRegistry(),
      }));
      
      const res = await request(validatorApp)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
      
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(-32000);
    });
  });
  
  describe("Sandbox Resolution", () => {
    test("returns 404 for unknown sandbox", async () => {
      const res = await request(app)
        .post("/mcp/unknown-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
      
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(-32001);
    });
  });
  
  describe("tools/list", () => {
    test("returns tool definitions", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
      
      expect(res.status).toBe(200);
      expect(res.body.result.tools).toBeInstanceOf(Array);
      expect(res.body.result.tools.length).toBeGreaterThan(0);
    });
  });
  
  describe("tools/call", () => {
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
      expect(res.body.result.content).toBeInstanceOf(Array);
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
    });
  });
  
  describe("JSON-RPC validation", () => {
    test("rejects invalid jsonrpc version", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "1.0", id: 1, method: "tools/list" });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32600);
    });
    
    test("rejects unknown method", async () => {
      const res = await request(app)
        .post("/mcp/test-sandbox")
        .send({ jsonrpc: "2.0", id: 1, method: "unknown/method" });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32601);
    });
  });
  
  describe("SSE endpoint", () => {
    test("returns event stream content type", async () => {
      const res = await request(app).get("/mcp/test-sandbox");
      
      expect(res.headers["content-type"]).toContain("text/event-stream");
    });
  });
});
```

## Definition of Done

- [ ] `createMcpRouter()` factory function implemented
- [ ] SSE endpoint with connection event and heartbeat
- [ ] JSON-RPC endpoint handles tools/list and tools/call
- [ ] API key validation middleware works
- [ ] Sandbox resolution middleware works
- [ ] Proper MCP error codes returned
- [ ] Tool registry integration works
- [ ] Unit tests pass
- [ ] Express dependency added to package.json
