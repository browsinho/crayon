import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page, CDPSession } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { ScreenshotCapture } from "./screenshot-capture.js";
import type { CDPSession as ScreenshotCaptureCDPSession } from "./screenshot-capture.js";

const ANCHOR_API_KEY = process.env.ANCHOR_BROWSER_API_KEY;

function wrapPlaywrightCDPSession(
  session: CDPSession
): ScreenshotCaptureCDPSession {
  return {
    send: (method: string, params?: Record<string, unknown>) =>
      session.send(method, params),
    on: (event: string, handler: (params: unknown) => void) => {
      session.on(event, handler);
    },
    off: (event: string, handler: (params: unknown) => void) => {
      session.off(event, handler);
    },
  };
}

function isValidPNG(buffer: Buffer): boolean {
  if (buffer.length < 8) {
    return false;
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== pngSignature[i]) {
      return false;
    }
  }
  return true;
}

describe.skipIf(!ANCHOR_API_KEY)("ScreenshotCapture Integration", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let cdpSession: CDPSession;
  let wrappedSession: ScreenshotCaptureCDPSession;
  const testOutputDir = "./test-integration-screenshots";

  beforeAll(async () => {
    if (!ANCHOR_API_KEY) {
      throw new Error("ANCHOR_BROWSER_API_KEY environment variable is required");
    }

    browser = await chromium.connectOverCDP(
      `wss://connect.anchorbrowser.io?apiKey=${ANCHOR_API_KEY}`
    );
    context = browser.contexts()[0] || (await browser.newContext());
    page = context.pages()[0] || (await context.newPage());
    cdpSession = await context.newCDPSession(page);
    wrappedSession = wrapPlaywrightCDPSession(cdpSession);

    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  }, 60000);

  afterAll(async () => {
    try {
      await cdpSession?.detach();
    } catch {
      // Session may already be detached
    }
    try {
      await browser?.close();
    } catch {
      // Browser may already be closed
    }

    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    const files = fs.existsSync(testOutputDir)
      ? fs.readdirSync(testOutputDir)
      : [];
    for (const file of files) {
      fs.unlinkSync(path.join(testOutputDir, file));
    }
  });

  it("captures screenshot from real browser session", async () => {
    const screenshotCapture = new ScreenshotCapture({
      outputDir: testOutputDir,
    });

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    screenshotCapture.attach(wrappedSession);

    const screenshot = await screenshotCapture.capture("dom-snapshot-1");

    expect(screenshot.id).toBeDefined();
    expect(screenshot.id).toMatch(/^screenshot-\d+-[a-z0-9]+$/);
    expect(screenshot.domSnapshotId).toBe("dom-snapshot-1");
    expect(screenshot.timestamp).toBeGreaterThan(0);
    expect(screenshot.path).toContain(testOutputDir);
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);

    screenshotCapture.stop();
  }, 30000);

  it("creates valid PNG file on disk", async () => {
    const screenshotCapture = new ScreenshotCapture({
      outputDir: testOutputDir,
    });

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    screenshotCapture.attach(wrappedSession);

    const screenshot = await screenshotCapture.capture("dom-snapshot-2");

    expect(fs.existsSync(screenshot.path)).toBe(true);

    const fileBuffer = fs.readFileSync(screenshot.path);
    expect(isValidPNG(fileBuffer)).toBe(true);
    expect(fileBuffer.length).toBeGreaterThan(100);

    screenshotCapture.stop();
  }, 30000);

  it("captures viewport dimensions correctly", async () => {
    const screenshotCapture = new ScreenshotCapture({
      outputDir: testOutputDir,
    });

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    screenshotCapture.attach(wrappedSession);

    const screenshot = await screenshotCapture.capture("dom-snapshot-3");

    expect(screenshot.width).toBeGreaterThanOrEqual(800);
    expect(screenshot.height).toBeGreaterThanOrEqual(600);

    expect(Number.isInteger(screenshot.width)).toBe(true);
    expect(Number.isInteger(screenshot.height)).toBe(true);

    screenshotCapture.stop();
  }, 30000);

  it("captures 3 DOM snapshots = 3 screenshots", async () => {
    const screenshotCapture = new ScreenshotCapture({
      outputDir: testOutputDir,
    });

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    screenshotCapture.attach(wrappedSession);

    const screenshot1 = await screenshotCapture.capture("dom-snapshot-a");
    await new Promise((resolve) => setTimeout(resolve, 200));

    await page.goto("https://httpbin.org/html", {
      waitUntil: "domcontentloaded",
    });
    const screenshot2 = await screenshotCapture.capture("dom-snapshot-b");
    await new Promise((resolve) => setTimeout(resolve, 200));

    await page.goto("https://httpbin.org/get", {
      waitUntil: "domcontentloaded",
    });
    const screenshot3 = await screenshotCapture.capture("dom-snapshot-c");

    const screenshots = screenshotCapture.getScreenshots();
    expect(screenshots).toHaveLength(3);

    expect(screenshot1.domSnapshotId).toBe("dom-snapshot-a");
    expect(screenshot2.domSnapshotId).toBe("dom-snapshot-b");
    expect(screenshot3.domSnapshotId).toBe("dom-snapshot-c");

    expect(fs.existsSync(screenshot1.path)).toBe(true);
    expect(fs.existsSync(screenshot2.path)).toBe(true);
    expect(fs.existsSync(screenshot3.path)).toBe(true);

    expect(isValidPNG(fs.readFileSync(screenshot1.path))).toBe(true);
    expect(isValidPNG(fs.readFileSync(screenshot2.path))).toBe(true);
    expect(isValidPNG(fs.readFileSync(screenshot3.path))).toBe(true);

    screenshotCapture.stop();
  }, 60000);

  it("screenshot IDs are unique across captures", async () => {
    const screenshotCapture = new ScreenshotCapture({
      outputDir: testOutputDir,
    });

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    screenshotCapture.attach(wrappedSession);

    const screenshot1 = await screenshotCapture.capture("dom-1");
    const screenshot2 = await screenshotCapture.capture("dom-2");
    const screenshot3 = await screenshotCapture.capture("dom-3");

    const ids = [screenshot1.id, screenshot2.id, screenshot3.id];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);

    screenshotCapture.stop();
  }, 30000);

  it("links each screenshot to its DOM snapshot ID correctly", async () => {
    const screenshotCapture = new ScreenshotCapture({
      outputDir: testOutputDir,
    });

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    screenshotCapture.attach(wrappedSession);

    const domIds = [
      "dom-full-1234",
      "dom-diff-5678",
      "dom-full-9abc",
    ];

    for (const domId of domIds) {
      const screenshot = await screenshotCapture.capture(domId);
      expect(screenshot.domSnapshotId).toBe(domId);
    }

    const screenshots = screenshotCapture.getScreenshots();
    expect(screenshots.map((s) => s.domSnapshotId)).toEqual(domIds);

    screenshotCapture.stop();
  }, 30000);
});
