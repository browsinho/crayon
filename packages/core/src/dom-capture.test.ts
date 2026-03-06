import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DOMCapture, DOMCaptureError, createDOMCapture } from "./dom-capture.js";
import type { CDPSession } from "./dom-capture.js";

function createMockCDPSession(): CDPSession & {
  mockSend: ReturnType<typeof vi.fn>;
  handlers: Map<string, ((params: unknown) => void)[]>;
  emit: (event: string, params: unknown) => void;
} {
  const handlers = new Map<string, ((params: unknown) => void)[]>();
  const mockSend = vi.fn();

  return {
    mockSend,
    handlers,
    send: mockSend,
    on: (event: string, handler: (params: unknown) => void) => {
      const eventHandlers = handlers.get(event) || [];
      eventHandlers.push(handler);
      handlers.set(event, eventHandlers);
    },
    off: (event: string, handler: (params: unknown) => void) => {
      const eventHandlers = handlers.get(event) || [];
      const index = eventHandlers.indexOf(handler);
      if (index > -1) {
        eventHandlers.splice(index, 1);
      }
      handlers.set(event, eventHandlers);
    },
    emit: (event: string, params: unknown) => {
      const eventHandlers = handlers.get(event) || [];
      for (const handler of eventHandlers) {
        handler(params);
      }
    },
  };
}

function setupDefaultMocks(mockSession: ReturnType<typeof createMockCDPSession>) {
  mockSession.mockSend.mockImplementation((method: string) => {
    if (method === "DOM.enable" || method === "Page.enable") {
      return Promise.resolve();
    }
    if (method === "DOM.getDocument") {
      return Promise.resolve({
        root: {
          nodeId: 1,
          backendNodeId: 1,
          nodeType: 9,
          nodeName: "#document",
        },
      });
    }
    if (method === "DOM.getOuterHTML") {
      return Promise.resolve({
        outerHTML: "<!DOCTYPE html><html><head></head><body><h1>Hello</h1></body></html>",
      });
    }
    if (method === "Page.getLayoutMetrics") {
      return Promise.resolve({
        layoutViewport: { pageX: 0, pageY: 0, clientWidth: 1280, clientHeight: 720 },
        visualViewport: {
          offsetX: 0,
          offsetY: 0,
          pageX: 0,
          pageY: 0,
          clientWidth: 1280,
          clientHeight: 720,
          scale: 1,
        },
        contentSize: { x: 0, y: 0, width: 1280, height: 720 },
      });
    }
    if (method === "Runtime.evaluate") {
      return Promise.resolve({
        result: { value: "https://example.com" },
      });
    }
    return Promise.resolve();
  });
}

