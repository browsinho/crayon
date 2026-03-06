# MCP Server Application

Standalone HTTP server application that exposes sandbox manipulation via MCP protocol.

## ⚠️ External Integration

**USE WEB SEARCH** for documentation on:
- Search: "Cursor MCP server configuration 2025"
- Search: "Claude Desktop MCP setup"
- Search: "Express.js production deployment"

**Dependencies**: Requires `38-mcp-code-tools.md` and `39-mcp-http-transport.md` to be implemented first.

## Purpose

Creates a standalone application at `apps/mcp-server/` that runs the MCP HTTP server. External AI clients (Cursor, Claude Desktop) connect to this server to manipulate sandbox environments.

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL CLIENTS                          │
│                                                                  │
│    Cursor IDE          Claude Desktop         Other MCP          │
│        │                    │                    │               │
│        └────────────────────┼────────────────────┘               │
│                             │                                    │
│                        HTTP :3002                                │
│                             ▼                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│                    MCP SERVER APP                                │
│              apps/mcp-server/src/index.ts                        │
│                             │                                    │
│    ┌────────────────────────┼────────────────────────┐          │
│    │                 Express Server                   │          │
│    │   /health              │                         │          │
│    │   /mcp/:sandboxId ─────┼──▶ MCP HTTP Transport  │          │
│    └────────────────────────┼────────────────────────┘          │
│                             │                                    │
│    ┌────────────────────────┼────────────────────────┐          │
│    │              Tool Registry                       │          │
│    │   sandbox_read_file    │    sandbox_navigate    │          │
│    │   sandbox_write_file   │    sandbox_screenshot  │          │
│    │   sandbox_edit_file    │    sandbox_get_state   │          │
│    │   sandbox_list_files   │    sandbox_checkpoint  │          │
│    │   sandbox_run_build    │                        │          │
│    └────────────────────────┼────────────────────────┘          │
│                             │                                    │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SANDBOX INFRASTRUCTURE                        │
│                                                                  │
│   SandboxManager     DevContainerManager     Filesystem          │
│   (Docker API)       (Volume Mounts)         (./data/projects)  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Application runs on port 3002 (configurable via MCP_PORT)
- [ ] Health check endpoint at `/health`
- [ ] MCP endpoints at `/mcp/:sandboxId`
- [ ] API key authentication working
- [ ] Resolves sandbox paths from project data directory
- [ ] Gets container ID from SandboxManager
- [ ] Logs all tool calls
- [ ] Graceful shutdown on SIGTERM
- [ ] Can be started with `npm run dev` or `npm start`

## Project Structure

```
apps/mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Entry point
│   ├── config.ts          # Configuration
│   ├── sandbox-resolver.ts # Sandbox path/container resolution
│   └── api-keys.ts        # API key management
└── README.md
```

## Interface

### Configuration

```typescript
// apps/mcp-server/src/config.ts

export interface McpServerAppConfig {
  port: number;           // Default: 3002
  host: string;           // Default: "0.0.0.0"
  dataDir: string;        // Default: "./data"
  logLevel: string;       // Default: "info"
}

export function loadConfig(): McpServerAppConfig {
  return {
    port: parseInt(process.env.MCP_PORT || "3002", 10),
    host: process.env.MCP_HOST || "0.0.0.0",
    dataDir: process.env.DATA_DIR || "./data",
    logLevel: process.env.LOG_LEVEL || "info",
  };
}
```

### Sandbox Resolver

```typescript
// apps/mcp-server/src/sandbox-resolver.ts

import { SandboxManager } from "@crayon/core";

export interface SandboxInfo {
  sandboxPath: string;
  containerId?: string;
  status: "running" | "stopped" | "error";
}

export async function resolveSandbox(
  sandboxId: string,
  dataDir: string,
  sandboxManager: SandboxManager
): Promise<SandboxInfo | null>;
```

### API Key Management

```typescript
// apps/mcp-server/src/api-keys.ts

/**
 * Validate an API key.
 * Keys must match pattern: cry_[a-zA-Z0-9]{20,}
 */
export async function validateApiKey(
  apiKey: string,
  dataDir: string
): Promise<boolean>;

/**
 * Generate a new API key for a sandbox.
 */
export async function generateApiKey(
  sandboxId: string,
  dataDir: string
): Promise<string>;

/**
 * Get or create API key for a sandbox.
 */
export async function getOrCreateApiKey(
  sandboxId: string,
  dataDir: string
): Promise<string>;
```

## Implementation

### Entry Point

