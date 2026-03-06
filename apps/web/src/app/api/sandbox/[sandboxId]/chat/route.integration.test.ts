/**
 * Integration tests for Chat API
 *
 * These tests require:
 * - Running Next.js server
 * - Docker daemon running
 * - Valid API key configured
 * - Test sandbox created
 *
 * To run: SKIP_INTEGRATION_TESTS=false pnpm test route.integration.test.ts
 */

import { describe, test, expect, beforeAll } from "vitest";

const SKIP_TESTS = process.env.SKIP_INTEGRATION_TESTS !== "false";
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_SANDBOX_ID = process.env.TEST_SANDBOX_ID || "test-sandbox";

describe.skipIf(SKIP_TESTS)("Chat API Integration", () => {
  beforeAll(() => {
    if (!SKIP_TESTS) {
      console.log("Running integration tests against:", BASE_URL);
      console.log("Using test sandbox:", TEST_SANDBOX_ID);
    }
  });

  test("returns 404 for non-existent sandbox", async () => {
    const response = await fetch(
      `${BASE_URL}/api/sandbox/nonexistent-sandbox-id/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello", history: [] }),
      }
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Sandbox not found");
  });

  test("returns 400 for invalid request body", async () => {
    const response = await fetch(
      `${BASE_URL}/api/sandbox/${TEST_SANDBOX_ID}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalidField: "test" }),
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Validation failed");
  });

  test("returns 400 for empty message", async () => {
    const response = await fetch(
      `${BASE_URL}/api/sandbox/${TEST_SANDBOX_ID}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "", history: [] }),
      }
    );

    expect(response.status).toBe(400);
  });

  test("returns 400 for invalid JSON", async () => {
    const response = await fetch(
      `${BASE_URL}/api/sandbox/${TEST_SANDBOX_ID}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON");
  });

  test("streams SSE events correctly", async () => {
    const response = await fetch(
      `${BASE_URL}/api/sandbox/${TEST_SANDBOX_ID}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "List the files in the src directory",
          history: [],
        }),
      }
    );

    expect(response.ok).toBe(true);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const events: Array<{ event: string; data: unknown }> = [];
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (!reader) {
      throw new Error("No response body");
    }

    // Read events for up to 30 seconds
    const timeout = setTimeout(() => reader.cancel(), 30000);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const eventStr of lines) {
          if (!eventStr.trim()) continue;

          const eventMatch = eventStr.match(/event: (\w+)\ndata: (.+)/s);
          if (eventMatch) {
            const [, event, dataStr] = eventMatch;
            const data = JSON.parse(dataStr);
            events.push({ event, data });
          }
        }

        // Stop after we get a done or error event
        if (
          events.some((e) => e.event === "done" || e.event === "error")
        ) {
          break;
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    // Verify we got expected events
    expect(events.length).toBeGreaterThan(0);

    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain("thinking");
    expect(eventTypes).toContain("tool_call");
    expect(eventTypes).toContain("done");

    // Check for done event structure
    const doneEvent = events.find((e) => e.event === "done");
    expect(doneEvent).toBeDefined();
    if (doneEvent) {
      const data = doneEvent.data as {
        filesModified?: string[];
        tokensUsed?: { input: number; output: number };
        toolCallsCount?: number;
      };
      expect(data).toHaveProperty("filesModified");
      expect(data).toHaveProperty("tokensUsed");
      expect(data).toHaveProperty("toolCallsCount");
    }
  }, 60000); // 60 second timeout

  test("enforces rate limiting", async () => {
    const sessionId = `test-rate-limit-${Date.now()}`;

    // Make requests up to the limit (10 per minute)
    const requests = [];
    for (let i = 0; i < 11; i++) {
      requests.push(
        fetch(`${BASE_URL}/api/sandbox/${TEST_SANDBOX_ID}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Id": sessionId,
          },
          body: JSON.stringify({ message: `Test ${i}`, history: [] }),
        })
      );
    }

    const responses = await Promise.all(requests);

    // Last request should be rate limited
    const lastResponse = responses[responses.length - 1];
    const statusCodes = responses.map((r) => r.status);

    // At least one should be 429
    expect(statusCodes).toContain(429);

    if (lastResponse.status === 429) {
      const data = await lastResponse.json();
      expect(data.error).toContain("Rate limit");
      expect(data).toHaveProperty("retryAfter");
    }
  }, 30000);

  test("handles request cancellation", async () => {
    const controller = new AbortController();

    const requestPromise = fetch(
      `${BASE_URL}/api/sandbox/${TEST_SANDBOX_ID}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Write a very long essay about TypeScript",
          history: [],
        }),
        signal: controller.signal,
      }
    );

    // Cancel after 500ms
    setTimeout(() => controller.abort(), 500);

    await expect(requestPromise).rejects.toThrow();
  });
});
