import { describe, expect, it } from "vitest";
import type { DOMSnapshot, Recording } from "@crayon/types";
import { summarize } from "./recording-summarizer.js";

// Helper to create a mock DOM snapshot
function createMockSnapshot(
  url: string,
  html: string,
  timestamp: number = Date.now()
): DOMSnapshot {
  return {
    id: `snapshot-${timestamp}`,
    timestamp,
    url,
    type: "full",
    html,
    viewport: { width: 1920, height: 1080 },
  };
}

// Helper to create a mock recording
function createMockRecording(snapshots: DOMSnapshot[]): Recording {
  return {
    metadata: {
      id: "test-recording",
      createdAt: new Date().toISOString(),
      startUrl: snapshots[0]?.url ?? "https://example.com",
      status: "completed",
      stats: {
        domSnapshots: snapshots.length,
        networkCalls: 0,
        screenshots: 0,
      },
    },
    domSnapshots: snapshots,
    networkCalls: [],
    screenshots: [],
  };
}

describe("recording-summarizer", () => {
  describe("summarize", () => {
    it("should generate summary with basic page information", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <header>Header</header>
            <nav>Navigation</nav>
            <button>Click me</button>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.pages).toHaveLength(1);
      expect(summary.pages[0]?.url).toBe("https://example.com");
      expect(summary.pages[0]?.title).toBe("Test Page");
      expect(summary.pages[0]?.keyElements).toContain("button");
      expect(summary.pages[0]?.keyElements).toContain("header");
      expect(summary.pages[0]?.keyElements).toContain("navigation");
    });

    it("should identify multiple pages from different URLs", async () => {
      const html1 = '<html><head><title>Home</title></head><body><h1>Home</h1></body></html>';
      const html2 = '<html><head><title>About</title></head><body><h1>About</h1></body></html>';
      const html3 = '<html><head><title>Contact</title></head><body><h1>Contact</h1></body></html>';

      const snapshots = [
        createMockSnapshot("https://example.com/", html1, 1000),
        createMockSnapshot("https://example.com/about", html2, 2000),
        createMockSnapshot("https://example.com/contact", html3, 3000),
      ];

      const recording = createMockRecording(snapshots);
      const summary = await summarize(recording);

      expect(summary.pages).toHaveLength(3);
      expect(summary.pages.map((p) => p.title)).toEqual(["Home", "About", "Contact"]);
    });

    it("should not duplicate pages with same URL", async () => {
      const html = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';

      const snapshots = [
        createMockSnapshot("https://example.com/", html, 1000),
        createMockSnapshot("https://example.com/", html, 2000),
        createMockSnapshot("https://example.com/", html, 3000),
      ];

      const recording = createMockRecording(snapshots);
      const summary = await summarize(recording);

      expect(summary.pages).toHaveLength(1);
    });

    it("should extract colors from HTML", async () => {
      const html = `
        <html>
          <head><title>Colorful</title></head>
          <body>
            <div style="background-color: #ff5733;">Red</div>
            <div style="color: #3498db;">Blue</div>
            <div style="border-color: rgb(46, 204, 113);">Green</div>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.brandStyle.colors).toContain("#ff5733");
      expect(summary.brandStyle.colors).toContain("#3498db");
      expect(summary.brandStyle.colors.some((c) => c.includes("rgb(46, 204, 113)"))).toBe(true);
    });

    it("should extract fonts from HTML", async () => {
      const html = `
        <html>
          <head>
            <title>Fonts</title>
            <style>
              body { font-family: 'Arial', sans-serif; }
              h1 { font-family: "Helvetica Neue", Helvetica; }
            </style>
          </head>
          <body>
            <h1 style="font-family: 'Roboto', monospace;">Title</h1>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.brandStyle.fonts).toContain("Arial");
      expect(summary.brandStyle.fonts).toContain("Roboto");
    });

    it("should detect component patterns", async () => {
      const html = `
        <html>
          <head><title>Components</title></head>
          <body>
            <button class="btn">Button 1</button>
            <button class="btn-primary">Button 2</button>
            <button class="btn-secondary">Button 3</button>
            <div class="card">Card 1</div>
            <div class="card">Card 2</div>
            <form>
              <input type="text" />
              <input type="email" />
            </form>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      const buttonComponent = summary.components.find((c) => c.type === "button");
      const cardComponent = summary.components.find((c) => c.type === "card");
      const formComponent = summary.components.find((c) => c.type === "form");
      const inputComponent = summary.components.find((c) => c.type === "input");

      expect(buttonComponent).toBeDefined();
      expect(cardComponent).toBeDefined();
      expect(formComponent).toBeDefined();
      expect(inputComponent).toBeDefined();
    });

    it("should classify business domain - ecommerce", async () => {
      const html = `
        <html>
          <head><title>Shop</title></head>
          <body>
            <div class="product-card">
              <h2>Product Name</h2>
              <p class="price">$99.99</p>
              <button class="add-to-cart">Add to Cart</button>
            </div>
            <div class="checkout-button">Checkout</div>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://shop.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.domain).toBe("ecommerce");
    });

    it("should classify business domain - productivity", async () => {
      const html = `
        <html>
          <head><title>Task Manager</title></head>
          <body>
            <div class="kanban-board">
              <div class="task-card">Task 1</div>
              <div class="task-card">Task 2</div>
            </div>
            <div class="todo-list">
              <div class="todo-item">Todo 1</div>
            </div>
            <div class="project-deadline">Due: 2024-12-31</div>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://tasks.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.domain).toBe("productivity");
    });

    it("should classify business domain - social", async () => {
      const html = `
        <html>
          <head><title>Social Network</title></head>
          <body>
            <div class="post">
              <div class="author-profile">John Doe</div>
              <p class="post-content">Hello world!</p>
              <button class="like-button">Like</button>
              <button class="share-button">Share</button>
              <button class="comment-button">Comment</button>
            </div>
            <button class="follow-button">Follow</button>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://social.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.domain).toBe("social");
    });

    it("should detect page types - landing", async () => {
      const html = `
        <html>
          <head><title>Welcome</title></head>
          <body>
            <div class="hero-section">
              <h1>Welcome to our site</h1>
            </div>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.pages[0]?.pageType).toBe("landing");
    });

    it("should detect page types - dashboard", async () => {
      const html = `
        <html>
          <head><title>Dashboard</title></head>
          <body>
            <div class="dashboard-container">
              <div class="stats-widget">Stats</div>
              <div class="metrics-chart">Chart</div>
            </div>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com/dashboard", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.pages[0]?.pageType).toBe("dashboard");
    });

    it("should detect page types - form", async () => {
      const html = `
        <html>
          <head><title>Contact Us</title></head>
          <body>
            <form>
              <input type="text" placeholder="Name" />
              <input type="email" placeholder="Email" />
              <button type="submit">Submit</button>
            </form>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com/contact", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.pages[0]?.pageType).toBe("form");
    });

    it("should detect React framework", async () => {
      const html = `
        <html>
          <head><title>React App</title></head>
          <body>
            <div id="root" data-reactroot="">
              <div>React content</div>
            </div>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.framework.framework).toBe("react");
      expect(summary.framework.confidence).toBeGreaterThan(0);
    });

    it("should track navigation interactions", async () => {
      const snapshots = [
        createMockSnapshot("https://example.com/", "<html><body>Home</body></html>", 1000),
        createMockSnapshot("https://example.com/about", "<html><body>About</body></html>", 2000),
        createMockSnapshot(
          "https://example.com/contact",
          "<html><body>Contact</body></html>",
          3000
        ),
      ];

      const recording = createMockRecording(snapshots);
      const summary = await summarize(recording);

      const navInteraction = summary.interactions.find((i) => i.type === "navigation");
      expect(navInteraction).toBeDefined();
      expect(navInteraction?.frequency).toBe(3);
    });

    it("should track scroll interactions", async () => {
      const snapshots = [
        createMockSnapshot("https://example.com/", "<html><body>Content 1</body></html>", 1000),
        createMockSnapshot("https://example.com/", "<html><body>Content 2</body></html>", 2000),
        createMockSnapshot("https://example.com/", "<html><body>Content 3</body></html>", 3000),
      ];

      const recording = createMockRecording(snapshots);
      const summary = await summarize(recording);

      const scrollInteraction = summary.interactions.find((i) => i.type === "scroll");
      expect(scrollInteraction).toBeDefined();
      expect(scrollInteraction?.frequency).toBeGreaterThan(0);
    });

    it("should generate meaningful description", async () => {
      const html = `
        <html>
          <head><title>E-Shop</title></head>
          <body>
            <div class="product">Product</div>
            <div class="price">$99</div>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://shop.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.description).toContain("ecommerce");
      expect(summary.description.length).toBeGreaterThan(0);
    });

    it("should handle empty recording gracefully", async () => {
      const recording = createMockRecording([]);

      const summary = await summarize(recording);

      expect(summary.pages).toHaveLength(0);
      expect(summary.components).toHaveLength(0);
      expect(summary.framework.framework).toBe("vanilla");
    });

    it("should handle snapshot without HTML", async () => {
      const snapshot = createMockSnapshot("https://example.com", "");
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.pages).toHaveLength(1);
      expect(summary.pages[0]?.url).toBe("https://example.com");
    });

    it("should detect style keywords - minimal", async () => {
      const html = `
        <html>
          <head><title>Simple</title></head>
          <body>
            <h1>Simple page</h1>
            <p>Content</p>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.brandStyle.styleKeywords).toContain("minimal");
    });

    it("should detect style keywords - modern", async () => {
      const html = `
        <html>
          <head><title>Modern</title></head>
          <body>
            <div style="display: grid; box-shadow: 0 2px 4px;">
              <div style="display: flex;">Content</div>
            </div>
          </body>
        </html>
      `;

      const snapshot = createMockSnapshot("https://example.com", html);
      const recording = createMockRecording([snapshot]);

      const summary = await summarize(recording);

      expect(summary.brandStyle.styleKeywords).toContain("modern");
    });
  });
});