```typescript
// apps/mcp-server/src/index.ts

import express from "express";
import cors from "cors";
import { createMcpRouter, createToolRegistry } from "@crayon/core";
import { createSandboxManager } from "@crayon/core";
import { loadConfig } from "./config.js";
import { resolveSandbox } from "./sandbox-resolver.js";
import { validateApiKey } from "./api-keys.js";

async function main() {
  const config = loadConfig();
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });
  
  // Initialize sandbox manager
  const sandboxManager = createSandboxManager();
  
  // Create tool registry
  const toolRegistry = createToolRegistry();
  
  // MCP routes
  const mcpRouter = createMcpRouter({
    sandboxResolver: (sandboxId) => resolveSandbox(sandboxId, config.dataDir, sandboxManager),
    apiKeyValidator: (key) => validateApiKey(key, config.dataDir),
    toolRegistry,
    onToolCall: (event) => {
      console.log(
        `[MCP] ${event.timestamp.toISOString()} - ${event.toolName} (${event.sandboxId})`
      );
    },
  });
  
  app.use("/mcp", mcpRouter);
  
  // Start server
  const server = app.listen(config.port, config.host, () => {
    console.log(`MCP Server running at http://${config.host}:${config.port}`);
    console.log(`Health: http://localhost:${config.port}/health`);
    console.log(`MCP endpoint: http://localhost:${config.port}/mcp/{sandboxId}`);
  });
  
  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("Shutting down...");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
```

### Sandbox Resolver

```typescript
// apps/mcp-server/src/sandbox-resolver.ts

import path from "node:path";
import fs from "node:fs";
import type { SandboxManager } from "@crayon/core";

export interface SandboxInfo {
  sandboxPath: string;
  containerId?: string;
  status: "running" | "stopped" | "error";
}

export async function resolveSandbox(
  sandboxId: string,
  dataDir: string,
  sandboxManager: SandboxManager
): Promise<SandboxInfo | null> {
  // Validate sandboxId format (prevent path traversal)
  if (!/^[a-zA-Z0-9_-]+$/.test(sandboxId)) {
    return null;
  }
  
  // Check if sandbox directory exists
  const sandboxPath = path.join(dataDir, "projects", sandboxId, "sandbox");
  
  if (!fs.existsSync(sandboxPath)) {
    return null;
  }
  
  // Get container status from sandbox manager
  try {
    const sandbox = await sandboxManager.getStatus(sandboxId);
    
    return {
      sandboxPath: path.resolve(sandboxPath),
      containerId: sandbox?.containerId,
      status: sandbox?.status === "running" ? "running" : "stopped",
    };
  } catch {
    // Sandbox exists but container not running
    return {
      sandboxPath: path.resolve(sandboxPath),
      status: "stopped",
    };
  }
}
```

### API Key Management

```typescript
// apps/mcp-server/src/api-keys.ts

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const API_KEY_PATTERN = /^cry_[a-zA-Z0-9]{20,}$/;

interface KeyStore {
  keys: {
    [key: string]: {
      sandboxId: string;
      createdAt: string;
      lastUsed?: string;
    };
  };
}

async function getKeysFilePath(dataDir: string): Promise<string> {
  return path.join(dataDir, "mcp-api-keys.json");
}

async function loadKeyStore(dataDir: string): Promise<KeyStore> {
  const filePath = await getKeysFilePath(dataDir);
  
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { keys: {} };
  }
}

async function saveKeyStore(dataDir: string, store: KeyStore): Promise<void> {
  const filePath = await getKeysFilePath(dataDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2));
}

export async function validateApiKey(
  apiKey: string,
  dataDir: string
): Promise<boolean> {
  if (!apiKey || !API_KEY_PATTERN.test(apiKey)) {
    return false;
  }
  
  const store = await loadKeyStore(dataDir);
  const keyInfo = store.keys[apiKey];
  
  if (!keyInfo) {
    return false;
  }
  
  // Update last used timestamp
  keyInfo.lastUsed = new Date().toISOString();
  await saveKeyStore(dataDir, store);
  
  return true;
}

export async function generateApiKey(
  sandboxId: string,
  dataDir: string
): Promise<string> {
  const randomPart = crypto.randomBytes(15).toString("base64url");
  const apiKey = `cry_${randomPart}`;
  
  const store = await loadKeyStore(dataDir);
  store.keys[apiKey] = {
    sandboxId,
    createdAt: new Date().toISOString(),
  };
  await saveKeyStore(dataDir, store);
  
  return apiKey;
}

export async function getOrCreateApiKey(
  sandboxId: string,
  dataDir: string
): Promise<string> {
  // Check for existing key file in project
  const keyFilePath = path.join(dataDir, "projects", sandboxId, ".mcp-key");
  
  try {
    const existingKey = await fs.readFile(keyFilePath, "utf-8");
    if (API_KEY_PATTERN.test(existingKey.trim())) {
      return existingKey.trim();
    }
  } catch {
    // No existing key
  }
  
  // Generate new key
  const newKey = await generateApiKey(sandboxId, dataDir);
  
  // Save to project directory
  await fs.mkdir(path.dirname(keyFilePath), { recursive: true });
  await fs.writeFile(keyFilePath, newKey);
  
  return newKey;
}
```

### Package Configuration

```json
// apps/mcp-server/package.json
{
  "name": "@crayon/mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "test": "vitest"
  },
  "dependencies": {
    "@crayon/core": "workspace:*",
    "cors": "^2.8.5",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  }
}
```

```json
// apps/mcp-server/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Cursor MCP Configuration

Users add this to their Cursor settings (`.cursor/mcp.json` or settings):

