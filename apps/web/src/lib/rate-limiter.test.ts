import { describe, test, expect, beforeEach } from "vitest";
import { getRateLimiter } from "./rate-limiter";

describe("Rate Limiter", () => {
  beforeEach(() => {
    // Clear the rate limiter state between tests
    // Since we're using a module-level Map, we need to create new limiters for isolation
  });

  test("allows requests under limit", async () => {
    const limiter = getRateLimiter({ windowMs: 60000, maxRequests: 10 });
    const result = await limiter.check("user1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.retryAfter).toBe(0);
  });

  test("tracks remaining count correctly", async () => {
    const limiter = getRateLimiter({ windowMs: 60000, maxRequests: 5 });

    const result1 = await limiter.check("user2");
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(4);

    const result2 = await limiter.check("user2");
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(3);

    const result3 = await limiter.check("user2");
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(2);
  });

  test("blocks requests over limit", async () => {
    const limiter = getRateLimiter({ windowMs: 60000, maxRequests: 2 });

    await limiter.check("user3");
    await limiter.check("user3");

    const result = await limiter.check("user3");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test("isolates different users", async () => {
    const limiter = getRateLimiter({ windowMs: 60000, maxRequests: 2 });

    await limiter.check("user4");
    await limiter.check("user4");

    // user4 is at limit
    const result4 = await limiter.check("user4");
    expect(result4.allowed).toBe(false);

    // user5 should still be allowed
    const result5 = await limiter.check("user5");
    expect(result5.allowed).toBe(true);
  });

  test("resets after time window", async () => {
    const limiter = getRateLimiter({ windowMs: 100, maxRequests: 2 });

    await limiter.check("user6");
    await limiter.check("user6");

    // At limit
    const result1 = await limiter.check("user6");
    expect(result1.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should be allowed again
    const result2 = await limiter.check("user6");
    expect(result2.allowed).toBe(true);
  });

  test("returns correct retryAfter time", async () => {
    const windowMs = 60000;
    const limiter = getRateLimiter({ windowMs, maxRequests: 1 });

    await limiter.check("user7");

    const result = await limiter.check("user7");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(Math.ceil(windowMs / 1000));
  });

  test("handles zero max requests", async () => {
    const limiter = getRateLimiter({ windowMs: 60000, maxRequests: 0 });

    const result = await limiter.check("user8");
    expect(result.allowed).toBe(false);
  });

  test("handles high request counts", async () => {
    const limiter = getRateLimiter({ windowMs: 60000, maxRequests: 100 });

    for (let i = 0; i < 99; i++) {
      const result = await limiter.check("user9");
      expect(result.allowed).toBe(true);
    }

    const result = await limiter.check("user9");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);

    const blocked = await limiter.check("user9");
    expect(blocked.allowed).toBe(false);
  });
});
