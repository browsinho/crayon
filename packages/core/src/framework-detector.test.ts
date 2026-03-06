import { describe, expect, it } from "vitest";
import { detect } from "./framework-detector.js";
import type { DOMSnapshot } from "@crayon/types";

function createSnapshot(html: string): DOMSnapshot {
  return {
    id: "test-snapshot",
    timestamp: Date.now(),
    url: "https://example.com",
    type: "full",
    html,
    viewport: { width: 1920, height: 1080 },
  };
}

describe("detect", () => {
  describe("React detection", () => {
    it("detects React via data-reactroot", () => {
      const snapshot = createSnapshot('<div data-reactroot="">Hello</div>');
      const result = detect([snapshot]);

      expect(result.framework).toBe("react");
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.signals).toContain("data-reactroot");
    });

    it("detects React via data-reactid", () => {
      const snapshot = createSnapshot('<div data-reactid=".0">Hello</div>');
      const result = detect([snapshot]);

      expect(result.framework).toBe("react");
      expect(result.signals).toContain("data-reactid");
    });

    it("detects React via _reactRootContainer", () => {
      const snapshot = createSnapshot(
        '<div id="root"><script>window._reactRootContainer = {};</script></div>'
      );
      const result = detect([snapshot]);

      expect(result.framework).toBe("react");
      expect(result.signals).toContain("_reactRootContainer");
    });

    it("returns high confidence with multiple React signals", () => {
      const snapshot = createSnapshot(`
        <div data-reactroot="" data-reactid=".0">
          <script>window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {};</script>
        </div>
      `);
      const result = detect([snapshot]);

      expect(result.framework).toBe("react");
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.signals.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Vue detection", () => {
    it("detects Vue via data-v-* attributes", () => {
      const snapshot = createSnapshot('<div data-v-abc123="">Hello</div>');
      const result = detect([snapshot]);

      expect(result.framework).toBe("vue");
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.signals).toContain("data-v-");
    });

    it("detects Vue via __vue__ property", () => {
      const snapshot = createSnapshot('<script>element.__vue__ = {};</script>');
      const result = detect([snapshot]);

      expect(result.framework).toBe("vue");
      expect(result.signals).toContain("__vue__");
    });

    it("detects Vue via Vue.config", () => {
      const snapshot = createSnapshot("<script>Vue.config.productionTip = false;</script>");
      const result = detect([snapshot]);

      expect(result.framework).toBe("vue");
      expect(result.signals).toContain("Vue.config");
    });

    it("returns high confidence with multiple Vue signals", () => {
      const snapshot = createSnapshot(`
        <div data-v-abc123="" data-v-app>
          <script>element.__vue__ = {};</script>
        </div>
      `);
      const result = detect([snapshot]);

      expect(result.framework).toBe("vue");
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("Angular detection", () => {
    it("detects Angular via ng-version", () => {
      const snapshot = createSnapshot('<app-root ng-version="16.0.0"></app-root>');
      const result = detect([snapshot]);

      expect(result.framework).toBe("angular");
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.signals).toContain("ng-version");
    });

    it("detects Angular via _nghost- attribute", () => {
      const snapshot = createSnapshot('<app-component _nghost-abc-123="">Hello</app-component>');
      const result = detect([snapshot]);

      expect(result.framework).toBe("angular");
      expect(result.signals).toContain("_nghost-");
    });

    it("detects Angular via _ngcontent- attribute", () => {
      const snapshot = createSnapshot('<div _ngcontent-abc-123="">Hello</div>');
      const result = detect([snapshot]);

      expect(result.framework).toBe("angular");
      expect(result.signals).toContain("_ngcontent-");
    });

    it("returns high confidence with multiple Angular signals", () => {
      const snapshot = createSnapshot(`
        <app-root ng-version="16.0.0" _nghost-abc-123="">
          <div _ngcontent-abc-123="" ng-reflect-model="test">Hello</div>
        </app-root>
      `);
      const result = detect([snapshot]);

      expect(result.framework).toBe("angular");
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("vanilla detection", () => {
    it("returns vanilla for plain HTML", () => {
      const snapshot = createSnapshot("<div><p>Hello World</p></div>");
      const result = detect([snapshot]);

      expect(result.framework).toBe("vanilla");
      expect(result.confidence).toBe(1.0);
      expect(result.signals).toHaveLength(0);
    });

    it("returns vanilla for empty snapshots", () => {
      const result = detect([]);

      expect(result.framework).toBe("vanilla");
      expect(result.confidence).toBe(1.0);
      expect(result.signals).toHaveLength(0);
    });

    it("returns vanilla for snapshot without html", () => {
      const snapshot: DOMSnapshot = {
        id: "test",
        timestamp: Date.now(),
        url: "https://example.com",
        type: "diff",
        viewport: { width: 1920, height: 1080 },
      };
      const result = detect([snapshot]);

      expect(result.framework).toBe("vanilla");
      expect(result.confidence).toBe(1.0);
    });
  });

  describe("multiple snapshots", () => {
    it("aggregates signals across multiple snapshots", () => {
      const snapshot1 = createSnapshot('<div data-reactroot="">Page 1</div>');
      const snapshot2 = createSnapshot('<div data-reactid=".0">Page 2</div>');
      const result = detect([snapshot1, snapshot2]);

      expect(result.framework).toBe("react");
      expect(result.signals).toContain("data-reactroot");
      expect(result.signals).toContain("data-reactid");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("handles mixed framework signals by choosing the one with most signals", () => {
      const reactSnapshot = createSnapshot(`
        <div data-reactroot="" data-reactid=".0">
          <script>window._reactRootContainer = {};</script>
        </div>
      `);
      const vueSnapshot = createSnapshot('<div data-v-abc123="">Vue bit</div>');
      const result = detect([reactSnapshot, vueSnapshot]);

      // React has more signals (3) than Vue (1)
      expect(result.framework).toBe("react");
    });
  });

  describe("confidence scoring", () => {
    it("returns confidence > 0.8 for React page with multiple signals", () => {
      const snapshot = createSnapshot(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="root" data-reactroot="">
              <div data-reactid=".0.0">
                <h1>React App</h1>
              </div>
            </div>
            <script>
              window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {};
              document.getElementById('root')._reactRootContainer = {};
            </script>
          </body>
        </html>
      `);
      const result = detect([snapshot]);

      expect(result.framework).toBe("react");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("returns lower confidence with single signal", () => {
      const snapshot = createSnapshot('<div data-reactroot="">Hello</div>');
      const result = detect([snapshot]);

      expect(result.framework).toBe("react");
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe("edge cases", () => {
    it("is case-insensitive for signal detection", () => {
      const snapshot = createSnapshot('<div DATA-REACTROOT="">Hello</div>');
      const result = detect([snapshot]);

      expect(result.framework).toBe("react");
    });

    it("handles complex real-world React HTML", () => {
      const snapshot = createSnapshot(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>React App</title>
          </head>
          <body>
            <noscript>You need JavaScript</noscript>
            <div id="root" data-reactroot="">
              <div class="App">
                <header class="App-header">
                  <img src="logo.svg" class="App-logo" alt="logo" />
                </header>
              </div>
            </div>
          </body>
        </html>
      `);
      const result = detect([snapshot]);

      expect(result.framework).toBe("react");
      expect(result.signals).toContain("data-reactroot");
    });

    it("handles complex real-world Vue HTML", () => {
      const snapshot = createSnapshot(`
        <!DOCTYPE html>
        <html lang="en">
          <body>
            <div id="app" data-v-app="">
              <div data-v-7ba5bd90="" class="container">
                <h1 data-v-7ba5bd90="">Welcome to Vue</h1>
              </div>
            </div>
          </body>
        </html>
      `);
      const result = detect([snapshot]);

      expect(result.framework).toBe("vue");
    });

    it("handles complex real-world Angular HTML", () => {
      const snapshot = createSnapshot(`
        <!DOCTYPE html>
        <html lang="en">
          <body>
            <app-root ng-version="16.2.0" _nghost-ng-c123="">
              <router-outlet _ngcontent-ng-c123=""></router-outlet>
              <app-home _ngcontent-ng-c123="" _nghost-ng-c456="">
                <div _ngcontent-ng-c456="">Angular App</div>
              </app-home>
            </app-root>
          </body>
        </html>
      `);
      const result = detect([snapshot]);

      expect(result.framework).toBe("angular");
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });
});
