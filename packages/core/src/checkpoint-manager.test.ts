import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import {
  CheckpointManager,
  CheckpointManagerError,
  createCheckpointManager,
  type BrowserStateProvider,
  type DatabaseProvider,
} from "./checkpoint-manager.js";
import type { Cookie } from "@crayon/types";

// Mock fs module
vi.mock("fs");

const mockedFs = vi.mocked(fs);

function createMockBrowserStateProvider(
  localStorage: Record<string, string> = {},
  cookies: Cookie[] = []
): BrowserStateProvider {
  return {
    getLocalStorage: vi.fn().mockResolvedValue(localStorage),
    getCookies: vi.fn().mockResolvedValue(cookies),
    setLocalStorage: vi.fn().mockResolvedValue(undefined),
    setCookies: vi.fn().mockResolvedValue(undefined),
    clearLocalStorage: vi.fn().mockResolvedValue(undefined),
    clearCookies: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDatabaseProvider(dbPath: string = "/data/sandbox.sqlite"): DatabaseProvider {
  return {
    getPath: vi.fn().mockReturnValue(dbPath),
  };
}

describe("createCheckpointManager", () => {
  it("creates a CheckpointManager instance", () => {
    const manager = createCheckpointManager();
    expect(manager).toBeInstanceOf(CheckpointManager);
  });

  it("accepts custom base directory", () => {
    const manager = createCheckpointManager({ baseDir: "/custom/checkpoints" });
    expect(manager).toBeInstanceOf(CheckpointManager);
  });
});

describe("CheckpointManager", () => {
  let manager: CheckpointManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new CheckpointManager({ baseDir: "/checkpoints" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("create", () => {
    it("creates checkpoint with correct structure", async () => {
      const browserProvider = createMockBrowserStateProvider(
        { theme: "dark", user: "john" },
        [{ name: "session", value: "abc123" }]
      );
      const dbProvider = createMockDatabaseProvider("/data/sandbox.sqlite");

      mockedFs.existsSync.mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.includes("my-checkpoint")) return false;
        if (pathStr === "/data/sandbox.sqlite") return true;
        return false;
      });
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.copyFileSync.mockReturnValue(undefined);
      mockedFs.writeFileSync.mockReturnValue(undefined);

      const checkpoint = await manager.create(
        "sandbox-001",
        "my-checkpoint",
        browserProvider,
        dbProvider
      );

      expect(checkpoint.name).toBe("my-checkpoint");
      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.createdAt).toBeInstanceOf(Date);
      expect(checkpoint.databasePath).toContain("data.sqlite");
      expect(checkpoint.browserState.localStorage).toEqual({ theme: "dark", user: "john" });
      expect(checkpoint.browserState.cookies).toEqual([{ name: "session", value: "abc123" }]);
    });

    it("creates checkpoint directory structure", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider("/data/sandbox.sqlite");

      mockedFs.existsSync.mockImplementation((p) => {
        if (String(p) === "/data/sandbox.sqlite") return true;
        return false;
      });
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.copyFileSync.mockReturnValue(undefined);
      mockedFs.writeFileSync.mockReturnValue(undefined);

      await manager.create("sandbox-001", "checkpoint-1", browserProvider, dbProvider);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("sandbox-001"),
        { recursive: true }
      );
    });

    it("copies database file to checkpoint directory", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider("/data/sandbox.sqlite");

      mockedFs.existsSync.mockImplementation((p) => {
        if (String(p) === "/data/sandbox.sqlite") return true;
        return false;
      });
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.copyFileSync.mockReturnValue(undefined);
      mockedFs.writeFileSync.mockReturnValue(undefined);

      await manager.create("sandbox-001", "checkpoint-1", browserProvider, dbProvider);

      expect(mockedFs.copyFileSync).toHaveBeenCalledWith(
        "/data/sandbox.sqlite",
        expect.stringContaining("data.sqlite")
      );
    });

    it("handles missing source database", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider("/data/missing.sqlite");

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.writeFileSync.mockReturnValue(undefined);

      const checkpoint = await manager.create(
        "sandbox-001",
        "checkpoint-1",
        browserProvider,
        dbProvider
      );

      // Should create empty database file
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("data.sqlite"),
        ""
      );
      expect(checkpoint).toBeDefined();
    });

    it("saves state.json with checkpoint metadata", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider("/data/sandbox.sqlite");

      mockedFs.existsSync.mockImplementation((p) => {
        if (String(p) === "/data/sandbox.sqlite") return true;
        return false;
      });
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.copyFileSync.mockReturnValue(undefined);
      mockedFs.writeFileSync.mockReturnValue(undefined);

      await manager.create("sandbox-001", "checkpoint-1", browserProvider, dbProvider);

      // Find the call that wrote state.json
      const stateJsonCall = mockedFs.writeFileSync.mock.calls.find(
        (call) => String(call[0]).includes("state.json")
      );
      expect(stateJsonCall).toBeDefined();
      expect(String(stateJsonCall![1])).toContain('"name": "checkpoint-1"');
    });

    it("throws ALREADY_EXISTS when checkpoint exists", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider();

      mockedFs.existsSync.mockReturnValue(true);

      await expect(
        manager.create("sandbox-001", "existing", browserProvider, dbProvider)
      ).rejects.toThrow(CheckpointManagerError);

      await expect(
        manager.create("sandbox-001", "existing", browserProvider, dbProvider)
      ).rejects.toMatchObject({ code: "ALREADY_EXISTS" });
    });

    it("cleans up on failure", async () => {
      const browserProvider = createMockBrowserStateProvider();
      browserProvider.getLocalStorage = vi.fn().mockRejectedValue(new Error("Browser error"));

      const dbProvider = createMockDatabaseProvider("/data/sandbox.sqlite");

      // First call checks if checkpoint exists (should return false to allow creation)
      // Then after mkdir, existsSync should return true for cleanup check
      let mkdirCalled = false;
      mockedFs.existsSync.mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr === "/data/sandbox.sqlite") return true;
        // After mkdir is called, the checkpoint dir exists
        if (pathStr.includes("failed") && mkdirCalled) return true;
        return false;
      });
      mockedFs.mkdirSync.mockImplementation(() => {
        mkdirCalled = true;
        return undefined;
      });
      mockedFs.copyFileSync.mockReturnValue(undefined);
      mockedFs.rmSync.mockReturnValue(undefined);

      await expect(
        manager.create("sandbox-001", "failed", browserProvider, dbProvider)
      ).rejects.toThrow(CheckpointManagerError);

      expect(mockedFs.rmSync).toHaveBeenCalledWith(
        expect.stringContaining("failed"),
        { recursive: true, force: true }
      );
    });
  });

  describe("restore", () => {
    it("restores database from checkpoint", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider("/data/sandbox.sqlite");

      const checkpointData = {
        id: "cp-123",
        name: "my-checkpoint",
        createdAt: new Date().toISOString(),
        databasePath: "/checkpoints/sandbox-001/my-checkpoint/data.sqlite",
        browserState: {
          localStorage: { key: "value" },
          cookies: [{ name: "session", value: "xyz" }],
        },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        { name: "my-checkpoint", isDirectory: () => true } as fs.Dirent,
      ]);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(checkpointData));
      mockedFs.copyFileSync.mockReturnValue(undefined);

      await manager.restore("sandbox-001", "cp-123", browserProvider, dbProvider);

      expect(mockedFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining("data.sqlite"),
        "/data/sandbox.sqlite"
      );
    });

    it("clears and restores browser state", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider("/data/sandbox.sqlite");

      const checkpointData = {
        id: "cp-123",
        name: "my-checkpoint",
        createdAt: new Date().toISOString(),
        databasePath: "/checkpoints/sandbox-001/my-checkpoint/data.sqlite",
        browserState: {
          localStorage: { theme: "light" },
          cookies: [{ name: "auth", value: "token123" }],
        },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        { name: "my-checkpoint", isDirectory: () => true } as fs.Dirent,
      ]);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(checkpointData));
      mockedFs.copyFileSync.mockReturnValue(undefined);

      await manager.restore("sandbox-001", "cp-123", browserProvider, dbProvider);

      expect(browserProvider.clearLocalStorage).toHaveBeenCalled();
      expect(browserProvider.clearCookies).toHaveBeenCalled();
      expect(browserProvider.setLocalStorage).toHaveBeenCalledWith({ theme: "light" });
      expect(browserProvider.setCookies).toHaveBeenCalledWith([
        { name: "auth", value: "token123" },
      ]);
    });

    it("throws NOT_FOUND when checkpoint does not exist", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider();

      mockedFs.existsSync.mockReturnValue(false);

      await expect(
        manager.restore("sandbox-001", "nonexistent", browserProvider, dbProvider)
      ).rejects.toThrow(CheckpointManagerError);

      await expect(
        manager.restore("sandbox-001", "nonexistent", browserProvider, dbProvider)
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("list", () => {
    it("returns empty array when no checkpoints exist", async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await manager.list("sandbox-001");

      expect(result).toEqual([]);
    });

    it("returns all checkpoints for a sandbox", async () => {
      const checkpoint1 = {
        id: "cp-1",
        name: "initial",
        createdAt: new Date("2024-01-01").toISOString(),
        databasePath: "/checkpoints/sandbox-001/initial/data.sqlite",
        browserState: { localStorage: {}, cookies: [] },
      };

      const checkpoint2 = {
        id: "cp-2",
        name: "after-login",
        createdAt: new Date("2024-01-02").toISOString(),
        databasePath: "/checkpoints/sandbox-001/after-login/data.sqlite",
        browserState: { localStorage: { user: "john" }, cookies: [] },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        { name: "initial", isDirectory: () => true } as fs.Dirent,
        { name: "after-login", isDirectory: () => true } as fs.Dirent,
      ]);
      mockedFs.readFileSync.mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.includes("initial")) return JSON.stringify(checkpoint1);
        if (pathStr.includes("after-login")) return JSON.stringify(checkpoint2);
        return "";
      });

      const result = await manager.list("sandbox-001");

      expect(result).toHaveLength(2);
      // Should be sorted by date, newest first
      expect(result[0].name).toBe("after-login");
      expect(result[1].name).toBe("initial");
    });

    it("skips non-directory entries", async () => {
      const checkpoint = {
        id: "cp-1",
        name: "valid",
        createdAt: new Date().toISOString(),
        databasePath: "/checkpoints/sandbox-001/valid/data.sqlite",
        browserState: { localStorage: {}, cookies: [] },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        { name: "valid", isDirectory: () => true } as fs.Dirent,
        { name: "somefile.txt", isDirectory: () => false } as fs.Dirent,
      ]);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(checkpoint));

      const result = await manager.list("sandbox-001");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("valid");
    });

    it("skips directories without state.json", async () => {
      const checkpoint = {
        id: "cp-1",
        name: "valid",
        createdAt: new Date().toISOString(),
        databasePath: "/checkpoints/sandbox-001/valid/data.sqlite",
        browserState: { localStorage: {}, cookies: [] },
      };

      mockedFs.existsSync.mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.includes("invalid")) return false;
        return true;
      });
      mockedFs.readdirSync.mockReturnValue([
        { name: "valid", isDirectory: () => true } as fs.Dirent,
        { name: "invalid", isDirectory: () => true } as fs.Dirent,
      ]);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(checkpoint));

      const result = await manager.list("sandbox-001");

      expect(result).toHaveLength(1);
    });

    it("converts createdAt to Date object", async () => {
      const checkpoint = {
        id: "cp-1",
        name: "test",
        createdAt: "2024-01-15T10:00:00Z",
        databasePath: "/checkpoints/sandbox-001/test/data.sqlite",
        browserState: { localStorage: {}, cookies: [] },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        { name: "test", isDirectory: () => true } as fs.Dirent,
      ]);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(checkpoint));

      const result = await manager.list("sandbox-001");

      expect(result[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe("delete", () => {
    it("deletes checkpoint directory", async () => {
      const checkpoint = {
        id: "cp-123",
        name: "to-delete",
        createdAt: new Date().toISOString(),
        databasePath: "/checkpoints/sandbox-001/to-delete/data.sqlite",
        browserState: { localStorage: {}, cookies: [] },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        { name: "to-delete", isDirectory: () => true } as fs.Dirent,
      ]);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(checkpoint));
      mockedFs.rmSync.mockReturnValue(undefined);

      await manager.delete("sandbox-001", "cp-123");

      expect(mockedFs.rmSync).toHaveBeenCalledWith(
        expect.stringContaining("to-delete"),
        { recursive: true, force: true }
      );
    });

    it("throws NOT_FOUND when checkpoint does not exist", async () => {
      mockedFs.existsSync.mockReturnValue(false);

      await expect(manager.delete("sandbox-001", "nonexistent")).rejects.toThrow(
        CheckpointManagerError
      );

      await expect(manager.delete("sandbox-001", "nonexistent")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("getByName", () => {
    it("returns checkpoint when found", async () => {
      const checkpoint = {
        id: "cp-123",
        name: "my-checkpoint",
        createdAt: new Date().toISOString(),
        databasePath: "/checkpoints/sandbox-001/my-checkpoint/data.sqlite",
        browserState: { localStorage: { key: "value" }, cookies: [] },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(checkpoint));

      const result = await manager.getByName("sandbox-001", "my-checkpoint");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("my-checkpoint");
      expect(result!.id).toBe("cp-123");
      expect(result!.createdAt).toBeInstanceOf(Date);
    });

    it("returns null when checkpoint not found", async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await manager.getByName("sandbox-001", "nonexistent");

      expect(result).toBeNull();
    });

    it("returns null on parse error", async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue("invalid json");

      const result = await manager.getByName("sandbox-001", "corrupted");

      expect(result).toBeNull();
    });
  });

  describe("createInitial", () => {
    it("creates checkpoint named 'initial'", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider("/data/sandbox.sqlite");

      mockedFs.existsSync.mockImplementation((p) => {
        if (String(p) === "/data/sandbox.sqlite") return true;
        return false;
      });
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.copyFileSync.mockReturnValue(undefined);
      mockedFs.writeFileSync.mockReturnValue(undefined);

      const checkpoint = await manager.createInitial(
        "sandbox-001",
        browserProvider,
        dbProvider
      );

      expect(checkpoint.name).toBe("initial");
    });
  });

  describe("restoreInitial", () => {
    it("restores the initial checkpoint", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider("/data/sandbox.sqlite");

      const initialCheckpoint = {
        id: "cp-initial",
        name: "initial",
        createdAt: new Date().toISOString(),
        databasePath: "/checkpoints/sandbox-001/initial/data.sqlite",
        browserState: { localStorage: {}, cookies: [] },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        { name: "initial", isDirectory: () => true } as fs.Dirent,
      ]);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(initialCheckpoint));
      mockedFs.copyFileSync.mockReturnValue(undefined);

      await manager.restoreInitial("sandbox-001", browserProvider, dbProvider);

      expect(browserProvider.clearLocalStorage).toHaveBeenCalled();
      expect(browserProvider.clearCookies).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when initial checkpoint does not exist", async () => {
      const browserProvider = createMockBrowserStateProvider();
      const dbProvider = createMockDatabaseProvider();

      mockedFs.existsSync.mockReturnValue(false);

      await expect(
        manager.restoreInitial("sandbox-001", browserProvider, dbProvider)
      ).rejects.toThrow(CheckpointManagerError);

      await expect(
        manager.restoreInitial("sandbox-001", browserProvider, dbProvider)
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});

describe("CheckpointManagerError", () => {
  it("has correct name and properties", () => {
    const error = new CheckpointManagerError("Test error", "NOT_FOUND");

    expect(error.name).toBe("CheckpointManagerError");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("NOT_FOUND");
  });

  it("is instance of Error", () => {
    const error = new CheckpointManagerError("Test error", "IO_ERROR");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CheckpointManagerError);
  });

  it("supports all error codes", () => {
    const codes = ["NOT_FOUND", "ALREADY_EXISTS", "IO_ERROR", "INVALID_STATE"] as const;

    for (const code of codes) {
      const error = new CheckpointManagerError("Test", code);
      expect(error.code).toBe(code);
    }
  });
});
