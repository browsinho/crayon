import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page, CDPSession } from "playwright";
import { DOMCapture } from "./dom-capture.js";
import type { CDPSession as DOMCaptureCDPSession } from "./dom-capture.js";

const ANCHOR_API_KEY = process.env.ANCHOR_BROWSER_API_KEY;

function wrapPlaywrightCDPSession(session: CDPSession): DOMCaptureCDPSession {
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

describe.skipIf(!ANCHOR_API_KEY)("DOMCapture Integration", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let cdpSession: CDPSession;
  let wrappedSession: DOMCaptureCDPSession;

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
  });

  it("attaches to real CDP session and captures initial snapshot", async () => {
    const domCapture = new DOMCapture();

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    await domCapture.attach(wrappedSession);

    const snapshots = domCapture.getSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(1);

    const initialSnapshot = snapshots[0];
    expect(initialSnapshot.type).toBe("full");
    expect(initialSnapshot.html).toBeDefined();
    expect(initialSnapshot.html).toContain("<html");
    expect(initialSnapshot.viewport.width).toBeGreaterThan(0);
    expect(initialSnapshot.viewport.height).toBeGreaterThan(0);

    domCapture.stop();
  }, 30000);

  it("captures snapshot on navigation", async () => {
    const domCapture = new DOMCapture();

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    await domCapture.attach(wrappedSession);

    const initialCount = domCapture.getSnapshots().length;

    await page.goto("https://httpbin.org/html", { waitUntil: "domcontentloaded" });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const snapshots = domCapture.getSnapshots();
    expect(snapshots.length).toBeGreaterThan(initialCount);

    const lastFullSnapshot = [...snapshots].reverse().find((s) => s.type === "full");
    expect(lastFullSnapshot).toBeDefined();

    domCapture.stop();
  }, 30000);

  it("navigates to 3 pages and captures 3 full snapshots", async () => {
    const domCapture = new DOMCapture();

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    await domCapture.attach(wrappedSession);
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.goto("https://httpbin.org/html", { waitUntil: "domcontentloaded" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.goto("https://httpbin.org/get", { waitUntil: "domcontentloaded" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const snapshots = domCapture.getSnapshots();
    const fullSnapshots = snapshots.filter((s) => s.type === "full");

    expect(fullSnapshots.length).toBeGreaterThanOrEqual(3);

    const urls = fullSnapshots.map((s) => s.url);
    expect(urls.some((u) => u.includes("example.com"))).toBe(true);
    expect(urls.some((u) => u.includes("httpbin.org/html"))).toBe(true);
    expect(urls.some((u) => u.includes("httpbin.org/get"))).toBe(true);

    domCapture.stop();
  }, 60000);

  it("captures DOM mutations when threshold is met", async () => {
    const domCapture = new DOMCapture({
      mutationThreshold: 5,
      mutationBatchInterval: 100,
    });

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    await domCapture.attach(wrappedSession);

    await page.evaluate(() => {
      const container = document.body;
      for (let i = 0; i < 10; i++) {
        const div = document.createElement("div");
        div.id = `test-element-${i}`;
        div.textContent = `Content ${i}`;
        container.appendChild(div);
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const snapshots = domCapture.getSnapshots();
    const diffSnapshots = snapshots.filter((s) => s.type === "diff");

    expect(diffSnapshots.length).toBeGreaterThanOrEqual(1);
    expect(diffSnapshots[0].mutations).toBeDefined();
    expect(diffSnapshots[0].mutations!.length).toBeGreaterThan(0);

    domCapture.stop();
  }, 30000);

  it("snapshot has all required fields", async () => {
    const domCapture = new DOMCapture();

    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    await domCapture.attach(wrappedSession);

    const snapshots = domCapture.getSnapshots();
    const snapshot = snapshots[0];

    expect(snapshot.id).toBeDefined();
    expect(typeof snapshot.id).toBe("string");
    expect(snapshot.id.startsWith("dom-")).toBe(true);

    expect(snapshot.timestamp).toBeDefined();
    expect(typeof snapshot.timestamp).toBe("number");
    expect(snapshot.timestamp).toBeGreaterThan(0);

    expect(snapshot.url).toBeDefined();
    expect(typeof snapshot.url).toBe("string");

    expect(snapshot.type).toBe("full");

    expect(snapshot.html).toBeDefined();
    expect(typeof snapshot.html).toBe("string");

    expect(snapshot.viewport).toBeDefined();
    expect(typeof snapshot.viewport.width).toBe("number");
    expect(typeof snapshot.viewport.height).toBe("number");
    expect(snapshot.viewport.width).toBeGreaterThan(0);
    expect(snapshot.viewport.height).toBeGreaterThan(0);

    domCapture.stop();
  }, 30000);
});
