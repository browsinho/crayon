import { describe, it, expect } from "vitest";
import { clean } from "./recording-cleaner.js";
import type { Recording } from "@crayon/types";

describe("recording-cleaner", () => {
  describe("DOM cleaning", () => {
    it("should remove script tags", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-1",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 1, networkCalls: 0, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: '<html><head><script>console.log("hello")</script></head><body><h1>Test</h1></body></html>',
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.dom[0].html).not.toContain("<script>");
      expect(result.dom[0].html).toContain("<h1>Test</h1>");
    });

    it("should remove inline styles", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-2",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 1, networkCalls: 0, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: '<html><body><div style="color: red; background: blue;" class="container">Content</div></body></html>',
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.dom[0].html).not.toContain('style="');
      expect(result.dom[0].html).toContain('class="container"');
    });

    it("should remove comments", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-3",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 1, networkCalls: 0, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: "<html><body><!-- This is a comment --><div>Content</div></body></html>",
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.dom[0].html).not.toContain("<!--");
      expect(result.dom[0].html).toContain("<div>Content</div>");
    });

    it("should collapse whitespace", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-4",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 1, networkCalls: 0, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: "<html>  \n  <body>  \n    <div>   Content   </div>  \n  </body>  \n</html>",
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.dom[0].html).not.toContain("  ");
      expect(result.dom[0].html).not.toContain("\n");
    });

    it("should remove data attributes except data-testid and data-component", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-5",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 1, networkCalls: 0, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: '<html><body><div data-testid="my-test" data-component="button" data-custom="value" data-other="thing">Content</div></body></html>',
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.dom[0].html).toContain("data-testid");
      expect(result.dom[0].html).toContain("data-component");
      expect(result.dom[0].html).not.toContain("data-custom");
      expect(result.dom[0].html).not.toContain("data-other");
    });

    it("should skip diff snapshots", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-6",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 2, networkCalls: 0, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: "<html><body><div>Full snapshot</div></body></html>",
            viewport: { width: 1920, height: 1080 },
          },
          {
            id: "snap-2",
            timestamp: Date.now() + 1000,
            url: "https://example.com",
            type: "diff",
            mutations: [],
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.dom).toHaveLength(1);
      expect(result.dom[0].html).toContain("Full snapshot");
    });

    it("should generate structure from HTML", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-7",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 1, networkCalls: 0, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: "<html><head><title>Test</title></head><body><div><p>Content</p></div></body></html>",
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.dom[0].structure).toBeTruthy();
      expect(result.dom[0].structure).toContain("html");
      expect(result.dom[0].structure).toContain("body");
    });
  });

  describe("network request filtering", () => {
    it("should filter out analytics requests", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-8",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 0, networkCalls: 3, screenshots: 0 },
        },
        domSnapshots: [],
        networkCalls: [
          {
            id: "call-1",
            timestamp: Date.now(),
            request: {
              method: "GET",
              url: "https://example.com/api/users",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
            },
          },
          {
            id: "call-2",
            timestamp: Date.now(),
            request: {
              method: "POST",
              url: "https://www.google-analytics.com/collect",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
            },
          },
          {
            id: "call-3",
            timestamp: Date.now(),
            request: {
              method: "POST",
              url: "https://api.segment.com/v1/track",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
            },
          },
        ],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.network).toHaveLength(1);
      expect(result.network[0].url).toBe("https://example.com/api/users");
      expect(result.metadata.requestsFiltered).toBe(2);
    });

    it("should filter out ad requests", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-9",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 0, networkCalls: 2, screenshots: 0 },
        },
        domSnapshots: [],
        networkCalls: [
          {
            id: "call-1",
            timestamp: Date.now(),
            request: {
              method: "GET",
              url: "https://example.com/api/products",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
            },
          },
          {
            id: "call-2",
            timestamp: Date.now(),
            request: {
              method: "GET",
              url: "https://doubleclick.net/ad",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
            },
          },
        ],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.network).toHaveLength(1);
      expect(result.network[0].url).toBe("https://example.com/api/products");
      expect(result.metadata.requestsFiltered).toBe(1);
    });

    it("should keep same-domain requests", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-10",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 0, networkCalls: 2, screenshots: 0 },
        },
        domSnapshots: [],
        networkCalls: [
          {
            id: "call-1",
            timestamp: Date.now(),
            request: {
              method: "GET",
              url: "https://example.com/api/users",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
            },
          },
          {
            id: "call-2",
            timestamp: Date.now(),
            request: {
              method: "POST",
              url: "https://example.com/api/login",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
            },
          },
        ],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.network).toHaveLength(2);
    });

    it("should remove authentication headers", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-11",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 0, networkCalls: 1, screenshots: 0 },
        },
        domSnapshots: [],
        networkCalls: [
          {
            id: "call-1",
            timestamp: Date.now(),
            request: {
              method: "GET",
              url: "https://example.com/api/users",
              headers: {
                "authorization": "Bearer token123",
                "content-type": "application/json",
                "x-api-key": "secret-key",
              },
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
            },
          },
        ],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.network[0].headers).not.toHaveProperty("authorization");
      expect(result.network[0].headers).not.toHaveProperty("x-api-key");
      expect(result.network[0].headers).toHaveProperty("content-type");
    });

    it("should anonymize PII in request/response bodies", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-12",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 0, networkCalls: 1, screenshots: 0 },
        },
        domSnapshots: [],
        networkCalls: [
          {
            id: "call-1",
            timestamp: Date.now(),
            request: {
              method: "POST",
              url: "https://example.com/api/users",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                email: "user@example.com",
                phone: "(555) 123-4567",
              }),
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
              body: JSON.stringify({
                id: 1,
                email: "user@example.com",
              }),
            },
          },
        ],
        screenshots: [],
      };

      const result = await clean(recording);

      const requestBody = result.network[0].body as { email: string; phone: string };
      const responseBody = result.network[0].response as { id: number; email: string };

      expect(requestBody.email).not.toBe("user@example.com");
      expect(requestBody.phone).not.toBe("(555) 123-4567");
      expect(responseBody.email).not.toBe("user@example.com");
    });
  });

  describe("token counting", () => {
    it("should calculate token counts and show reduction", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-13",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 1, networkCalls: 1, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: '<html><head><script>console.log("This is a long script that will be removed")</script></head><body><div style="color: red; background: blue; font-size: 16px;">Content</div></body></html>',
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [
          {
            id: "call-1",
            timestamp: Date.now(),
            request: {
              method: "GET",
              url: "https://example.com/api/users",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
              body: JSON.stringify({ users: [{ id: 1, name: "Test User" }] }),
            },
          },
        ],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.metadata.originalTokenCount).toBeGreaterThan(0);
      expect(result.metadata.cleanedTokenCount).toBeGreaterThan(0);
      expect(result.metadata.cleanedTokenCount).toBeLessThan(result.metadata.originalTokenCount);
    });

    it("should track elements removed", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-14",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 1, networkCalls: 0, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: '<html><head><script>console.log("script")</script></head><body><!-- comment --><div style="color: red;">Content</div></body></html>',
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [],
        screenshots: [],
      };

      const result = await clean(recording);

      expect(result.metadata.elementsRemoved).toBeGreaterThan(0);
    });
  });

  describe("integration tests", () => {
    it("should clean a realistic recording and reduce tokens significantly", async () => {
      const recording: Recording = {
        metadata: {
          id: "test-15",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed",
          stats: { domSnapshots: 2, networkCalls: 5, screenshots: 0 },
        },
        domSnapshots: [
          {
            id: "snap-1",
            timestamp: Date.now(),
            url: "https://example.com",
            type: "full",
            html: `
              <html>
                <head>
                  <script src="https://www.googletagmanager.com/gtag.js"></script>
                  <script>
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', 'GA_MEASUREMENT_ID');
                  </script>
                </head>
                <body>
                  <!-- Main navigation -->
                  <nav style="background: #333; color: white; padding: 1rem;">
                    <ul data-nav="main" data-testid="main-nav">
                      <li class="nav-item"><a href="/">Home</a></li>
                      <li class="nav-item"><a href="/about">About</a></li>
                    </ul>
                  </nav>
                  <!-- Main content -->
                  <main>
                    <div class="container" style="max-width: 1200px; margin: 0 auto;">
                      <h1 class="title">Welcome</h1>
                      <p style="color: #666;">This is a test page with lots of noise.</p>
                      <div id="ad-container" class="ad-space">
                        <iframe src="https://doubleclick.net/ad"></iframe>
                      </div>
                    </div>
                  </main>
                </body>
              </html>
            `,
            viewport: { width: 1920, height: 1080 },
          },
          {
            id: "snap-2",
            timestamp: Date.now() + 1000,
            url: "https://example.com/about",
            type: "full",
            html: `
              <html>
                <body>
                  <div class="container">
                    <h1>About Us</h1>
                    <p>Contact: user@example.com or (555) 123-4567</p>
                  </div>
                </body>
              </html>
            `,
            viewport: { width: 1920, height: 1080 },
          },
        ],
        networkCalls: [
          {
            id: "call-1",
            timestamp: Date.now(),
            request: {
              method: "GET",
              url: "https://example.com/api/users",
              headers: { "content-type": "application/json" },
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
              body: JSON.stringify({ users: [{ id: 1, name: "Test User" }] }),
            },
          },
          {
            id: "call-2",
            timestamp: Date.now(),
            request: {
              method: "POST",
              url: "https://www.google-analytics.com/collect",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "text/plain",
            },
          },
          {
            id: "call-3",
            timestamp: Date.now(),
            request: {
              method: "GET",
              url: "https://doubleclick.net/ad",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "text/html",
            },
          },
          {
            id: "call-4",
            timestamp: Date.now(),
            request: {
              method: "POST",
              url: "https://api.segment.com/v1/track",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "application/json",
            },
          },
          {
            id: "call-5",
            timestamp: Date.now(),
            request: {
              method: "GET",
              url: "https://cdn.example.com/style.css",
              headers: {},
            },
            response: {
              status: 200,
              headers: {},
              contentType: "text/css",
              body: "body { margin: 0; }",
            },
          },
        ],
        screenshots: [],
      };

      const result = await clean(recording);

      // Should have cleaned DOM snapshots
      expect(result.dom).toHaveLength(2);
      expect(result.dom[0].html).not.toContain("<script>");
      expect(result.dom[0].html).not.toContain("style=");
      expect(result.dom[0].html).not.toContain("<!--");
      expect(result.dom[0].html).toContain("data-testid");
      expect(result.dom[0].html).not.toContain("data-nav");

      // PII should be anonymized
      expect(result.dom[1].html).not.toContain("user@example.com");
      expect(result.dom[1].html).not.toContain("(555) 123-4567");

      // Should filter network requests (keep only same-domain API and CDN asset)
      expect(result.network.length).toBeLessThan(recording.networkCalls.length);
      expect(result.metadata.requestsFiltered).toBeGreaterThan(0);

      // Should show significant token reduction
      const reductionRatio =
        (result.metadata.originalTokenCount - result.metadata.cleanedTokenCount) /
        result.metadata.originalTokenCount;
      expect(reductionRatio).toBeGreaterThan(0.3); // At least 30% reduction
    });
  });
});
