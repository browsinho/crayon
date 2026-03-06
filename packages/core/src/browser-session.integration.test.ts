import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  BrowserSessionManager,
  BrowserSessionError,
} from "./browser-session.js";

const ANCHOR_API_KEY = process.env.ANCHOR_BROWSER_API_KEY;

describe.skipIf(!ANCHOR_API_KEY)("BrowserSessionManager Integration", () => {
  let manager: BrowserSessionManager;
  const createdSessionIds: string[] = [];

  beforeAll(() => {
    if (!ANCHOR_API_KEY) {
      throw new Error("ANCHOR_BROWSER_API_KEY environment variable is required");
    }
    manager = new BrowserSessionManager({ apiKey: ANCHOR_API_KEY });
  });

  afterAll(async () => {
    for (const sessionId of createdSessionIds) {
      try {
        await manager.closeSession(sessionId);
      } catch {
        // Session may already be closed
      }
    }
  });

  it("creates a session and verifies it exists", async () => {
    const session = await manager.createSession({
      timeout: {
        maxDuration: 2,
        idleTimeout: 1,
      },
    });

    createdSessionIds.push(session.id);

    expect(session.id).toBeDefined();
    expect(session.id).toMatch(/^[a-zA-Z0-9-]+$/);
    expect(session.status).toBe("active");
    expect(session.cdpUrl).toMatch(/^wss?:\/\//);

    const retrieved = manager.getSession(session.id);
    expect(retrieved).toEqual(session);
  });

  it("navigates to example.com and verifies page loads", async () => {
    const session = await manager.createSession({
      timeout: {
        maxDuration: 2,
        idleTimeout: 1,
      },
    });

    createdSessionIds.push(session.id);

    await manager.navigate(session.id, "https://example.com");

    const retrieved = manager.getSession(session.id);
    expect(retrieved?.status).toBe("active");
  });

  it("closes session and verifies cleanup", async () => {
    const session = await manager.createSession({
      timeout: {
        maxDuration: 2,
        idleTimeout: 1,
      },
    });

    await manager.closeSession(session.id);

    const retrieved = manager.getSession(session.id);
    expect(retrieved).toBeUndefined();
  });

  it("handles invalid API key with auth error", async () => {
    const invalidManager = new BrowserSessionManager({
      apiKey: "invalid-api-key-12345",
    });

    await expect(invalidManager.createSession()).rejects.toThrow(
      BrowserSessionError
    );
  });

  it("performs full create -> navigate -> close workflow", async () => {
    const session = await manager.createSession({
      timeout: {
        maxDuration: 3,
        idleTimeout: 2,
      },
    });

    expect(session.status).toBe("active");

    await manager.navigate(session.id, "https://example.com");

    const afterNavigate = manager.getSession(session.id);
    expect(afterNavigate?.status).toBe("active");

    await manager.closeSession(session.id);

    const afterClose = manager.getSession(session.id);
    expect(afterClose).toBeUndefined();
  });
});
