import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  ScreenshotCapture,
  ScreenshotCaptureError,
  createScreenshotCapture,
} from "./screenshot-capture.js";
import type { CDPSession } from "./screenshot-capture.js";

// Mock fs module at the top level
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(() => undefined),
  writeFileSync: vi.fn(() => undefined),
}));

// Import mocked fs after mocking
import * as fs from "fs";

// Valid PNG header (8 bytes) + minimal IHDR chunk
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
  0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x05, 0x00, // width: 1280
  0x00, 0x00, 0x02, 0xd0, // height: 720
  0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, etc
  0x00, 0x00, 0x00, 0x00, // CRC (dummy)
]);

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

function setupDefaultMocks(
  mockSession: ReturnType<typeof createMockCDPSession>
) {
  mockSession.mockSend.mockImplementation((method: string) => {
    if (method === "Page.captureScreenshot") {
      return Promise.resolve({
        data: VALID_PNG_BUFFER.toString("base64"),
      });
    }
    if (method === "Page.getLayoutMetrics") {
      return Promise.resolve({
        layoutViewport: {
          pageX: 0,
          pageY: 0,
          clientWidth: 1280,
          clientHeight: 720,
        },
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
}

describe("ScreenshotCapture", () => {
  let mockSession: ReturnType<typeof createMockCDPSession>;
  let screenshotCapture: ScreenshotCapture;
  const testOutputDir = "./test-screenshots";

  beforeEach(() => {
    mockSession = createMockCDPSession();
    setupDefaultMocks(mockSession);
    screenshotCapture = new ScreenshotCapture({ outputDir: testOutputDir });

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("attach", () => {
    it("attaches to CDP session", () => {
      expect(() => screenshotCapture.attach(mockSession)).not.toThrow();
    });

    it("throws if already attached", () => {
      screenshotCapture.attach(mockSession);

      expect(() => screenshotCapture.attach(mockSession)).toThrow(
        ScreenshotCaptureError
      );
      expect(() => screenshotCapture.attach(mockSession)).toThrow(
        "Already attached to a CDP session"
      );
    });

    it("clears previous screenshots on attach", async () => {
      screenshotCapture.attach(mockSession);
      await screenshotCapture.capture("dom-1");
      expect(screenshotCapture.getScreenshots()).toHaveLength(1);

      screenshotCapture.stop();
      screenshotCapture.attach(mockSession);
      expect(screenshotCapture.getScreenshots()).toHaveLength(0);
    });
  });

  describe("stop", () => {
    it("stops capturing without error", () => {
      screenshotCapture.attach(mockSession);
      expect(() => screenshotCapture.stop()).not.toThrow();
    });

    it("is safe to call when not attached", () => {
      expect(() => screenshotCapture.stop()).not.toThrow();
    });
  });

  describe("capture", () => {
    it("throws if not attached", async () => {
      await expect(screenshotCapture.capture("dom-1")).rejects.toThrow(
        ScreenshotCaptureError
      );
      await expect(screenshotCapture.capture("dom-1")).rejects.toThrow(
        "Not attached to a CDP session"
      );
    });

    it("calls Page.captureScreenshot with PNG format", async () => {
      screenshotCapture.attach(mockSession);
      await screenshotCapture.capture("dom-1");

      expect(mockSession.mockSend).toHaveBeenCalledWith(
        "Page.captureScreenshot",
        { format: "png" }
      );
    });

    it("returns screenshot with correct structure", async () => {
      screenshotCapture.attach(mockSession);
      const screenshot = await screenshotCapture.capture("dom-snapshot-123");

      expect(screenshot).toHaveProperty("id");
      expect(screenshot).toHaveProperty("domSnapshotId", "dom-snapshot-123");
      expect(screenshot).toHaveProperty("timestamp");
      expect(screenshot).toHaveProperty("path");
      expect(screenshot).toHaveProperty("width", 1280);
      expect(screenshot).toHaveProperty("height", 720);
    });

    it("generates unique screenshot IDs", async () => {
      screenshotCapture.attach(mockSession);

      const screenshot1 = await screenshotCapture.capture("dom-1");
      const screenshot2 = await screenshotCapture.capture("dom-2");

      expect(screenshot1.id).not.toBe(screenshot2.id);
      expect(screenshot1.id).toMatch(/^screenshot-\d+-[a-z0-9]+$/);
      expect(screenshot2.id).toMatch(/^screenshot-\d+-[a-z0-9]+$/);
    });

    it("links screenshot to DOM snapshot ID", async () => {
      screenshotCapture.attach(mockSession);

      const screenshot = await screenshotCapture.capture("dom-snapshot-456");

      expect(screenshot.domSnapshotId).toBe("dom-snapshot-456");
    });

    it("writes PNG file to output directory", async () => {
      screenshotCapture.attach(mockSession);
      const screenshot = await screenshotCapture.capture("dom-1");

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        screenshot.path,
        expect.any(Buffer)
      );
      expect(screenshot.path).toContain("test-screenshots");
      expect(screenshot.path).toMatch(/\.png$/);
    });

    it("creates output directory if it does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      screenshotCapture.attach(mockSession);
      await screenshotCapture.capture("dom-1");

      expect(fs.mkdirSync).toHaveBeenCalledWith(testOutputDir, {
        recursive: true,
      });
    });

    it("captures viewport dimensions", async () => {
      mockSession.mockSend.mockImplementation((method: string) => {
        if (method === "Page.captureScreenshot") {
          return Promise.resolve({
            data: VALID_PNG_BUFFER.toString("base64"),
          });
        }
        if (method === "Page.getLayoutMetrics") {
          return Promise.resolve({
            visualViewport: {
              clientWidth: 1920,
              clientHeight: 1080,
            },
          });
        }
        return Promise.resolve();
      });

      screenshotCapture.attach(mockSession);
      const screenshot = await screenshotCapture.capture("dom-1");

      expect(screenshot.width).toBe(1920);
      expect(screenshot.height).toBe(1080);
    });

    it("stores screenshots in internal array", async () => {
      screenshotCapture.attach(mockSession);

      await screenshotCapture.capture("dom-1");
      await screenshotCapture.capture("dom-2");
      await screenshotCapture.capture("dom-3");

      const screenshots = screenshotCapture.getScreenshots();
      expect(screenshots).toHaveLength(3);
    });
  });

  describe("getScreenshots", () => {
    it("returns copy of screenshots array", async () => {
      screenshotCapture.attach(mockSession);
      await screenshotCapture.capture("dom-1");

      const screenshots1 = screenshotCapture.getScreenshots();
      const screenshots2 = screenshotCapture.getScreenshots();

      expect(screenshots1).not.toBe(screenshots2);
      expect(screenshots1).toEqual(screenshots2);
    });

    it("returns empty array when no screenshots captured", () => {
      screenshotCapture.attach(mockSession);
      expect(screenshotCapture.getScreenshots()).toEqual([]);
    });
  });

  describe("PNG validation", () => {
    it("validates PNG buffer has correct signature", async () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      mockSession.mockSend.mockImplementation((method: string) => {
        if (method === "Page.captureScreenshot") {
          return Promise.resolve({
            data: invalidBuffer.toString("base64"),
          });
        }
        if (method === "Page.getLayoutMetrics") {
          return Promise.resolve({
            visualViewport: { clientWidth: 1280, clientHeight: 720 },
          });
        }
        return Promise.resolve();
      });

      screenshotCapture.attach(mockSession);

      await expect(screenshotCapture.capture("dom-1")).rejects.toThrow(
        ScreenshotCaptureError
      );
      await expect(screenshotCapture.capture("dom-1")).rejects.toThrow(
        "Invalid PNG data received from CDP"
      );
    });

    it("accepts valid PNG buffer", async () => {
      screenshotCapture.attach(mockSession);

      await expect(screenshotCapture.capture("dom-1")).resolves.not.toThrow();
    });
  });

  describe("error handling", () => {
    it("wraps CDP errors in ScreenshotCaptureError", async () => {
      mockSession.mockSend.mockImplementation((method: string) => {
        if (method === "Page.captureScreenshot") {
          return Promise.reject(new Error("CDP connection failed"));
        }
        if (method === "Page.getLayoutMetrics") {
          return Promise.resolve({
            visualViewport: { clientWidth: 1280, clientHeight: 720 },
          });
        }
        return Promise.resolve();
      });

      screenshotCapture.attach(mockSession);

      await expect(screenshotCapture.capture("dom-1")).rejects.toThrow(
        ScreenshotCaptureError
      );
      await expect(screenshotCapture.capture("dom-1")).rejects.toThrow(
        "Failed to capture screenshot: CDP connection failed"
      );
    });

    it("uses default viewport if getLayoutMetrics fails", async () => {
      mockSession.mockSend.mockImplementation((method: string) => {
        if (method === "Page.captureScreenshot") {
          return Promise.resolve({
            data: VALID_PNG_BUFFER.toString("base64"),
          });
        }
        if (method === "Page.getLayoutMetrics") {
          return Promise.reject(new Error("Metrics unavailable"));
        }
        return Promise.resolve();
      });

      screenshotCapture.attach(mockSession);
      const screenshot = await screenshotCapture.capture("dom-1");

      expect(screenshot.width).toBe(1280);
      expect(screenshot.height).toBe(720);
    });
  });
});

describe("ScreenshotCaptureError", () => {
  it("creates error with message", () => {
    const error = new ScreenshotCaptureError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("ScreenshotCaptureError");
  });

  it("creates error with cause", () => {
    const cause = new Error("Original error");
    const error = new ScreenshotCaptureError("Test error", cause);
    expect(error.cause).toBe(cause);
  });
});

describe("createScreenshotCapture helper", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates ScreenshotCapture instance", () => {
    const capture = createScreenshotCapture();
    expect(capture).toBeInstanceOf(ScreenshotCapture);
  });

  it("passes config to ScreenshotCapture", async () => {
    const mockSession = createMockCDPSession();
    setupDefaultMocks(mockSession);

    const capture = createScreenshotCapture({ outputDir: "./custom-dir" });
    capture.attach(mockSession);

    const screenshot = await capture.capture("dom-1");
    expect(screenshot.path).toContain("custom-dir");

    capture.stop();
  });
});