describe("DOMCapture", () => {
  let mockSession: ReturnType<typeof createMockCDPSession>;
  let domCapture: DOMCapture;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSession = createMockCDPSession();
    setupDefaultMocks(mockSession);
    domCapture = new DOMCapture();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("attach", () => {
    it("enables DOM and Page domains", async () => {
      await domCapture.attach(mockSession);

      expect(mockSession.mockSend).toHaveBeenCalledWith("DOM.enable");
      expect(mockSession.mockSend).toHaveBeenCalledWith("Page.enable");
    });

    it("sets up event listeners", async () => {
      await domCapture.attach(mockSession);

      expect(mockSession.handlers.get("DOM.childNodeInserted")).toHaveLength(1);
      expect(mockSession.handlers.get("DOM.childNodeRemoved")).toHaveLength(1);
      expect(mockSession.handlers.get("DOM.attributeModified")).toHaveLength(1);
      expect(mockSession.handlers.get("DOM.characterDataModified")).toHaveLength(1);
      expect(mockSession.handlers.get("DOM.documentUpdated")).toHaveLength(1);
      expect(mockSession.handlers.get("Page.frameNavigated")).toHaveLength(1);
      expect(mockSession.handlers.get("Page.loadEventFired")).toHaveLength(1);
    });

    it("captures initial snapshot", async () => {
      await domCapture.attach(mockSession);

      const snapshots = domCapture.getSnapshots();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].type).toBe("full");
      expect(snapshots[0].html).toContain("<html>");
    });

    it("throws if already attached", async () => {
      await domCapture.attach(mockSession);

      await expect(domCapture.attach(mockSession)).rejects.toThrow(DOMCaptureError);
      await expect(domCapture.attach(mockSession)).rejects.toThrow(
        "Already attached to a CDP session"
      );
    });
  });

  describe("stop", () => {
    it("removes event listeners", async () => {
      await domCapture.attach(mockSession);
      domCapture.stop();

      expect(mockSession.handlers.get("DOM.childNodeInserted")).toHaveLength(0);
      expect(mockSession.handlers.get("DOM.childNodeRemoved")).toHaveLength(0);
      expect(mockSession.handlers.get("DOM.attributeModified")).toHaveLength(0);
      expect(mockSession.handlers.get("DOM.characterDataModified")).toHaveLength(0);
      expect(mockSession.handlers.get("DOM.documentUpdated")).toHaveLength(0);
      expect(mockSession.handlers.get("Page.frameNavigated")).toHaveLength(0);
      expect(mockSession.handlers.get("Page.loadEventFired")).toHaveLength(0);
    });

    it("flushes pending mutations if threshold met", async () => {
      await domCapture.attach(mockSession);
      const initialCount = domCapture.getSnapshots().length;

      for (let i = 0; i < 15; i++) {
        mockSession.emit("DOM.childNodeInserted", {
          parentNodeId: 1,
          previousNodeId: 0,
          node: { nodeId: i + 100 },
        });
      }

      domCapture.stop();

      const snapshots = domCapture.getSnapshots();
      expect(snapshots.length).toBe(initialCount + 1);
      expect(snapshots[snapshots.length - 1].type).toBe("diff");
    });

    it("is safe to call when not attached", () => {
      expect(() => domCapture.stop()).not.toThrow();
    });
  });

  describe("getSnapshots", () => {
    it("returns copy of snapshots array", async () => {
      await domCapture.attach(mockSession);

      const snapshots1 = domCapture.getSnapshots();
      const snapshots2 = domCapture.getSnapshots();

      expect(snapshots1).not.toBe(snapshots2);
      expect(snapshots1).toEqual(snapshots2);
    });
  });

  describe("snapshot creation", () => {
    it("creates snapshot with correct structure", async () => {
      await domCapture.attach(mockSession);

      const snapshots = domCapture.getSnapshots();
      const snapshot = snapshots[0];

      expect(snapshot).toHaveProperty("id");
      expect(snapshot).toHaveProperty("timestamp");
      expect(snapshot).toHaveProperty("url");
      expect(snapshot).toHaveProperty("type");
      expect(snapshot).toHaveProperty("viewport");
      expect(snapshot.viewport).toHaveProperty("width");
      expect(snapshot.viewport).toHaveProperty("height");
    });

    it("full snapshot includes html", async () => {
      await domCapture.attach(mockSession);

      const snapshots = domCapture.getSnapshots();
      expect(snapshots[0].html).toBeDefined();
      expect(snapshots[0].mutations).toBeUndefined();
    });
  });

  describe("mutation batching", () => {
    it("batches rapid mutations", async () => {
      await domCapture.attach(mockSession);
      const initialCount = domCapture.getSnapshots().length;

      for (let i = 0; i < 15; i++) {
        mockSession.emit("DOM.childNodeInserted", {
          parentNodeId: 1,
          previousNodeId: 0,
          node: { nodeId: i + 100 },
        });
      }

      await vi.advanceTimersByTimeAsync(150);

      const snapshots = domCapture.getSnapshots();
      expect(snapshots.length).toBe(initialCount + 1);
      expect(snapshots[snapshots.length - 1].type).toBe("diff");
      expect(snapshots[snapshots.length - 1].mutations?.length).toBe(15);
    });

    it("does not create snapshot if mutations below threshold", async () => {
      await domCapture.attach(mockSession);
      const initialCount = domCapture.getSnapshots().length;

      for (let i = 0; i < 5; i++) {
        mockSession.emit("DOM.childNodeInserted", {
          parentNodeId: 1,
          previousNodeId: 0,
          node: { nodeId: i + 100 },
        });
      }

      await vi.advanceTimersByTimeAsync(150);

      const snapshots = domCapture.getSnapshots();
      expect(snapshots.length).toBe(initialCount);
    });

    it("respects custom batch interval", async () => {
      const customCapture = new DOMCapture({ mutationBatchInterval: 200 });
      await customCapture.attach(mockSession);
      const initialCount = customCapture.getSnapshots().length;

      for (let i = 0; i < 15; i++) {
        mockSession.emit("DOM.childNodeInserted", {
          parentNodeId: 1,
          previousNodeId: 0,
          node: { nodeId: i + 100 },
        });
      }

      await vi.advanceTimersByTimeAsync(150);
      expect(customCapture.getSnapshots().length).toBe(initialCount);

      await vi.advanceTimersByTimeAsync(100);
      expect(customCapture.getSnapshots().length).toBe(initialCount + 1);

      customCapture.stop();
    });

    it("respects custom mutation threshold", async () => {
      const customCapture = new DOMCapture({ mutationThreshold: 5 });
      await customCapture.attach(mockSession);
      const initialCount = customCapture.getSnapshots().length;

      for (let i = 0; i < 6; i++) {
        mockSession.emit("DOM.childNodeInserted", {
          parentNodeId: 1,
          previousNodeId: 0,
          node: { nodeId: i + 100 },
        });
      }

      await vi.advanceTimersByTimeAsync(150);

      const snapshots = customCapture.getSnapshots();
      expect(snapshots.length).toBe(initialCount + 1);

      customCapture.stop();
    });
  });

  describe("mutation events", () => {
    it("handles childNodeInserted", async () => {
      await domCapture.attach(mockSession);

      for (let i = 0; i < 15; i++) {
        mockSession.emit("DOM.childNodeInserted", {
          parentNodeId: 1,
          previousNodeId: 0,
          node: { nodeId: i + 100 },
        });
      }

      await vi.advanceTimersByTimeAsync(150);

      const snapshots = domCapture.getSnapshots();
      const lastSnapshot = snapshots[snapshots.length - 1];
      expect(lastSnapshot.mutations?.[0].type).toBe("childList");
      expect(lastSnapshot.mutations?.[0].addedNodes).toBeDefined();
    });

    it("handles childNodeRemoved", async () => {
      await domCapture.attach(mockSession);

      for (let i = 0; i < 15; i++) {
        mockSession.emit("DOM.childNodeRemoved", {
          parentNodeId: 1,
          nodeId: i + 100,
        });
      }

      await vi.advanceTimersByTimeAsync(150);

      const snapshots = domCapture.getSnapshots();
      const lastSnapshot = snapshots[snapshots.length - 1];
      expect(lastSnapshot.mutations?.[0].type).toBe("childList");
      expect(lastSnapshot.mutations?.[0].removedNodes).toBeDefined();
    });

    it("handles attributeModified", async () => {
      await domCapture.attach(mockSession);

      for (let i = 0; i < 15; i++) {
        mockSession.emit("DOM.attributeModified", {
          nodeId: 10,
          name: "class",
          value: `value-${i}`,
        });
      }

      await vi.advanceTimersByTimeAsync(150);

      const snapshots = domCapture.getSnapshots();
      const lastSnapshot = snapshots[snapshots.length - 1];
      expect(lastSnapshot.mutations?.[0].type).toBe("attributes");
      expect(lastSnapshot.mutations?.[0].attributeName).toBe("class");
    });

    it("handles characterDataModified", async () => {
      await domCapture.attach(mockSession);

      for (let i = 0; i < 15; i++) {
        mockSession.emit("DOM.characterDataModified", {
          nodeId: 10,
          characterData: `text-${i}`,
        });
      }

      await vi.advanceTimersByTimeAsync(150);

      const snapshots = domCapture.getSnapshots();
      const lastSnapshot = snapshots[snapshots.length - 1];
      expect(lastSnapshot.mutations?.[0].type).toBe("characterData");
      expect(lastSnapshot.mutations?.[0].newValue).toBeDefined();
    });
  });

  describe("navigation and page load events", () => {
    it("captures full snapshot on frameNavigated (main frame)", async () => {
      await domCapture.attach(mockSession);
      const initialCount = domCapture.getSnapshots().length;

      mockSession.mockSend.mockImplementation((method: string) => {
        if (method === "Runtime.evaluate") {
          return Promise.resolve({
            result: { value: "https://example.com/new-page" },
          });
        }
        if (method === "DOM.getDocument") {
          return Promise.resolve({
            root: { nodeId: 2, backendNodeId: 2, nodeType: 9, nodeName: "#document" },
          });
        }
        if (method === "DOM.getOuterHTML") {
          return Promise.resolve({
            outerHTML: "<!DOCTYPE html><html><body>New Page</body></html>",
          });
        }
        if (method === "Page.getLayoutMetrics") {
          return Promise.resolve({
            layoutViewport: { pageX: 0, pageY: 0, clientWidth: 1280, clientHeight: 720 },
            visualViewport: {
              offsetX: 0,
              offsetY: 0,
              pageX: 0,
              pageY: 0,
              clientWidth: 1280,
              clientHeight: 720,
              scale: 1,
            },
            contentSize: { x: 0, y: 0, width: 1280, height: 720 },
          });
        }
        return Promise.resolve();
      });

      mockSession.emit("Page.frameNavigated", {
        frame: {
          id: "main",
          url: "https://example.com/new-page",
        },
      });

      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      const snapshots = domCapture.getSnapshots();
      expect(snapshots.length).toBeGreaterThan(initialCount);
      expect(snapshots[snapshots.length - 1].type).toBe("full");
    });

    it("ignores iframe navigations", async () => {
      await domCapture.attach(mockSession);
      const initialCount = domCapture.getSnapshots().length;

      mockSession.emit("Page.frameNavigated", {
        frame: {
          id: "iframe-1",
          parentId: "main",
          url: "https://example.com/iframe",
        },
      });

      await vi.advanceTimersByTimeAsync(0);

      expect(domCapture.getSnapshots().length).toBe(initialCount);
    });

    it("captures full snapshot on loadEventFired", async () => {
      await domCapture.attach(mockSession);
      const initialCount = domCapture.getSnapshots().length;

      mockSession.emit("Page.loadEventFired", { timestamp: Date.now() });

      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      const snapshots = domCapture.getSnapshots();
      expect(snapshots.length).toBeGreaterThan(initialCount);
      expect(snapshots[snapshots.length - 1].type).toBe("full");
    });

    it("captures full snapshot on documentUpdated", async () => {
      await domCapture.attach(mockSession);
      const initialCount = domCapture.getSnapshots().length;

      mockSession.emit("DOM.documentUpdated", {});

      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      const snapshots = domCapture.getSnapshots();
      expect(snapshots.length).toBeGreaterThan(initialCount);
    });

    it("clears pending mutations on documentUpdated", async () => {
      await domCapture.attach(mockSession);

      for (let i = 0; i < 5; i++) {
        mockSession.emit("DOM.childNodeInserted", {
          parentNodeId: 1,
          previousNodeId: 0,
          node: { nodeId: i + 100 },
        });
      }

      mockSession.emit("DOM.documentUpdated", {});

      await vi.advanceTimersByTimeAsync(150);

      const snapshots = domCapture.getSnapshots();
      const diffSnapshots = snapshots.filter((s) => s.type === "diff");
      expect(diffSnapshots).toHaveLength(0);
    });
  });
});

