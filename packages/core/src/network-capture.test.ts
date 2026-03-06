import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NetworkCapture, NetworkCaptureError, createNetworkCapture } from "./network-capture.js";
import type { CDPSession } from "./network-capture.js";

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
    if (method === "Network.enable") {
      return Promise.resolve();
    }
    if (method === "Network.getResponseBody") {
      return Promise.resolve({
        body: JSON.stringify({ data: "test" }),
        base64Encoded: false,
      });
    }
    return Promise.resolve();
  });
}

describe("NetworkCapture", () => {
  let mockSession: ReturnType<typeof createMockCDPSession>;
  let networkCapture: NetworkCapture;

  beforeEach(() => {
    mockSession = createMockCDPSession();
    setupDefaultMocks(mockSession);
    networkCapture = new NetworkCapture();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("attach", () => {
    it("enables Network domain", async () => {
      await networkCapture.attach(mockSession);

      expect(mockSession.mockSend).toHaveBeenCalledWith("Network.enable", {
        maxPostDataSize: 5 * 1024 * 1024,
      });
    });

    it("sets up event listeners", async () => {
      await networkCapture.attach(mockSession);

      expect(mockSession.handlers.get("Network.requestWillBeSent")).toHaveLength(1);
      expect(mockSession.handlers.get("Network.responseReceived")).toHaveLength(1);
      expect(mockSession.handlers.get("Network.loadingFinished")).toHaveLength(1);
      expect(mockSession.handlers.get("Network.loadingFailed")).toHaveLength(1);
    });

    it("throws if already attached", async () => {
      await networkCapture.attach(mockSession);

      await expect(networkCapture.attach(mockSession)).rejects.toThrow(NetworkCaptureError);
      await expect(networkCapture.attach(mockSession)).rejects.toThrow(
        "Already attached to a CDP session"
      );
    });
  });

  describe("stop", () => {
    it("removes event listeners", async () => {
      await networkCapture.attach(mockSession);
      networkCapture.stop();

      expect(mockSession.handlers.get("Network.requestWillBeSent")).toHaveLength(0);
      expect(mockSession.handlers.get("Network.responseReceived")).toHaveLength(0);
      expect(mockSession.handlers.get("Network.loadingFinished")).toHaveLength(0);
      expect(mockSession.handlers.get("Network.loadingFailed")).toHaveLength(0);
    });

    it("is safe to call when not attached", () => {
      expect(() => networkCapture.stop()).not.toThrow();
    });
  });

  describe("getCalls", () => {
    it("returns copy of calls array", async () => {
      await networkCapture.attach(mockSession);

      const calls1 = networkCapture.getCalls();
      const calls2 = networkCapture.getCalls();

      expect(calls1).not.toBe(calls2);
      expect(calls1).toEqual(calls2);
    });
  });

  describe("URL filtering", () => {
    it("captures API calls", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/api/users",
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/api/users",
          status: 200,
          headers: { "Content-Type": "application/json" },
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 100,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].request.url).toBe("https://example.com/api/users");
    });

    it("captures JSON file requests", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/data/config.json",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/data/config.json",
          status: 200,
          headers: {},
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 100,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(1);
    });

    it("captures GraphQL requests", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/graphql",
          method: "POST",
          headers: {},
          postData: '{"query":"{ users { id } }"}',
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/graphql",
          status: 200,
          headers: {},
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 100,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].request.body).toBe('{"query":"{ users { id } }"}');
    });

    it("filters out image requests", async () => {
      await networkCapture.attach(mockSession);

      const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"];

      for (const ext of imageExtensions) {
        mockSession.emit("Network.requestWillBeSent", {
          requestId: ext,
          request: {
            url: `https://example.com/images/logo${ext}`,
            method: "GET",
            headers: {},
          },
          timestamp: Date.now() / 1000,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(0);
    });

    it("filters out font requests", async () => {
      await networkCapture.attach(mockSession);

      const fontExtensions = [".woff", ".woff2", ".ttf", ".eot", ".otf"];

      for (const ext of fontExtensions) {
        mockSession.emit("Network.requestWillBeSent", {
          requestId: ext,
          request: {
            url: `https://example.com/fonts/roboto${ext}`,
            method: "GET",
            headers: {},
          },
          timestamp: Date.now() / 1000,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(0);
    });

    it("filters out analytics requests", async () => {
      await networkCapture.attach(mockSession);

      const analyticsUrls = [
        "https://example.com/analytics/track",
        "https://www.google-analytics.com/collect",
        "https://www.googletagmanager.com/gtag/js",
      ];

      for (let i = 0; i < analyticsUrls.length; i++) {
        mockSession.emit("Network.requestWillBeSent", {
          requestId: String(i),
          request: {
            url: analyticsUrls[i],
            method: "GET",
            headers: {},
          },
          timestamp: Date.now() / 1000,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(0);
    });

    it("filters out CSS requests", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/styles/main.css",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(0);
    });

    it("does not capture non-API URLs", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/about",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(0);
    });
  });

  describe("request/response pairing", () => {
    it("pairs request with response", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/api/data",
          method: "POST",
          headers: { Authorization: "Bearer token" },
          postData: '{"name":"test"}',
        },
        timestamp: 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/api/data",
          status: 201,
          headers: { "X-Request-Id": "abc123" },
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(1);

      const call = calls[0];
      expect(call.request.method).toBe("POST");
      expect(call.request.url).toBe("https://example.com/api/data");
      expect(call.request.headers.Authorization).toBe("Bearer token");
      expect(call.request.body).toBe('{"name":"test"}');
      expect(call.response.status).toBe(201);
      expect(call.response.headers["X-Request-Id"]).toBe("abc123");
      expect(call.response.contentType).toBe("application/json");
    });

    it("handles response without matching request", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.responseReceived", {
        requestId: "unknown",
        response: {
          url: "https://example.com/api/data",
          status: 200,
          headers: {},
          mimeType: "application/json",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(0);
    });

    it("handles loadingFinished without matching request", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.loadingFinished", {
        requestId: "unknown",
        encodedDataLength: 100,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(0);
    });

    it("handles failed requests", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/api/data",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.loadingFailed", {
        requestId: "1",
        errorText: "net::ERR_CONNECTION_REFUSED",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(0);
    });
  });

  describe("large response handling", () => {
    it("skips response body for responses larger than maxBodySize", async () => {
      const capture = new NetworkCapture({ maxBodySize: 1000 });
      await capture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/api/large",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/api/large",
          status: 200,
          headers: {},
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 10000,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = capture.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].response.body).toBeUndefined();

      expect(mockSession.mockSend).not.toHaveBeenCalledWith(
        "Network.getResponseBody",
        expect.anything()
      );

      capture.stop();
    });

    it("includes response body for responses smaller than maxBodySize", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/api/small",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/api/small",
          status: 200,
          headers: {},
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 100,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].response.body).toBeDefined();
      expect(mockSession.mockSend).toHaveBeenCalledWith("Network.getResponseBody", {
        requestId: "1",
      });
    });

    it("handles base64 encoded response bodies", async () => {
      mockSession.mockSend.mockImplementation((method: string) => {
        if (method === "Network.enable") {
          return Promise.resolve();
        }
        if (method === "Network.getResponseBody") {
          return Promise.resolve({
            body: Buffer.from('{"encoded":"data"}').toString("base64"),
            base64Encoded: true,
          });
        }
        return Promise.resolve();
      });

      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/api/encoded",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/api/encoded",
          status: 200,
          headers: {},
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 100,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].response.body).toBe('{"encoded":"data"}');
    });

    it("handles getResponseBody errors gracefully", async () => {
      mockSession.mockSend.mockImplementation((method: string) => {
        if (method === "Network.enable") {
          return Promise.resolve();
        }
        if (method === "Network.getResponseBody") {
          return Promise.reject(new Error("Body not available"));
        }
        return Promise.resolve();
      });

      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/api/data",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/api/data",
          status: 200,
          headers: {},
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 100,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].response.body).toBeUndefined();
    });
  });

  describe("HTTP methods", () => {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

    for (const method of methods) {
      it(`captures ${method} requests`, async () => {
        await networkCapture.attach(mockSession);

        mockSession.emit("Network.requestWillBeSent", {
          requestId: "1",
          request: {
            url: "https://example.com/api/resource",
            method,
            headers: {},
          },
          timestamp: Date.now() / 1000,
        });

        mockSession.emit("Network.responseReceived", {
          requestId: "1",
          response: {
            url: "https://example.com/api/resource",
            status: 200,
            headers: {},
            mimeType: "application/json",
          },
        });

        mockSession.emit("Network.loadingFinished", {
          requestId: "1",
          encodedDataLength: 100,
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        const calls = networkCapture.getCalls();
        expect(calls).toHaveLength(1);
        expect(calls[0].request.method).toBe(method);

        networkCapture.stop();
        networkCapture = new NetworkCapture();
        mockSession = createMockCDPSession();
        setupDefaultMocks(mockSession);
      });
    }
  });

  describe("call structure", () => {
    it("creates call with correct structure", async () => {
      await networkCapture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/api/test",
          method: "GET",
          headers: { Accept: "application/json" },
        },
        timestamp: 1609459200,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/api/test",
          status: 200,
          headers: { "Content-Length": "42" },
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 42,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = networkCapture.getCalls();
      expect(calls).toHaveLength(1);

      const call = calls[0];
      expect(call).toHaveProperty("id");
      expect(typeof call.id).toBe("string");
      expect(call.id.startsWith("net-")).toBe(true);

      expect(call).toHaveProperty("timestamp");
      expect(typeof call.timestamp).toBe("number");
      expect(call.timestamp).toBe(1609459200000);

      expect(call).toHaveProperty("request");
      expect(call.request).toHaveProperty("method");
      expect(call.request).toHaveProperty("url");
      expect(call.request).toHaveProperty("headers");

      expect(call).toHaveProperty("response");
      expect(call.response).toHaveProperty("status");
      expect(call.response).toHaveProperty("headers");
      expect(call.response).toHaveProperty("contentType");
    });
  });

  describe("custom configuration", () => {
    it("respects custom include patterns", async () => {
      const capture = new NetworkCapture({
        includePatterns: [/\/custom-api\//],
        excludePatterns: [],
      });
      await capture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/custom-api/data",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/custom-api/data",
          status: 200,
          headers: {},
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 100,
      });

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "2",
        request: {
          url: "https://example.com/api/data",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = capture.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].request.url).toContain("custom-api");

      capture.stop();
    });

    it("respects custom exclude patterns", async () => {
      const capture = new NetworkCapture({
        includePatterns: [/\/api\//],
        excludePatterns: [/\/api\/internal\//],
      });
      await capture.attach(mockSession);

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "1",
        request: {
          url: "https://example.com/api/public/data",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      mockSession.emit("Network.responseReceived", {
        requestId: "1",
        response: {
          url: "https://example.com/api/public/data",
          status: 200,
          headers: {},
          mimeType: "application/json",
        },
      });

      mockSession.emit("Network.loadingFinished", {
        requestId: "1",
        encodedDataLength: 100,
      });

      mockSession.emit("Network.requestWillBeSent", {
        requestId: "2",
        request: {
          url: "https://example.com/api/internal/secrets",
          method: "GET",
          headers: {},
        },
        timestamp: Date.now() / 1000,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = capture.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].request.url).toContain("public");

      capture.stop();
    });
  });
});

describe("NetworkCaptureError", () => {
  it("creates error with message", () => {
    const error = new NetworkCaptureError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("NetworkCaptureError");
  });

  it("creates error with cause", () => {
    const cause = new Error("Original error");
    const error = new NetworkCaptureError("Test error", cause);
    expect(error.cause).toBe(cause);
  });
});

describe("createNetworkCapture helper", () => {
  it("creates NetworkCapture instance", () => {
    const capture = createNetworkCapture();
    expect(capture).toBeInstanceOf(NetworkCapture);
  });

  it("passes config to NetworkCapture", async () => {
    const mockSession = createMockCDPSession();
    setupDefaultMocks(mockSession);

    const capture = createNetworkCapture({ maxBodySize: 1000 });
    await capture.attach(mockSession);

    expect(mockSession.mockSend).toHaveBeenCalledWith("Network.enable", {
      maxPostDataSize: 1000,
    });

    capture.stop();
  });
});
