import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  McpServer,
  McpServerError,
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

function createMockSandboxManager(): SandboxManager {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn(),
    list: vi.fn(),
  } as unknown as SandboxManager;
}

function createMockCheckpointManager(): CheckpointManager {
  return {
    create: vi.fn(),
    restore: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    getByName: vi.fn(),
    createInitial: vi.fn(),
    restoreInitial: vi.fn(),
  } as unknown as CheckpointManager;
}

function createMockBrowserStateProvider(): BrowserStateProvider {
  return {
    getLocalStorage: vi.fn().mockResolvedValue({}),
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

function createMockSandbox(overrides: Partial<Sandbox> = {}): Sandbox {
  return {
    id: "test-sandbox",
    status: "running",
    ports: { frontend: 3000, backend: 3001 },
    url: "http://localhost:3000",
    ...overrides,
  };
}

function createMockCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: "checkpoint-1",
    name: "initial",
    createdAt: new Date(),
    databasePath: "/tmp/checkpoint/data.sqlite",
    browserState: {
      localStorage: {},
      cookies: [],
    },
    ...overrides,
  };
}

describe("createMcpServer", () => {
  it("creates an McpServer instance", () => {
    const mockSandboxManager = createMockSandboxManager();
    const mockCheckpointManager = createMockCheckpointManager();

    const server = createMcpServer({
      sandboxManager: mockSandboxManager,
      checkpointManager: mockCheckpointManager,
    });

    expect(server).toBeInstanceOf(McpServer);
  });

  it("accepts custom name and version", () => {
    const mockSandboxManager = createMockSandboxManager();
    const mockCheckpointManager = createMockCheckpointManager();

    const server = createMcpServer({
      name: "custom-server",
      version: "2.0.0",
      sandboxManager: mockSandboxManager,
      checkpointManager: mockCheckpointManager,
    });

    expect(server).toBeInstanceOf(McpServer);
    expect(server.getServer()).toBeDefined();
  });
});

