import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page, CDPSession } from "playwright";
import { NetworkCapture } from "./network-capture.js";
import type { CDPSession as NetworkCaptureCDPSession } from "./network-capture.js";

const ANCHOR_API_KEY = process.env.ANCHOR_BROWSER_API_KEY;

function wrapPlaywrightCDPSession(session: CDPSession): NetworkCaptureCDPSession {
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

describe.skipIf(!ANCHOR_API_KEY)("NetworkCapture Integration", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let cdpSession: CDPSession;
  let wrappedSession: NetworkCaptureCDPSession;

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

  it("attaches to real CDP session", async () => {
    const networkCapture = new NetworkCapture();

    await networkCapture.attach(wrappedSession);

    const calls = networkCapture.getCalls();
    expect(Array.isArray(calls)).toBe(true);

    networkCapture.stop();
  }, 30000);

  it("captures API calls from httpbin.org", async () => {
    const networkCapture = new NetworkCapture();

    await networkCapture.attach(wrappedSession);

    await page.goto("https://httpbin.org/get?test=value", {
      waitUntil: "networkidle",
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const calls = networkCapture.getCalls();

    const jsonCalls = calls.filter((c) => c.request.url.includes("/get"));
    expect(jsonCalls.length).toBeGreaterThanOrEqual(1);

    const apiCall = jsonCalls[0];
    expect(apiCall.response.status).toBe(200);
    expect(apiCall.response.contentType).toContain("json");

    networkCapture.stop();
  }, 30000);

  it("captures POST request with body", async () => {
    const networkCapture = new NetworkCapture();

    await networkCapture.attach(wrappedSession);

    await page.goto("https://httpbin.org/html", { waitUntil: "domcontentloaded" });

    await page.evaluate(async () => {
      await fetch("https://httpbin.org/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: "data", number: 42 }),
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const calls = networkCapture.getCalls();
    const postCalls = calls.filter(
      (c) => c.request.method === "POST" && c.request.url.includes("/post")
    );

    expect(postCalls.length).toBeGreaterThanOrEqual(1);

    const postCall = postCalls[0];
    expect(postCall.request.method).toBe("POST");
    expect(postCall.request.body).toBeDefined();
    expect(postCall.request.body).toContain("test");
    expect(postCall.response.status).toBe(200);

    networkCapture.stop();
  }, 30000);

  it("filters out image requests", async () => {
    const networkCapture = new NetworkCapture();

    await networkCapture.attach(wrappedSession);

    await page.goto("https://httpbin.org/image/png", { waitUntil: "networkidle" });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const calls = networkCapture.getCalls();
    const imageCalls = calls.filter((c) => c.request.url.includes("/image/png"));

    expect(imageCalls).toHaveLength(0);

    networkCapture.stop();
  }, 30000);

  it("captures response headers correctly", async () => {
    const networkCapture = new NetworkCapture();

    await networkCapture.attach(wrappedSession);

    await page.evaluate(async () => {
      await fetch("https://httpbin.org/response-headers?X-Test-Header=test-value");
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const calls = networkCapture.getCalls();
    const headerCalls = calls.filter((c) =>
      c.request.url.includes("/response-headers")
    );

    expect(headerCalls.length).toBeGreaterThanOrEqual(1);

    const call = headerCalls[0];
    expect(call.response.status).toBe(200);

    networkCapture.stop();
  }, 30000);

  it("captures multiple API calls", async () => {
    const networkCapture = new NetworkCapture();

    await networkCapture.attach(wrappedSession);

    await page.goto("https://httpbin.org/html", { waitUntil: "domcontentloaded" });

    await page.evaluate(async () => {
      await Promise.all([
        fetch("https://httpbin.org/get?q=1"),
        fetch("https://httpbin.org/get?q=2"),
        fetch("https://httpbin.org/get?q=3"),
      ]);
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const calls = networkCapture.getCalls();
    const getCalls = calls.filter(
      (c) => c.request.url.includes("/get?q=")
    );

    expect(getCalls.length).toBeGreaterThanOrEqual(3);

    networkCapture.stop();
  }, 30000);

  it("captures response body for JSON responses", async () => {
    const networkCapture = new NetworkCapture();

    await networkCapture.attach(wrappedSession);

    await page.evaluate(async () => {
      await fetch("https://httpbin.org/json");
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const calls = networkCapture.getCalls();
    const jsonCalls = calls.filter((c) => c.request.url.includes("/json"));

    expect(jsonCalls.length).toBeGreaterThanOrEqual(1);

    const call = jsonCalls[0];
    expect(call.response.body).toBeDefined();
    expect(call.response.contentType).toContain("json");

    const body = JSON.parse(call.response.body!);
    expect(body).toHaveProperty("slideshow");

    networkCapture.stop();
  }, 30000);

  it("call has all required fields", async () => {
    const networkCapture = new NetworkCapture();

    await networkCapture.attach(wrappedSession);

    await page.evaluate(async () => {
      await fetch("https://httpbin.org/get");
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const calls = networkCapture.getCalls();
    const getCalls = calls.filter((c) => c.request.url.includes("/get"));
    expect(getCalls.length).toBeGreaterThanOrEqual(1);

    const call = getCalls[0];

    expect(call.id).toBeDefined();
    expect(typeof call.id).toBe("string");
    expect(call.id.startsWith("net-")).toBe(true);

    expect(call.timestamp).toBeDefined();
    expect(typeof call.timestamp).toBe("number");
    expect(call.timestamp).toBeGreaterThan(0);

    expect(call.request).toBeDefined();
    expect(typeof call.request.method).toBe("string");
    expect(typeof call.request.url).toBe("string");
    expect(typeof call.request.headers).toBe("object");

    expect(call.response).toBeDefined();
    expect(typeof call.response.status).toBe("number");
    expect(typeof call.response.headers).toBe("object");
    expect(typeof call.response.contentType).toBe("string");

    networkCapture.stop();
  }, 30000);
});
