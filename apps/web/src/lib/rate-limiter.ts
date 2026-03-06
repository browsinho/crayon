interface RateLimiterConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // Seconds until next allowed request
}

// Simple in-memory rate limiter (use Redis for production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function getRateLimiter(config: RateLimiterConfig) {
  return {
    async check(userId: string): Promise<RateLimitResult> {
      const now = Date.now();
      const key = userId;

      let record = requestCounts.get(key);

      // Reset if window expired
      if (!record || record.resetAt < now) {
        record = {
          count: 0,
          resetAt: now + config.windowMs,
        };
      }

      // Check limit
      if (record.count >= config.maxRequests) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          retryAfter,
        };
      }

      // Increment and allow
      record.count++;
      requestCounts.set(key, record);

      return {
        allowed: true,
        remaining: config.maxRequests - record.count,
        retryAfter: 0,
      };
    },
  };
}