describe("McpServer", () => {
  let mockSandboxManager: ReturnType<typeof createMockSandboxManager>;
  let mockCheckpointManager: ReturnType<typeof createMockCheckpointManager>;
  let mockBrowserStateProvider: BrowserStateProvider;
  let mockDatabaseProvider: DatabaseProvider;
  let server: McpServer;

  beforeEach(() => {
    mockSandboxManager = createMockSandboxManager();
    mockCheckpointManager = createMockCheckpointManager();
    mockBrowserStateProvider = createMockBrowserStateProvider();
    mockDatabaseProvider = createMockDatabaseProvider();
  });

  function createServer(overrides: Partial<McpServerConfig> = {}): McpServer {
    return new McpServer({
      sandboxManager: mockSandboxManager,
      checkpointManager: mockCheckpointManager,
      browserStateProvider: () => mockBrowserStateProvider,
      databaseProvider: () => mockDatabaseProvider,
      ...overrides,
    });
  }

  describe("validateApiKey", () => {
    it("returns true when no API key is configured", () => {
      server = createServer();
      expect(server.validateApiKey(undefined)).toBe(true);
      expect(server.validateApiKey("anything")).toBe(true);
    });

    it("returns false when API key is configured but not provided", () => {
      server = createServer({ apiKey: "cry_abc123defg" });
      expect(server.validateApiKey(undefined)).toBe(false);
    });

    it("returns false for invalid API key format", () => {
      server = createServer({ apiKey: "cry_abc123defg" });
      expect(server.validateApiKey("invalid")).toBe(false);
      expect(server.validateApiKey("cry_short")).toBe(false);
      expect(server.validateApiKey("wrong_abc123defg")).toBe(false);
    });

    it("returns true for valid matching API key", () => {
      server = createServer({ apiKey: "cry_abc123defg" });
      expect(server.validateApiKey("cry_abc123defg")).toBe(true);
    });

    it("returns false for valid format but wrong key", () => {
      server = createServer({ apiKey: "cry_abc123defg" });
      expect(server.validateApiKey("cry_xyz789hijk")).toBe(false);
    });
  });

  describe("handleToolCall", () => {
    describe("unknown tool", () => {
      it("throws McpServerError for unknown tool", async () => {
        server = createServer();

        await expect(
          server.handleToolCall("unknown_tool", {})
        ).rejects.toThrow(McpServerError);
        await expect(
          server.handleToolCall("unknown_tool", {})
        ).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      });
    });

    describe("sandbox_reset", () => {
      it("resets sandbox to initial checkpoint", async () => {
        const mockSandbox = createMockSandbox();
        const mockCheckpoint = createMockCheckpoint();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);
        vi.mocked(mockCheckpointManager.getByName).mockResolvedValue(mockCheckpoint);
        vi.mocked(mockCheckpointManager.restore).mockResolvedValue(undefined);

        server = createServer();

        const result = await server.handleToolCall("sandbox_reset", {
          sandboxId: "test-sandbox",
        });

        expect(result).toEqual({ success: true, sandbox: mockSandbox });
        expect(mockCheckpointManager.getByName).toHaveBeenCalledWith(
          "test-sandbox",
          "initial"
        );
        expect(mockCheckpointManager.restore).toHaveBeenCalledWith(
          "test-sandbox",
          "checkpoint-1",
          mockBrowserStateProvider,
          mockDatabaseProvider
        );
      });

      it("resets to named checkpoint", async () => {
        const mockSandbox = createMockSandbox();
        const mockCheckpoint = createMockCheckpoint({ name: "custom", id: "cp-2" });

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);
        vi.mocked(mockCheckpointManager.getByName).mockResolvedValue(mockCheckpoint);
        vi.mocked(mockCheckpointManager.restore).mockResolvedValue(undefined);

        server = createServer();

        await server.handleToolCall("sandbox_reset", {
          sandboxId: "test-sandbox",
          checkpointName: "custom",
        });

        expect(mockCheckpointManager.getByName).toHaveBeenCalledWith(
          "test-sandbox",
          "custom"
        );
      });

      it("throws when checkpoint not found", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);
        vi.mocked(mockCheckpointManager.getByName).mockResolvedValue(null);

        server = createServer();

        await expect(
          server.handleToolCall("sandbox_reset", { sandboxId: "test-sandbox" })
        ).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      });

      it("throws on invalid input", async () => {
        server = createServer();

        await expect(
          server.handleToolCall("sandbox_reset", {})
        ).rejects.toThrow();
      });
    });

    describe("sandbox_navigate", () => {
      it("navigates to URL", async () => {
        const mockSandbox = createMockSandbox();
        const onNavigate = vi.fn().mockResolvedValue(undefined);

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onNavigate });

        const result = await server.handleToolCall("sandbox_navigate", {
          sandboxId: "test-sandbox",
          url: "https://example.com",
        });

        expect(result).toEqual({ success: true, url: "https://example.com" });
        expect(onNavigate).toHaveBeenCalledWith(
          "test-sandbox",
          "https://example.com"
        );
      });

      it("throws when sandbox not running", async () => {
        const mockSandbox = createMockSandbox({ status: "stopped" });

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onNavigate: vi.fn() });

        await expect(
          server.handleToolCall("sandbox_navigate", {
            sandboxId: "test-sandbox",
            url: "https://example.com",
          })
        ).rejects.toMatchObject({
          code: "OPERATION_FAILED",
        });
      });

      it("throws when handler not configured", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer();

        await expect(
          server.handleToolCall("sandbox_navigate", {
            sandboxId: "test-sandbox",
            url: "https://example.com",
          })
        ).rejects.toMatchObject({
          code: "NOT_IMPLEMENTED",
        });
      });

      it("throws on invalid URL", async () => {
        server = createServer();

        await expect(
          server.handleToolCall("sandbox_navigate", {
            sandboxId: "test-sandbox",
            url: "not-a-url",
          })
        ).rejects.toThrow();
      });
    });

    describe("sandbox_screenshot", () => {
      it("captures screenshot", async () => {
        const mockSandbox = createMockSandbox();
        const onScreenshot = vi.fn().mockResolvedValue("base64-screenshot-data");

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onScreenshot });

        const result = await server.handleToolCall("sandbox_screenshot", {
          sandboxId: "test-sandbox",
        });

        expect(result).toEqual({
          success: true,
          screenshot: "base64-screenshot-data",
        });
        expect(onScreenshot).toHaveBeenCalledWith("test-sandbox", false);
      });

      it("captures full page screenshot", async () => {
        const mockSandbox = createMockSandbox();
        const onScreenshot = vi.fn().mockResolvedValue("base64-full-page");

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onScreenshot });

        await server.handleToolCall("sandbox_screenshot", {
          sandboxId: "test-sandbox",
          fullPage: true,
        });

        expect(onScreenshot).toHaveBeenCalledWith("test-sandbox", true);
      });

      it("throws when sandbox not running", async () => {
        const mockSandbox = createMockSandbox({ status: "stopped" });

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onScreenshot: vi.fn() });

        await expect(
          server.handleToolCall("sandbox_screenshot", {
            sandboxId: "test-sandbox",
          })
        ).rejects.toMatchObject({
          code: "OPERATION_FAILED",
        });
      });

      it("throws when handler not configured", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer();

        await expect(
          server.handleToolCall("sandbox_screenshot", {
            sandboxId: "test-sandbox",
          })
        ).rejects.toMatchObject({
          code: "NOT_IMPLEMENTED",
        });
      });
    });

    describe("sandbox_get_state", () => {
      it("returns sandbox and state", async () => {
        const mockSandbox = createMockSandbox();
        const mockState: SandboxState = {
          url: "https://example.com",
          title: "Example Page",
          dom: "<html>...</html>",
        };
        const onGetState = vi.fn().mockResolvedValue(mockState);

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onGetState });

        const result = await server.handleToolCall("sandbox_get_state", {
          sandboxId: "test-sandbox",
        });

        expect(result).toEqual({ sandbox: mockSandbox, state: mockState });
        expect(onGetState).toHaveBeenCalledWith("test-sandbox");
      });

      it("returns null state when sandbox not running", async () => {
        const mockSandbox = createMockSandbox({ status: "stopped" });
        const onGetState = vi.fn();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onGetState });

        const result = await server.handleToolCall("sandbox_get_state", {
          sandboxId: "test-sandbox",
        });

        expect(result).toEqual({ sandbox: mockSandbox, state: null });
        expect(onGetState).not.toHaveBeenCalled();
      });

      it("returns null state when handler not configured", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer();

        const result = await server.handleToolCall("sandbox_get_state", {
          sandboxId: "test-sandbox",
        });

        expect(result).toEqual({ sandbox: mockSandbox, state: null });
      });
    });

    describe("sandbox_modify_data", () => {
      it("performs create operation", async () => {
        const mockSandbox = createMockSandbox();
        const createdUser = { id: "1", name: "John" };
        const onModifyData = vi.fn().mockResolvedValue(createdUser);

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onModifyData });

        const result = await server.handleToolCall("sandbox_modify_data", {
          sandboxId: "test-sandbox",
          operation: "create",
          entity: "user",
          data: { name: "John" },
        });

        expect(result).toEqual({ success: true, result: createdUser });
        expect(onModifyData).toHaveBeenCalledWith(
          "test-sandbox",
          "create",
          "user",
          undefined,
          { name: "John" }
        );
      });

      it("performs read operation", async () => {
        const mockSandbox = createMockSandbox();
        const user = { id: "1", name: "John" };
        const onModifyData = vi.fn().mockResolvedValue(user);

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onModifyData });

        const result = await server.handleToolCall("sandbox_modify_data", {
          sandboxId: "test-sandbox",
          operation: "read",
          entity: "user",
          id: "1",
        });

        expect(result).toEqual({ success: true, result: user });
      });

      it("throws when id missing for read operation", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onModifyData: vi.fn() });

        await expect(
          server.handleToolCall("sandbox_modify_data", {
            sandboxId: "test-sandbox",
            operation: "read",
            entity: "user",
          })
        ).rejects.toMatchObject({
          code: "INVALID_INPUT",
        });
      });

      it("throws when data missing for create operation", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onModifyData: vi.fn() });

        await expect(
          server.handleToolCall("sandbox_modify_data", {
            sandboxId: "test-sandbox",
            operation: "create",
            entity: "user",
          })
        ).rejects.toMatchObject({
          code: "INVALID_INPUT",
        });
      });

      it("throws when handler not configured", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer();

        await expect(
          server.handleToolCall("sandbox_modify_data", {
            sandboxId: "test-sandbox",
            operation: "create",
            entity: "user",
            data: { name: "John" },
          })
        ).rejects.toMatchObject({
          code: "NOT_IMPLEMENTED",
        });
      });
    });

    describe("sandbox_action", () => {
      it("performs click action", async () => {
        const mockSandbox = createMockSandbox();
        const onAction = vi.fn().mockResolvedValue(undefined);

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onAction });

        const result = await server.handleToolCall("sandbox_action", {
          sandboxId: "test-sandbox",
          action: "click",
          selector: "#submit-button",
        });

        expect(result).toEqual({ success: true });
        expect(onAction).toHaveBeenCalledWith(
          "test-sandbox",
          "click",
          "#submit-button",
          { value: undefined, x: undefined, y: undefined }
        );
      });

      it("performs type action with value", async () => {
        const mockSandbox = createMockSandbox();
        const onAction = vi.fn().mockResolvedValue(undefined);

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onAction });

        await server.handleToolCall("sandbox_action", {
          sandboxId: "test-sandbox",
          action: "type",
          selector: "#email-input",
          value: "test@example.com",
        });

        expect(onAction).toHaveBeenCalledWith(
          "test-sandbox",
          "type",
          "#email-input",
          { value: "test@example.com", x: undefined, y: undefined }
        );
      });

      it("throws when value missing for type action", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onAction: vi.fn() });

        await expect(
          server.handleToolCall("sandbox_action", {
            sandboxId: "test-sandbox",
            action: "type",
            selector: "#email-input",
          })
        ).rejects.toMatchObject({
          code: "INVALID_INPUT",
        });
      });

      it("performs scroll action with coordinates", async () => {
        const mockSandbox = createMockSandbox();
        const onAction = vi.fn().mockResolvedValue(undefined);

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onAction });

        await server.handleToolCall("sandbox_action", {
          sandboxId: "test-sandbox",
          action: "scroll",
          selector: "#content",
          x: 0,
          y: 500,
        });

        expect(onAction).toHaveBeenCalledWith(
          "test-sandbox",
          "scroll",
          "#content",
          { value: undefined, x: 0, y: 500 }
        );
      });

      it("throws when sandbox not running", async () => {
        const mockSandbox = createMockSandbox({ status: "stopped" });

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onAction: vi.fn() });

        await expect(
          server.handleToolCall("sandbox_action", {
            sandboxId: "test-sandbox",
            action: "click",
            selector: "#button",
          })
        ).rejects.toMatchObject({
          code: "OPERATION_FAILED",
        });
      });

      it("throws when handler not configured", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer();

        await expect(
          server.handleToolCall("sandbox_action", {
            sandboxId: "test-sandbox",
            action: "click",
            selector: "#button",
          })
        ).rejects.toMatchObject({
          code: "NOT_IMPLEMENTED",
        });
      });
    });

    describe("sandbox_checkpoint", () => {
      describe("list operation", () => {
        it("lists checkpoints", async () => {
          const mockSandbox = createMockSandbox();
          const mockCheckpoints = [
            createMockCheckpoint({ id: "cp-1", name: "initial" }),
            createMockCheckpoint({ id: "cp-2", name: "before-test" }),
          ];

          vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);
          vi.mocked(mockCheckpointManager.list).mockResolvedValue(mockCheckpoints);

          server = createServer();

          const result = await server.handleToolCall("sandbox_checkpoint", {
            sandboxId: "test-sandbox",
            operation: "list",
          });

          expect(result).toEqual({ success: true, checkpoints: mockCheckpoints });
          expect(mockCheckpointManager.list).toHaveBeenCalledWith("test-sandbox");
        });
      });

      describe("create operation", () => {
        it("creates checkpoint", async () => {
          const mockSandbox = createMockSandbox();
          const mockCheckpoint = createMockCheckpoint({ name: "new-checkpoint" });

          vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);
          vi.mocked(mockCheckpointManager.create).mockResolvedValue(mockCheckpoint);

          server = createServer();

          const result = await server.handleToolCall("sandbox_checkpoint", {
            sandboxId: "test-sandbox",
            operation: "create",
            name: "new-checkpoint",
          });

          expect(result).toEqual({ success: true, checkpoint: mockCheckpoint });
          expect(mockCheckpointManager.create).toHaveBeenCalledWith(
            "test-sandbox",
            "new-checkpoint",
            mockBrowserStateProvider,
            mockDatabaseProvider
          );
        });

        it("throws when name missing", async () => {
          const mockSandbox = createMockSandbox();

          vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

          server = createServer();

          await expect(
            server.handleToolCall("sandbox_checkpoint", {
              sandboxId: "test-sandbox",
              operation: "create",
            })
          ).rejects.toMatchObject({
            code: "INVALID_INPUT",
          });
        });

        it("throws when providers not configured", async () => {
          const mockSandbox = createMockSandbox();

          vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

          server = createServer({
            browserStateProvider: undefined,
            databaseProvider: undefined,
          });

          await expect(
            server.handleToolCall("sandbox_checkpoint", {
              sandboxId: "test-sandbox",
              operation: "create",
              name: "test",
            })
          ).rejects.toMatchObject({
            code: "NOT_IMPLEMENTED",
          });
        });
      });

      describe("restore operation", () => {
        it("restores checkpoint by id", async () => {
          const mockSandbox = createMockSandbox();

          vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);
          vi.mocked(mockCheckpointManager.restore).mockResolvedValue(undefined);

          server = createServer();

          const result = await server.handleToolCall("sandbox_checkpoint", {
            sandboxId: "test-sandbox",
            operation: "restore",
            checkpointId: "cp-123",
          });

          expect(result).toEqual({ success: true });
          expect(mockCheckpointManager.restore).toHaveBeenCalledWith(
            "test-sandbox",
            "cp-123",
            mockBrowserStateProvider,
            mockDatabaseProvider
          );
        });

        it("restores checkpoint by name", async () => {
          const mockSandbox = createMockSandbox();
          const mockCheckpoint = createMockCheckpoint({ id: "cp-456", name: "my-checkpoint" });

          vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);
          vi.mocked(mockCheckpointManager.getByName).mockResolvedValue(mockCheckpoint);
          vi.mocked(mockCheckpointManager.restore).mockResolvedValue(undefined);

          server = createServer();

          const result = await server.handleToolCall("sandbox_checkpoint", {
            sandboxId: "test-sandbox",
            operation: "restore",
            name: "my-checkpoint",
          });

          expect(result).toEqual({ success: true });
          expect(mockCheckpointManager.getByName).toHaveBeenCalledWith(
            "test-sandbox",
            "my-checkpoint"
          );
          expect(mockCheckpointManager.restore).toHaveBeenCalledWith(
            "test-sandbox",
            "cp-456",
            mockBrowserStateProvider,
            mockDatabaseProvider
          );
        });

        it("throws when checkpoint name not found", async () => {
          const mockSandbox = createMockSandbox();

          vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);
          vi.mocked(mockCheckpointManager.getByName).mockResolvedValue(null);

          server = createServer();

          await expect(
            server.handleToolCall("sandbox_checkpoint", {
              sandboxId: "test-sandbox",
              operation: "restore",
              name: "nonexistent",
            })
          ).rejects.toMatchObject({
            code: "NOT_FOUND",
          });
        });

        it("throws when neither id nor name provided", async () => {
          const mockSandbox = createMockSandbox();

          vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

          server = createServer();

          await expect(
            server.handleToolCall("sandbox_checkpoint", {
              sandboxId: "test-sandbox",
              operation: "restore",
            })
          ).rejects.toMatchObject({
            code: "INVALID_INPUT",
          });
        });

        it("throws when providers not configured", async () => {
          const mockSandbox = createMockSandbox();

          vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

          server = createServer({
            browserStateProvider: undefined,
            databaseProvider: undefined,
          });

          await expect(
            server.handleToolCall("sandbox_checkpoint", {
              sandboxId: "test-sandbox",
              operation: "restore",
              checkpointId: "cp-123",
            })
          ).rejects.toMatchObject({
            code: "NOT_IMPLEMENTED",
          });
        });
      });
    });

    describe("sandbox_prompt", () => {
      it("executes natural language prompt", async () => {
        const mockSandbox = createMockSandbox();
        const onPrompt = vi.fn().mockResolvedValue("Clicked the submit button");

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer({ onPrompt });

        const result = await server.handleToolCall("sandbox_prompt", {
          sandboxId: "test-sandbox",
          prompt: "Click the submit button",
        });

        expect(result).toEqual({
          success: true,
          result: "Clicked the submit button",
        });
        expect(onPrompt).toHaveBeenCalledWith(
          "test-sandbox",
          "Click the submit button"
        );
      });

      it("throws when handler not configured", async () => {
        const mockSandbox = createMockSandbox();

        vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

        server = createServer();

        await expect(
          server.handleToolCall("sandbox_prompt", {
            sandboxId: "test-sandbox",
            prompt: "Do something",
          })
        ).rejects.toMatchObject({
          code: "NOT_IMPLEMENTED",
        });
      });

      it("throws on empty prompt", async () => {
        server = createServer();

        await expect(
          server.handleToolCall("sandbox_prompt", {
            sandboxId: "test-sandbox",
            prompt: "",
          })
        ).rejects.toThrow();
      });
    });
  });

  describe("getServer", () => {
    it("returns the underlying MCP server instance", () => {
      const server = createServer();
      const mcpServer = server.getServer();

      expect(mcpServer).toBeDefined();
    });
  });
});

describe("McpServerError", () => {
  it("has correct name and properties", () => {
    const error = new McpServerError("Test error", "AUTH_ERROR");

    expect(error.name).toBe("McpServerError");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("AUTH_ERROR");
  });

  it("is instance of Error", () => {
    const error = new McpServerError("Test error", "NOT_FOUND");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(McpServerError);
  });

  it("supports all error codes", () => {
    const codes = [
      "AUTH_ERROR",
      "NOT_FOUND",
      "INVALID_INPUT",
      "OPERATION_FAILED",
      "NOT_IMPLEMENTED",
    ] as const;

    for (const code of codes) {
      const error = new McpServerError(`Error: ${code}`, code);
      expect(error.code).toBe(code);
    }
  });
});