```json
{
  "mcpServers": {
    "crayon-sandbox": {
      "url": "http://localhost:3002/mcp/YOUR_SANDBOX_ID",
      "headers": {
        "x-api-key": "cry_YOUR_API_KEY"
      }
    }
  }
}
```

The MCP tab in the web app UI shows this configuration with the correct sandbox ID and API key.

## Update Web App MCP Config Action

Update `apps/web/src/lib/actions/sandbox.ts` to use real configuration:

```typescript
import { getOrCreateApiKey } from "@crayon/mcp-server/api-keys";

export async function getSandboxMcpConfig(sandboxId: string): Promise<McpConfig> {
  // Validate sandbox exists
  const sandboxPath = `./data/projects/${sandboxId}/sandbox`;
  if (!fs.existsSync(sandboxPath)) {
    throw new Error("Sandbox not found");
  }
  
  // Get or create API key
  const apiKey = await getOrCreateApiKey(sandboxId, "./data");
  
  // Build URL
  const mcpHost = process.env.MCP_SERVER_HOST || "localhost";
  const mcpPort = process.env.MCP_SERVER_PORT || "3002";
  const url = `http://${mcpHost}:${mcpPort}/mcp/${sandboxId}`;
  
  return {
    url,
    apiKey,
    tools: [
      { name: "sandbox_read_file", description: "Read a file from the sandbox" },
      { name: "sandbox_write_file", description: "Create or overwrite a file" },
      { name: "sandbox_edit_file", description: "Edit a file with find/replace" },
      { name: "sandbox_list_files", description: "List files in the sandbox" },
      { name: "sandbox_run_build", description: "Run npm build" },
    ],
  };
}
```

## Testing Requirements

### Unit Tests (`mcp-server.test.ts`)

```typescript
describe("MCP Server App", () => {
  describe("Sandbox Resolver", () => {
    test("returns null for invalid sandboxId format", async () => {
      const result = await resolveSandbox("../etc/passwd", "/data", mockManager);
      expect(result).toBeNull();
    });
    
    test("returns null for non-existent sandbox", async () => {
      const result = await resolveSandbox("nonexistent", "/data", mockManager);
      expect(result).toBeNull();
    });
    
    test("returns sandbox info for existing sandbox", async () => {
      const result = await resolveSandbox("test-project", testDataDir, mockManager);
      expect(result).not.toBeNull();
      expect(result?.sandboxPath).toContain("test-project/sandbox");
    });
  });
  
  describe("API Keys", () => {
    test("rejects invalid key format", async () => {
      const valid = await validateApiKey("invalid", testDataDir);
      expect(valid).toBe(false);
    });
    
    test("rejects unknown key", async () => {
      const valid = await validateApiKey("cry_unknownkey12345678901234", testDataDir);
      expect(valid).toBe(false);
    });
    
    test("generates valid key format", async () => {
      const key = await generateApiKey("test-sandbox", testDataDir);
      expect(key).toMatch(/^cry_[a-zA-Z0-9]{20,}$/);
    });
    
    test("validates generated key", async () => {
      const key = await generateApiKey("test-sandbox", testDataDir);
      const valid = await validateApiKey(key, testDataDir);
      expect(valid).toBe(true);
    });
  });
});
```

### Integration Tests (`mcp-server.integration.test.ts`)

```typescript
describe("MCP Server Integration", () => {
  let serverProcess: ChildProcess;
  let apiKey: string;
  
  beforeAll(async () => {
    // Start the server
    serverProcess = spawn("npm", ["run", "dev"], {
      cwd: "apps/mcp-server",
      env: { ...process.env, MCP_PORT: "3099" },
    });
    
    // Wait for server to be ready
    await waitForServer("http://localhost:3099/health");
    
    // Create test sandbox and get API key
    apiKey = await setupTestSandbox();
  });
  
  afterAll(async () => {
    serverProcess.kill();
    await cleanupTestSandbox();
  });
  
  test("health check returns ok", async () => {
    const res = await fetch("http://localhost:3099/health");
    const data = await res.json();
    
    expect(data.status).toBe("ok");
  });
  
  test("lists tools for sandbox", async () => {
    const res = await fetch("http://localhost:3099/mcp/test-sandbox", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });
    
    const data = await res.json();
    expect(data.result.tools.length).toBeGreaterThan(0);
  });
  
  test("executes read_file tool", async () => {
    const res = await fetch("http://localhost:3099/mcp/test-sandbox", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "sandbox_list_files",
          arguments: {},
        },
      }),
    });
    
    const data = await res.json();
    expect(data.result.content[0].text).toContain("src/");
  });
});
```

## Definition of Done

- [ ] `apps/mcp-server/` application created
- [ ] Server starts on port 3002
- [ ] Health check endpoint works
- [ ] Sandbox resolution validates ID and checks existence
- [ ] API key generation and validation work
- [ ] MCP endpoints integrated with transport from spec 39
- [ ] Tool calls logged to console
- [ ] Graceful shutdown on SIGTERM
- [ ] Web app `getSandboxMcpConfig()` returns real data
- [ ] README with usage instructions
- [ ] Unit tests pass
- [ ] Integration tests pass
