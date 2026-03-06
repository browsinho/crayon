/**
 * MCP Server Integration Tests
 *
 * These tests require a running sandbox and test the MCP server
 * end-to-end with a real MCP client connection.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  McpServer,
  createMcpServer,
} from "./mcp-server.js";
import type { McpServerConfig, SandboxState } from "./mcp-server.js";
import type { SandboxManager } from "./sandbox-manager.js";
import type {
  CheckpointManager,
  BrowserStateProvider,
  DatabaseProvider,
} from "./checkpoint-manager.js";
import type { Sandbox, Checkpoint } from "@crayon/types";

// Mock implementations for integration testing
function createMockSandboxManager(): SandboxManager {
  const sandboxes = new Map<string, Sandbox>();

  // Pre-populate with a test sandbox
  sandboxes.set("test-sandbox", {
    id: "test-sandbox",
    status: "running",
    ports: { frontend: 3000, backend: 3001 },
    url: "http://localhost:3000",
  });

  return {
    start: vi.fn().mockImplementation(async (id: string) => {
      const existing = sandboxes.get(id);
      if (existing) {
        existing.status = "running";
        return existing;
      }
      const sandbox: Sandbox = {
        id,
        status: "running",
        ports: { frontend: 3000, backend: 3001 },
        url: "http://localhost:3000",
      };
      sandboxes.set(id, sandbox);
      return sandbox;
    }),
    stop: vi.fn().mockImplementation(async (id: string) => {
      const sandbox = sandboxes.get(id);
      if (sandbox) {
        sandbox.status = "stopped";
      }
    }),
    getStatus: vi.fn().mockImplementation(async (id: string) => {
      const sandbox = sandboxes.get(id);
      if (!sandbox) {
        throw new Error(`Sandbox '${id}' not found`);
      }
      return sandbox;
    }),
    list: vi.fn().mockImplementation(async () => {
      return Array.from(sandboxes.values());
    }),
  } as unknown as SandboxManager;
}

function createMockCheckpointManager(): CheckpointManager {
  const checkpoints = new Map<string, Checkpoint[]>();

  // Pre-populate with initial checkpoint
  checkpoints.set("test-sandbox", [
    {
      id: "cp-initial",
      name: "initial",
      createdAt: new Date(),
      databasePath: "/tmp/checkpoints/test-sandbox/initial/data.sqlite",
      browserState: {
        localStorage: { token: "initial-token" },
        cookies: [],
      },
    },
  ]);

  return {
    create: vi.fn().mockImplementation(
      async (sandboxId: string, name: string) => {
        const checkpoint: Checkpoint = {
          id: `cp-${Date.now()}`,
          name,
          createdAt: new Date(),
          databasePath: `/tmp/checkpoints/${sandboxId}/${name}/data.sqlite`,
          browserState: {
            localStorage: {},
            cookies: [],
          },
        };
        const list = checkpoints.get(sandboxId) ?? [];
        list.push(checkpoint);
        checkpoints.set(sandboxId, list);
        return checkpoint;
      }
    ),
    restore: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockImplementation(async (sandboxId: string) => {
      return checkpoints.get(sandboxId) ?? [];
    }),
    delete: vi.fn().mockImplementation(async (sandboxId: string, checkpointId: string) => {
      const list = checkpoints.get(sandboxId) ?? [];
      const filtered = list.filter((cp) => cp.id !== checkpointId);
      checkpoints.set(sandboxId, filtered);
    }),
    getByName: vi.fn().mockImplementation(async (sandboxId: string, name: string) => {
      const list = checkpoints.get(sandboxId) ?? [];
      return list.find((cp) => cp.name === name) ?? null;
    }),
    createInitial: vi.fn(),
    restoreInitial: vi.fn(),
  } as unknown as CheckpointManager;
}

function createMockBrowserStateProvider(): BrowserStateProvider {
  return {
    getLocalStorage: vi.fn().mockResolvedValue({ token: "test-token" }),
    getCookies: vi.fn().mockResolvedValue([]),
    setLocalStorage: vi.fn().mockResolvedValue(undefined),
    setCookies: vi.fn().mockResolvedValue(undefined),
    clearLocalStorage: vi.fn().mockResolvedValue(undefined),
    clearCookies: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDatabaseProvider(): DatabaseProvider {
  return {
    getPath: vi.fn().mockReturnValue("/tmp/test.sqlite"),
  };
}

describe("MCP Server Integration Tests", () => {
  let server: McpServer;
  let client: Client;
  let mockSandboxManager: SandboxManager;
  let mockCheckpointManager: CheckpointManager;
  let mockBrowserStateProvider: BrowserStateProvider;
  let mockDatabaseProvider: DatabaseProvider;
  let clientTransport: InstanceType<typeof InMemoryTransport>;
  let serverTransport: InstanceType<typeof InMemoryTransport>;

  beforeEach(async () => {
    mockSandboxManager = createMockSandboxManager();
    mockCheckpointManager = createMockCheckpointManager();
    mockBrowserStateProvider = createMockBrowserStateProvider();
    mockDatabaseProvider = createMockDatabaseProvider();

    // Create in-memory transport pair for testing
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Create server with handlers
    const config: McpServerConfig = {
      name: "test-crayon-sandbox",
      version: "1.0.0",
      sandboxManager: mockSandboxManager,
      checkpointManager: mockCheckpointManager,
      browserStateProvider: () => mockBrowserStateProvider,
      databaseProvider: () => mockDatabaseProvider,
      onNavigate: vi.fn().mockResolvedValue(undefined),
      onScreenshot: vi.fn().mockResolvedValue("base64-screenshot-data"),
      onGetState: vi.fn().mockResolvedValue({
        url: "http://localhost:3000/dashboard",
        title: "Dashboard",
        dom: "<html><body>Dashboard content</body></html>",
        data: { user: { name: "John" } },
      } as SandboxState),
      onModifyData: vi.fn().mockResolvedValue({ id: "1", name: "Created" }),
      onAction: vi.fn().mockResolvedValue(undefined),
      onPrompt: vi.fn().mockResolvedValue("Executed prompt successfully"),
    };

    server = createMcpServer(config);

    // Connect server to transport
    await server.getServer().connect(serverTransport);

    // Create and connect client
    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  describe("Tool Discovery", () => {
    it("lists all 8 tools", async () => {
      const result = await client.listTools();

      expect(result.tools).toHaveLength(8);

      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain("sandbox_reset");
      expect(toolNames).toContain("sandbox_navigate");
      expect(toolNames).toContain("sandbox_screenshot");
      expect(toolNames).toContain("sandbox_get_state");
      expect(toolNames).toContain("sandbox_modify_data");
      expect(toolNames).toContain("sandbox_action");
      expect(toolNames).toContain("sandbox_checkpoint");
      expect(toolNames).toContain("sandbox_prompt");
    });

    it("tools have proper input schemas", async () => {
      const result = await client.listTools();

      for (const tool of result.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });
  });

  describe("End-to-End Tool Flows", () => {
    it("reset → navigate → screenshot → verify flow", async () => {
      // 1. Reset sandbox
      const resetResult = await client.callTool({
        name: "sandbox_reset",
        arguments: { sandboxId: "test-sandbox" },
      });

      expect(resetResult.isError).toBeFalsy();
      const resetContent = resetResult.content[0];
      expect(resetContent.type).toBe("text");
      if (resetContent.type === "text") {
        const resetData = JSON.parse(resetContent.text);
        expect(resetData.success).toBe(true);
      }

      // 2. Navigate to URL
      const navResult = await client.callTool({
        name: "sandbox_navigate",
        arguments: {
          sandboxId: "test-sandbox",
          url: "http://localhost:3000/dashboard",
        },
      });

      expect(navResult.isError).toBeFalsy();
      const navContent = navResult.content[0];
      if (navContent.type === "text") {
        const navData = JSON.parse(navContent.text);
        expect(navData.success).toBe(true);
        expect(navData.url).toBe("http://localhost:3000/dashboard");
      }

      // 3. Take screenshot
      const ssResult = await client.callTool({
        name: "sandbox_screenshot",
        arguments: { sandboxId: "test-sandbox" },
      });

      expect(ssResult.isError).toBeFalsy();
      const ssContent = ssResult.content[0];
      if (ssContent.type === "text") {
        const ssData = JSON.parse(ssContent.text);
        expect(ssData.success).toBe(true);
        expect(ssData.screenshot).toBe("base64-screenshot-data");
      }

      // 4. Verify state
      const stateResult = await client.callTool({
        name: "sandbox_get_state",
        arguments: { sandboxId: "test-sandbox" },
      });

      expect(stateResult.isError).toBeFalsy();
      const stateContent = stateResult.content[0];
      if (stateContent.type === "text") {
        const stateData = JSON.parse(stateContent.text);
        expect(stateData.sandbox.status).toBe("running");
        expect(stateData.state.url).toBe("http://localhost:3000/dashboard");
      }
    });

    it("checkpoint create → list → restore flow", async () => {
      // 1. List initial checkpoints
      const listResult1 = await client.callTool({
        name: "sandbox_checkpoint",
        arguments: {
          sandboxId: "test-sandbox",
          operation: "list",
        },
      });

      expect(listResult1.isError).toBeFalsy();
      const listContent1 = listResult1.content[0];
      if (listContent1.type === "text") {
        const listData1 = JSON.parse(listContent1.text);
        expect(listData1.success).toBe(true);
        expect(listData1.checkpoints).toHaveLength(1);
        expect(listData1.checkpoints[0].name).toBe("initial");
      }

      // 2. Create new checkpoint
      const createResult = await client.callTool({
        name: "sandbox_checkpoint",
        arguments: {
          sandboxId: "test-sandbox",
          operation: "create",
          name: "before-test",
        },
      });

      expect(createResult.isError).toBeFalsy();
      const createContent = createResult.content[0];
      if (createContent.type === "text") {
        const createData = JSON.parse(createContent.text);
        expect(createData.success).toBe(true);
        expect(createData.checkpoint.name).toBe("before-test");
      }

      // 3. List checkpoints again
      const listResult2 = await client.callTool({
        name: "sandbox_checkpoint",
        arguments: {
          sandboxId: "test-sandbox",
          operation: "list",
        },
      });

      const listContent2 = listResult2.content[0];
      if (listContent2.type === "text") {
        const listData2 = JSON.parse(listContent2.text);
        expect(listData2.checkpoints).toHaveLength(2);
      }

      // 4. Restore to initial
      const restoreResult = await client.callTool({
        name: "sandbox_checkpoint",
        arguments: {
          sandboxId: "test-sandbox",
          operation: "restore",
          name: "initial",
        },
      });

      expect(restoreResult.isError).toBeFalsy();
      const restoreContent = restoreResult.content[0];
      if (restoreContent.type === "text") {
        const restoreData = JSON.parse(restoreContent.text);
        expect(restoreData.success).toBe(true);
      }
    });

    it("data CRUD operations flow", async () => {
      // 1. Create
      const createResult = await client.callTool({
        name: "sandbox_modify_data",
        arguments: {
          sandboxId: "test-sandbox",
          operation: "create",
          entity: "user",
          data: { name: "John Doe", email: "john@example.com" },
        },
      });

      expect(createResult.isError).toBeFalsy();
      const createContent = createResult.content[0];
      if (createContent.type === "text") {
        const createData = JSON.parse(createContent.text);
        expect(createData.success).toBe(true);
      }

      // 2. Read
      const readResult = await client.callTool({
        name: "sandbox_modify_data",
        arguments: {
          sandboxId: "test-sandbox",
          operation: "read",
          entity: "user",
          id: "1",
        },
      });

      expect(readResult.isError).toBeFalsy();

      // 3. Update
      const updateResult = await client.callTool({
        name: "sandbox_modify_data",
        arguments: {
          sandboxId: "test-sandbox",
          operation: "update",
          entity: "user",
          id: "1",
          data: { name: "Jane Doe" },
        },
      });

      expect(updateResult.isError).toBeFalsy();

      // 4. Delete
      const deleteResult = await client.callTool({
        name: "sandbox_modify_data",
        arguments: {
          sandboxId: "test-sandbox",
          operation: "delete",
          entity: "user",
          id: "1",
        },
      });

      expect(deleteResult.isError).toBeFalsy();
    });

    it("UI action flow", async () => {
      // 1. Click
      const clickResult = await client.callTool({
        name: "sandbox_action",
        arguments: {
          sandboxId: "test-sandbox",
          action: "click",
          selector: "#login-button",
        },
      });

      expect(clickResult.isError).toBeFalsy();

      // 2. Type
      const typeResult = await client.callTool({
        name: "sandbox_action",
        arguments: {
          sandboxId: "test-sandbox",
          action: "type",
          selector: "#email-input",
          value: "test@example.com",
        },
      });

      expect(typeResult.isError).toBeFalsy();

      // 3. Scroll
      const scrollResult = await client.callTool({
        name: "sandbox_action",
        arguments: {
          sandboxId: "test-sandbox",
          action: "scroll",
          selector: "#content",
          y: 500,
        },
      });

      expect(scrollResult.isError).toBeFalsy();

      // 4. Hover
      const hoverResult = await client.callTool({
        name: "sandbox_action",
        arguments: {
          sandboxId: "test-sandbox",
          action: "hover",
          selector: "#dropdown-menu",
        },
      });

      expect(hoverResult.isError).toBeFalsy();
    });

    it("natural language prompt execution", async () => {
      const promptResult = await client.callTool({
        name: "sandbox_prompt",
        arguments: {
          sandboxId: "test-sandbox",
          prompt: "Fill in the login form with test credentials and submit",
        },
      });

      expect(promptResult.isError).toBeFalsy();
      const promptContent = promptResult.content[0];
      if (promptContent.type === "text") {
        const promptData = JSON.parse(promptContent.text);
        expect(promptData.success).toBe(true);
        expect(promptData.result).toBe("Executed prompt successfully");
      }
    });
  });

  describe("Error Handling", () => {
    it("returns error for unknown tool", async () => {
      const result = await client.callTool({
        name: "unknown_tool",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === "text") {
        const errorData = JSON.parse(content.text);
        expect(errorData.code).toBe("NOT_FOUND");
      }
    });

    it("returns error for invalid sandbox ID", async () => {
      const result = await client.callTool({
        name: "sandbox_get_state",
        arguments: { sandboxId: "nonexistent-sandbox" },
      });

      expect(result.isError).toBe(true);
    });

    it("returns validation error for missing required fields", async () => {
      const result = await client.callTool({
        name: "sandbox_navigate",
        arguments: { sandboxId: "test-sandbox" }, // Missing 'url'
      });

      expect(result.isError).toBe(true);
    });

    it("returns error for invalid URL format", async () => {
      const result = await client.callTool({
        name: "sandbox_navigate",
        arguments: {
          sandboxId: "test-sandbox",
          url: "not-a-valid-url",
        },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("Response Structure", () => {
    it("returns structured JSON responses", async () => {
      const result = await client.callTool({
        name: "sandbox_get_state",
        arguments: { sandboxId: "test-sandbox" },
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const content = result.content[0];
      if (content.type === "text") {
        // Should be valid JSON
        expect(() => JSON.parse(content.text)).not.toThrow();

        const data = JSON.parse(content.text);
        expect(data).toHaveProperty("sandbox");
        expect(data).toHaveProperty("state");
      }
    });

    it("error responses have consistent structure", async () => {
      const result = await client.callTool({
        name: "sandbox_navigate",
        arguments: {
          sandboxId: "nonexistent",
          url: "http://example.com",
        },
      });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === "text") {
        const errorData = JSON.parse(content.text);
        expect(errorData).toHaveProperty("error");
        expect(errorData).toHaveProperty("code");
      }
    });
  });
});

describe("MCP Server API Key Validation Integration", () => {
  let server: McpServer;
  let client: Client;
  let clientTransport: InstanceType<typeof InMemoryTransport>;
  let serverTransport: InstanceType<typeof InMemoryTransport>;

  beforeEach(async () => {
    const mockSandboxManager = createMockSandboxManager();
    const mockCheckpointManager = createMockCheckpointManager();

    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
      apiKey: "cry_abc123defg",
      sandboxManager: mockSandboxManager,
      checkpointManager: mockCheckpointManager,
    });

    await server.getServer().connect(serverTransport);

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("validates API key format", () => {
    // Valid key
    expect(server.validateApiKey("cry_abc123defg")).toBe(true);

    // Invalid format
    expect(server.validateApiKey("invalid")).toBe(false);
    expect(server.validateApiKey("cry_short")).toBe(false);
    expect(server.validateApiKey(undefined)).toBe(false);

    // Wrong key
    expect(server.validateApiKey("cry_wrongkey123")).toBe(false);
  });
});