describe("DOMCaptureError", () => {
  it("creates error with message", () => {
    const error = new DOMCaptureError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("DOMCaptureError");
  });

  it("creates error with cause", () => {
    const cause = new Error("Original error");
    const error = new DOMCaptureError("Test error", cause);
    expect(error.cause).toBe(cause);
  });
});

describe("createDOMCapture helper", () => {
  it("creates DOMCapture instance", () => {
    const capture = createDOMCapture();
    expect(capture).toBeInstanceOf(DOMCapture);
  });

  it("passes config to DOMCapture", async () => {
    vi.useFakeTimers();
    const mockSession = createMockCDPSession();
    setupDefaultMocks(mockSession);

    const capture = createDOMCapture({ mutationBatchInterval: 500 });
    await capture.attach(mockSession);

    for (let i = 0; i < 15; i++) {
      mockSession.emit("DOM.childNodeInserted", {
        parentNodeId: 1,
        previousNodeId: 0,
        node: { nodeId: i + 100 },
      });
    }

    await vi.advanceTimersByTimeAsync(200);
    const initialCount = capture.getSnapshots().length;
    expect(initialCount).toBe(1);

    await vi.advanceTimersByTimeAsync(400);
    expect(capture.getSnapshots().length).toBe(2);

    capture.stop();
    vi.useRealTimers();
  });
});
