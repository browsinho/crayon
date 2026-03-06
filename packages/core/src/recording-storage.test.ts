import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  RecordingStorage,
  RecordingStorageError,
  createRecordingStorage,
} from "./recording-storage.js";
import type { DOMSnapshot, NetworkCall, Screenshot } from "@crayon/types";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import * as fs from "fs";

function createMockDomSnapshot(id: string): DOMSnapshot {
  return {
    id,
    timestamp: Date.now(),
    url: "https://example.com",
    type: "full",
    html: "<html><body>Test</body></html>",
    viewport: { width: 1280, height: 720 },
  };
}

function createMockNetworkCall(id: string): NetworkCall {
  return {
    id,
    timestamp: Date.now(),
    request: {
      method: "GET",
      url: "https://api.example.com/data",
      headers: { "Content-Type": "application/json" },
    },
    response: {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: '{"data": "test"}',
      contentType: "application/json",
    },
  };
}

function createMockScreenshot(id: string): Screenshot {
  return {
    id,
    domSnapshotId: "dom-1",
    timestamp: Date.now(),
    path: `/screenshots/${id}.png`,
    width: 1280,
    height: 720,
  };
}

describe("RecordingStorage", () => {
  let storage: RecordingStorage;
  const testBaseDir = "./test-recordings";
  let mockMetadata: Record<string, string>;

  beforeEach(() => {
    storage = new RecordingStorage({ baseDir: testBaseDir });
    mockMetadata = {};

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockImplementation((filePath, content) => {
      const pathStr = filePath.toString();
      if (pathStr.includes("metadata.json")) {
        const id = pathStr.split("/").slice(-2, -1)[0];
        mockMetadata[id] = content as string;
      }
    });
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      const pathStr = filePath.toString();
      if (pathStr.includes("metadata.json")) {
        const id = pathStr.split("/").slice(-2, -1)[0];
        return mockMetadata[id] || "";
      }
      return "";
    });
    vi.mocked(fs.readdirSync).mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates recording directory structure", async () => {
      await storage.create("rec-001", "https://example.com");

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("rec-001"),
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("dom"),
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("network"),
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("screenshots"),
        { recursive: true }
      );
    });

    it("creates metadata.json with initial values", async () => {
      await storage.create("rec-001", "https://example.com");

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("metadata.json"),
        expect.any(String)
      );

      const metadata = JSON.parse(mockMetadata["rec-001"]);
      expect(metadata.id).toBe("rec-001");
      expect(metadata.startUrl).toBe("https://example.com");
      expect(metadata.status).toBe("recording");
      expect(metadata.stats).toEqual({
        domSnapshots: 0,
        networkCalls: 0,
        screenshots: 0,
      });
      expect(metadata.createdAt).toBeDefined();
    });

    it("throws if recording directory already exists", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await expect(storage.create("rec-001", "https://example.com")).rejects.toThrow(
        RecordingStorageError
      );
      await expect(storage.create("rec-001", "https://example.com")).rejects.toThrow(
        "Recording directory already exists"
      );
    });
  });

  describe("saveDomSnapshot", () => {
    beforeEach(async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("rec-001") && !pathStr.includes("dom/") && !pathStr.includes("network/") && !pathStr.includes("screenshots/");
      });

      mockMetadata["rec-001"] = JSON.stringify({
        id: "rec-001",
        createdAt: new Date().toISOString(),
        startUrl: "https://example.com",
        status: "recording",
        stats: { domSnapshots: 0, networkCalls: 0, screenshots: 0 },
      });
    });

    it("saves DOM snapshot to dom/ directory with numbered filename", async () => {
      const snapshot = createMockDomSnapshot("dom-1");
      await storage.saveDomSnapshot("rec-001", snapshot);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/dom[/\\]00001\.json$/),
        expect.stringContaining(snapshot.id)
      );
    });

    it("increments filename for each snapshot", async () => {
      const snapshot1 = createMockDomSnapshot("dom-1");
      const snapshot2 = createMockDomSnapshot("dom-2");
      const snapshot3 = createMockDomSnapshot("dom-3");

      await storage.saveDomSnapshot("rec-001", snapshot1);
      await storage.saveDomSnapshot("rec-001", snapshot2);
      await storage.saveDomSnapshot("rec-001", snapshot3);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/dom[/\\]00001\.json$/),
        expect.any(String)
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/dom[/\\]00002\.json$/),
        expect.any(String)
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/dom[/\\]00003\.json$/),
        expect.any(String)
      );
    });

    it("updates metadata stats", async () => {
      const snapshot = createMockDomSnapshot("dom-1");
      await storage.saveDomSnapshot("rec-001", snapshot);

      const metadata = JSON.parse(mockMetadata["rec-001"]);
      expect(metadata.stats.domSnapshots).toBe(1);
    });

    it("throws if recording does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        storage.saveDomSnapshot("nonexistent", createMockDomSnapshot("dom-1"))
      ).rejects.toThrow(RecordingStorageError);
      await expect(
        storage.saveDomSnapshot("nonexistent", createMockDomSnapshot("dom-1"))
      ).rejects.toThrow("Recording not found");
    });
  });

  describe("saveNetworkCall", () => {
    beforeEach(async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("rec-001") && !pathStr.includes("dom/") && !pathStr.includes("network/") && !pathStr.includes("screenshots/");
      });

      mockMetadata["rec-001"] = JSON.stringify({
        id: "rec-001",
        createdAt: new Date().toISOString(),
        startUrl: "https://example.com",
        status: "recording",
        stats: { domSnapshots: 0, networkCalls: 0, screenshots: 0 },
      });
    });

    it("saves network call to network/ directory with numbered filename", async () => {
      const call = createMockNetworkCall("net-1");
      await storage.saveNetworkCall("rec-001", call);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/network[/\\]00001\.json$/),
        expect.stringContaining(call.id)
      );
    });

    it("increments filename for each call", async () => {
      const call1 = createMockNetworkCall("net-1");
      const call2 = createMockNetworkCall("net-2");

      await storage.saveNetworkCall("rec-001", call1);
      await storage.saveNetworkCall("rec-001", call2);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/network[/\\]00001\.json$/),
        expect.any(String)
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/network[/\\]00002\.json$/),
        expect.any(String)
      );
    });

    it("updates metadata stats", async () => {
      const call = createMockNetworkCall("net-1");
      await storage.saveNetworkCall("rec-001", call);

      const metadata = JSON.parse(mockMetadata["rec-001"]);
      expect(metadata.stats.networkCalls).toBe(1);
    });

    it("throws if recording does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        storage.saveNetworkCall("nonexistent", createMockNetworkCall("net-1"))
      ).rejects.toThrow(RecordingStorageError);
    });
  });

  describe("saveScreenshot", () => {
    beforeEach(async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("rec-001") && !pathStr.includes("dom/") && !pathStr.includes("network/") && !pathStr.includes("screenshots/");
      });

      mockMetadata["rec-001"] = JSON.stringify({
        id: "rec-001",
        createdAt: new Date().toISOString(),
        startUrl: "https://example.com",
        status: "recording",
        stats: { domSnapshots: 0, networkCalls: 0, screenshots: 0 },
      });
    });

    it("saves screenshot buffer to screenshots/ directory with numbered filename", async () => {
      const buffer = Buffer.from("fake-png-data");
      const meta = createMockScreenshot("ss-1");

      await storage.saveScreenshot("rec-001", buffer, meta);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/screenshots[/\\]00001\.png$/),
        buffer
      );
    });

    it("saves screenshot metadata as JSON", async () => {
      const buffer = Buffer.from("fake-png-data");
      const meta = createMockScreenshot("ss-1");

      await storage.saveScreenshot("rec-001", buffer, meta);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/screenshots[/\\]00001\.json$/),
        expect.stringContaining(meta.id)
      );
    });

    it("increments filename for each screenshot", async () => {
      const buffer = Buffer.from("fake-png-data");

      await storage.saveScreenshot("rec-001", buffer, createMockScreenshot("ss-1"));
      await storage.saveScreenshot("rec-001", buffer, createMockScreenshot("ss-2"));

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/screenshots[/\\]00001\.png$/),
        expect.any(Buffer)
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/screenshots[/\\]00002\.png$/),
        expect.any(Buffer)
      );
    });

    it("updates metadata stats", async () => {
      const buffer = Buffer.from("fake-png-data");
      await storage.saveScreenshot("rec-001", buffer, createMockScreenshot("ss-1"));

      const metadata = JSON.parse(mockMetadata["rec-001"]);
      expect(metadata.stats.screenshots).toBe(1);
    });

    it("throws if recording does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        storage.saveScreenshot("nonexistent", Buffer.from("data"), createMockScreenshot("ss-1"))
      ).rejects.toThrow(RecordingStorageError);
    });
  });

  describe("finalize", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("rec-001");
      });

      mockMetadata["rec-001"] = JSON.stringify({
        id: "rec-001",
        createdAt: new Date().toISOString(),
        startUrl: "https://example.com",
        status: "recording",
        stats: { domSnapshots: 5, networkCalls: 10, screenshots: 3 },
      });
    });

    it("sets status to completed", async () => {
      const result = await storage.finalize("rec-001");

      expect(result.status).toBe("completed");
    });

    it("returns updated metadata", async () => {
      const result = await storage.finalize("rec-001");

      expect(result.id).toBe("rec-001");
      expect(result.startUrl).toBe("https://example.com");
      expect(result.stats).toEqual({
        domSnapshots: 5,
        networkCalls: 10,
        screenshots: 3,
      });
    });

    it("saves updated metadata to disk", async () => {
      await storage.finalize("rec-001");

      const savedMetadata = JSON.parse(mockMetadata["rec-001"]);
      expect(savedMetadata.status).toBe("completed");
    });

    it("throws if recording does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(storage.finalize("nonexistent")).rejects.toThrow(
        RecordingStorageError
      );
    });
  });

  describe("load", () => {
    const mockDom1 = createMockDomSnapshot("dom-1");
    const mockDom2 = createMockDomSnapshot("dom-2");
    const mockNet1 = createMockNetworkCall("net-1");
    const mockNet2 = createMockNetworkCall("net-2");
    const mockSs1 = createMockScreenshot("ss-1");
    const mockSs2 = createMockScreenshot("ss-2");

    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      mockMetadata["rec-001"] = JSON.stringify({
        id: "rec-001",
        createdAt: new Date().toISOString(),
        startUrl: "https://example.com",
        status: "completed",
        stats: { domSnapshots: 2, networkCalls: 2, screenshots: 2 },
      });

      vi.mocked(fs.readdirSync).mockImplementation((dir) => {
        const dirStr = dir.toString();
        if (dirStr.includes("dom")) {
          return ["00001.json", "00002.json"] as unknown as ReturnType<typeof fs.readdirSync>;
        }
        if (dirStr.includes("network")) {
          return ["00001.json", "00002.json"] as unknown as ReturnType<typeof fs.readdirSync>;
        }
        if (dirStr.includes("screenshots")) {
          return ["00001.json", "00001.png", "00002.json", "00002.png"] as unknown as ReturnType<typeof fs.readdirSync>;
        }
        return [] as unknown as ReturnType<typeof fs.readdirSync>;
      });

      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.includes("metadata.json")) {
          return mockMetadata["rec-001"];
        }
        if (pathStr.includes("dom/00001.json")) {
          return JSON.stringify(mockDom1);
        }
        if (pathStr.includes("dom/00002.json")) {
          return JSON.stringify(mockDom2);
        }
        if (pathStr.includes("network/00001.json")) {
          return JSON.stringify(mockNet1);
        }
        if (pathStr.includes("network/00002.json")) {
          return JSON.stringify(mockNet2);
        }
        if (pathStr.includes("screenshots/00001.json")) {
          return JSON.stringify(mockSs1);
        }
        if (pathStr.includes("screenshots/00002.json")) {
          return JSON.stringify(mockSs2);
        }
        return "";
      });
    });

    it("loads recording with all data", async () => {
      const recording = await storage.load("rec-001");

      expect(recording.metadata.id).toBe("rec-001");
      expect(recording.domSnapshots).toHaveLength(2);
      expect(recording.networkCalls).toHaveLength(2);
      expect(recording.screenshots).toHaveLength(2);
    });

    it("loads DOM snapshots in order", async () => {
      const recording = await storage.load("rec-001");

      expect(recording.domSnapshots[0].id).toBe("dom-1");
      expect(recording.domSnapshots[1].id).toBe("dom-2");
    });

    it("loads network calls in order", async () => {
      const recording = await storage.load("rec-001");

      expect(recording.networkCalls[0].id).toBe("net-1");
      expect(recording.networkCalls[1].id).toBe("net-2");
    });

    it("loads screenshots in order", async () => {
      const recording = await storage.load("rec-001");

      expect(recording.screenshots[0].id).toBe("ss-1");
      expect(recording.screenshots[1].id).toBe("ss-2");
    });

    it("throws if recording does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(storage.load("nonexistent")).rejects.toThrow(
        RecordingStorageError
      );
      await expect(storage.load("nonexistent")).rejects.toThrow(
        "Recording not found"
      );
    });
  });

  describe("integration test: save and load multiple items", () => {
    const domSnapshots = Array.from({ length: 5 }, (_, i) =>
      createMockDomSnapshot(`dom-${i + 1}`)
    );
    const networkCalls = Array.from({ length: 5 }, (_, i) =>
      createMockNetworkCall(`net-${i + 1}`)
    );
    const screenshots = Array.from({ length: 5 }, (_, i) =>
      createMockScreenshot(`ss-${i + 1}`)
    );

    beforeEach(() => {
      const savedFiles: Record<string, string | Buffer> = {};

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        if (pathStr.includes("rec-integration")) {
          if (pathStr.endsWith("rec-integration")) {
            return savedFiles["rec-integration-created"] !== undefined;
          }
          return true;
        }
        return false;
      });

      vi.mocked(fs.mkdirSync).mockImplementation((dir) => {
        const dirStr = dir.toString();
        if (dirStr.includes("rec-integration")) {
          savedFiles["rec-integration-created"] = "true";
        }
        return undefined;
      });

      vi.mocked(fs.writeFileSync).mockImplementation((filePath, content) => {
        savedFiles[filePath.toString()] = content as string | Buffer;
      });

      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        const content = savedFiles[pathStr];
        if (content !== undefined) {
          return typeof content === "string" ? content : content.toString();
        }
        return "";
      });

      vi.mocked(fs.readdirSync).mockImplementation((dir) => {
        const dirStr = dir.toString();
        const files: string[] = [];

        for (const key of Object.keys(savedFiles)) {
          if (key.includes(dirStr)) {
            const filename = key.split("/").pop() || "";
            if (filename && !files.includes(filename)) {
              files.push(filename);
            }
          }
        }

        return files.sort() as unknown as ReturnType<typeof fs.readdirSync>;
      });
    });

    it("saves and loads 5 of each type with accurate stats", async () => {
      await storage.create("rec-integration", "https://example.com");

      for (const snapshot of domSnapshots) {
        await storage.saveDomSnapshot("rec-integration", snapshot);
      }

      for (const call of networkCalls) {
        await storage.saveNetworkCall("rec-integration", call);
      }

      for (const screenshot of screenshots) {
        await storage.saveScreenshot(
          "rec-integration",
          Buffer.from("fake-png"),
          screenshot
        );
      }

      const metadata = await storage.finalize("rec-integration");

      expect(metadata.status).toBe("completed");
      expect(metadata.stats.domSnapshots).toBe(5);
      expect(metadata.stats.networkCalls).toBe(5);
      expect(metadata.stats.screenshots).toBe(5);
    });
  });
});

describe("RecordingStorageError", () => {
  it("creates error with message", () => {
    const error = new RecordingStorageError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("RecordingStorageError");
  });

  it("creates error with cause", () => {
    const cause = new Error("Original error");
    const error = new RecordingStorageError("Test error", cause);
    expect(error.cause).toBe(cause);
  });
});

describe("createRecordingStorage helper", () => {
  it("creates RecordingStorage instance", () => {
    const storage = createRecordingStorage();
    expect(storage).toBeInstanceOf(RecordingStorage);
  });

  it("passes config to RecordingStorage", () => {
    const storage = createRecordingStorage({ baseDir: "./custom-dir" });
    expect(storage).toBeInstanceOf(RecordingStorage);
  });
});
