import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  getAssetType,
  extractAssetUrls,
  extractCssAssetUrls,
  resolveUrl,
  generateLocalFilename,
  download,
  rewriteUrls,
} from "./asset-downloader.js";
import type { DOMSnapshot } from "@crayon/types";

function createSnapshot(html: string, url = "https://example.com"): DOMSnapshot {
  return {
    id: "test-snapshot",
    timestamp: Date.now(),
    url,
    type: "full",
    html,
    viewport: { width: 1920, height: 1080 },
  };
}

describe("getAssetType", () => {
  describe("image types", () => {
    it("identifies PNG images", () => {
      expect(getAssetType("https://example.com/logo.png")).toBe("image");
    });

    it("identifies JPEG images", () => {
      expect(getAssetType("https://example.com/photo.jpg")).toBe("image");
      expect(getAssetType("https://example.com/photo.jpeg")).toBe("image");
    });

    it("identifies GIF images", () => {
      expect(getAssetType("https://example.com/animation.gif")).toBe("image");
    });

    it("identifies SVG images", () => {
      expect(getAssetType("https://example.com/icon.svg")).toBe("image");
    });

    it("identifies WebP images", () => {
      expect(getAssetType("https://example.com/image.webp")).toBe("image");
    });

    it("identifies ICO images", () => {
      expect(getAssetType("https://example.com/favicon.ico")).toBe("image");
    });

    it("identifies AVIF images", () => {
      expect(getAssetType("https://example.com/image.avif")).toBe("image");
    });
  });

  describe("font types", () => {
    it("identifies WOFF fonts", () => {
      expect(getAssetType("https://example.com/font.woff")).toBe("font");
    });

    it("identifies WOFF2 fonts", () => {
      expect(getAssetType("https://example.com/font.woff2")).toBe("font");
    });

    it("identifies TTF fonts", () => {
      expect(getAssetType("https://example.com/font.ttf")).toBe("font");
    });

    it("identifies OTF fonts", () => {
      expect(getAssetType("https://example.com/font.otf")).toBe("font");
    });

    it("identifies EOT fonts", () => {
      expect(getAssetType("https://example.com/font.eot")).toBe("font");
    });
  });

  describe("CSS types", () => {
    it("identifies CSS files", () => {
      expect(getAssetType("https://example.com/styles.css")).toBe("css");
    });
  });

  describe("unknown types", () => {
    it("returns null for unknown extensions", () => {
      expect(getAssetType("https://example.com/file.txt")).toBeNull();
      expect(getAssetType("https://example.com/script.js")).toBeNull();
      expect(getAssetType("https://example.com/page.html")).toBeNull();
    });

    it("returns null for URLs without extensions", () => {
      expect(getAssetType("https://example.com/api/resource")).toBeNull();
    });
  });

  describe("URLs with query parameters", () => {
    it("correctly identifies assets with query strings", () => {
      expect(getAssetType("https://example.com/logo.png?v=123")).toBe("image");
      expect(getAssetType("https://example.com/font.woff2?subset=latin")).toBe("font");
    });
  });

  describe("case insensitivity", () => {
    it("handles uppercase extensions", () => {
      expect(getAssetType("https://example.com/logo.PNG")).toBe("image");
      expect(getAssetType("https://example.com/style.CSS")).toBe("css");
    });
  });
});

describe("resolveUrl", () => {
  it("returns absolute URLs unchanged", () => {
    expect(resolveUrl("https://cdn.example.com/image.png", "https://example.com")).toBe(
      "https://cdn.example.com/image.png"
    );
  });

  it("resolves relative URLs", () => {
    expect(resolveUrl("images/logo.png", "https://example.com/page")).toBe(
      "https://example.com/images/logo.png"
    );
  });

  it("resolves root-relative URLs", () => {
    expect(resolveUrl("/assets/logo.png", "https://example.com/deep/path")).toBe(
      "https://example.com/assets/logo.png"
    );
  });

  it("handles protocol-relative URLs", () => {
    expect(resolveUrl("//cdn.example.com/image.png", "https://example.com")).toBe(
      "https://cdn.example.com/image.png"
    );
  });

  it("returns data URLs as-is", () => {
    const dataUrl = "data:image/png;base64,abc123";
    expect(resolveUrl(dataUrl, "https://example.com")).toBe(dataUrl);
  });

  it("returns null for javascript URLs", () => {
    expect(resolveUrl("javascript:void(0)", "https://example.com")).toBeNull();
  });

  it("returns null for empty URLs", () => {
    expect(resolveUrl("", "https://example.com")).toBeNull();
  });

  it("handles URLs with parent directory references", () => {
    expect(resolveUrl("../images/logo.png", "https://example.com/pages/about")).toBe(
      "https://example.com/images/logo.png"
    );
  });
});

describe("generateLocalFilename", () => {
  it("extracts filename from URL", () => {
    expect(generateLocalFilename("https://example.com/images/logo.png")).toBe("logo.png");
  });

  it("removes query parameters", () => {
    expect(generateLocalFilename("https://example.com/logo.png?v=123")).toBe("logo.png");
  });

  it("sanitizes unsafe characters", () => {
    const filename = generateLocalFilename("https://example.com/file<with>special:chars.png");
    expect(filename).not.toContain("<");
    expect(filename).not.toContain(">");
    expect(filename).not.toContain(":");
    expect(filename).toContain(".png");
  });

  it("handles URL-encoded characters", () => {
    expect(generateLocalFilename("https://example.com/my%20image.png")).toBe("my_image.png");
  });

  it("limits filename length", () => {
    const longName = "a".repeat(200) + ".png";
    const filename = generateLocalFilename(`https://example.com/${longName}`);
    expect(filename.length).toBeLessThanOrEqual(104); // 100 + possible extension
  });

  it("generates hash-based name for edge cases", () => {
    const filename = generateLocalFilename("https://example.com/");
    expect(filename).toMatch(/^asset_[a-f0-9]+$/);
  });
});

describe("extractAssetUrls", () => {
  describe("image extraction", () => {
    it("extracts img src attributes", () => {
      const html = '<img src="logo.png" alt="Logo">';
      const assets = extractAssetUrls(html, "https://example.com");
      expect(assets.has("https://example.com/logo.png")).toBe(true);
      expect(assets.get("https://example.com/logo.png")).toBe("image");
    });

    it("extracts multiple images", () => {
      const html = `
        <img src="image1.png">
        <img src="image2.jpg">
        <img src="image3.webp">
      `;
      const assets = extractAssetUrls(html, "https://example.com");
      expect(assets.size).toBe(3);
    });

    it("extracts srcset images", () => {
      const html = '<img srcset="small.png 1x, large.png 2x">';
      const assets = extractAssetUrls(html, "https://example.com");
      expect(assets.has("https://example.com/small.png")).toBe(true);
      expect(assets.has("https://example.com/large.png")).toBe(true);
    });

    it("extracts background images from inline styles", () => {
      const html = '<div style="background-image: url(bg.png)"></div>';
      const assets = extractAssetUrls(html, "https://example.com");
      expect(assets.has("https://example.com/bg.png")).toBe(true);
    });

    it("skips data URLs", () => {
      const html = '<img src="data:image/png;base64,abc123">';
      const assets = extractAssetUrls(html, "https://example.com");
      expect(assets.size).toBe(0);
    });
  });

  describe("CSS extraction", () => {
    it("extracts CSS link tags with rel before href", () => {
      const html = '<link rel="stylesheet" href="styles.css">';
      const assets = extractAssetUrls(html, "https://example.com");
      expect(assets.has("https://example.com/styles.css")).toBe(true);
      expect(assets.get("https://example.com/styles.css")).toBe("css");
    });

    it("extracts CSS link tags with href before rel", () => {
      const html = '<link href="styles.css" rel="stylesheet">';
      const assets = extractAssetUrls(html, "https://example.com");
      expect(assets.has("https://example.com/styles.css")).toBe(true);
    });

    it("handles multiple CSS files", () => {
      const html = `
        <link rel="stylesheet" href="base.css">
        <link rel="stylesheet" href="components.css">
      `;
      const assets = extractAssetUrls(html, "https://example.com");
      expect(assets.has("https://example.com/base.css")).toBe(true);
      expect(assets.has("https://example.com/components.css")).toBe(true);
    });
  });

  describe("absolute URLs", () => {
    it("preserves absolute URLs", () => {
      const html = '<img src="https://cdn.example.com/logo.png">';
      const assets = extractAssetUrls(html, "https://example.com");
      expect(assets.has("https://cdn.example.com/logo.png")).toBe(true);
    });
  });
});

describe("extractCssAssetUrls", () => {
  describe("url() references", () => {
    it("extracts background image URLs", () => {
      const css = '.hero { background: url("hero.png"); }';
      const assets = extractCssAssetUrls(css, "https://example.com/styles/main.css");
      expect(assets.has("https://example.com/styles/hero.png")).toBe(true);
    });

    it("handles unquoted URLs", () => {
      const css = ".hero { background: url(hero.png); }";
      const assets = extractCssAssetUrls(css, "https://example.com/styles/main.css");
      expect(assets.has("https://example.com/styles/hero.png")).toBe(true);
    });

    it("handles single-quoted URLs", () => {
      const css = ".hero { background: url('hero.png'); }";
      const assets = extractCssAssetUrls(css, "https://example.com/styles/main.css");
      expect(assets.has("https://example.com/styles/hero.png")).toBe(true);
    });
  });

  describe("@import rules", () => {
    it("extracts @import URLs", () => {
      const css = '@import "base.css";';
      const assets = extractCssAssetUrls(css, "https://example.com/styles/main.css");
      expect(assets.has("https://example.com/styles/base.css")).toBe(true);
      expect(assets.get("https://example.com/styles/base.css")).toBe("css");
    });

    it("extracts @import url() format", () => {
      const css = '@import url("base.css");';
      const assets = extractCssAssetUrls(css, "https://example.com/styles/main.css");
      expect(assets.has("https://example.com/styles/base.css")).toBe(true);
    });
  });

  describe("@font-face rules", () => {
    it("extracts font URLs from @font-face", () => {
      const css = `
        @font-face {
          font-family: 'Inter';
          src: url('inter.woff2') format('woff2');
        }
      `;
      const assets = extractCssAssetUrls(css, "https://example.com/styles/main.css");
      expect(assets.has("https://example.com/styles/inter.woff2")).toBe(true);
      expect(assets.get("https://example.com/styles/inter.woff2")).toBe("font");
    });

    it("extracts multiple font formats", () => {
      const css = `
        @font-face {
          font-family: 'Inter';
          src: url('inter.woff2') format('woff2'),
               url('inter.woff') format('woff'),
               url('inter.ttf') format('truetype');
        }
      `;
      const assets = extractCssAssetUrls(css, "https://example.com/styles/");
      expect(assets.has("https://example.com/styles/inter.woff2")).toBe(true);
      expect(assets.has("https://example.com/styles/inter.woff")).toBe(true);
      expect(assets.has("https://example.com/styles/inter.ttf")).toBe(true);
    });
  });

  describe("skips data URLs", () => {
    it("does not include data URLs in assets", () => {
      const css =
        '.icon { background: url("data:image/svg+xml;base64,abc123"); }';
      const assets = extractCssAssetUrls(css, "https://example.com/styles/");
      expect(assets.size).toBe(0);
    });
  });
});

describe("rewriteUrls", () => {
  it("rewrites img src attributes", () => {
    const html = '<img src="https://example.com/logo.png">';
    const manifest = {
      assets: [
        { originalUrl: "https://example.com/logo.png", localPath: "images/logo.png", type: "image" as const, size: 1000 },
      ],
      totalSize: 1000,
    };

    const result = rewriteUrls(html, manifest);
    expect(result).toBe('<img src="images/logo.png">');
  });

  it("rewrites href attributes for CSS", () => {
    const html = '<link rel="stylesheet" href="https://example.com/styles.css">';
    const manifest = {
      assets: [
        { originalUrl: "https://example.com/styles.css", localPath: "styles/main.css", type: "css" as const, size: 500 },
      ],
      totalSize: 500,
    };

    const result = rewriteUrls(html, manifest);
    expect(result).toBe('<link rel="stylesheet" href="styles/main.css">');
  });

  it("rewrites url() in inline styles", () => {
    const html = '<div style="background: url(https://example.com/bg.png)"></div>';
    const manifest = {
      assets: [
        { originalUrl: "https://example.com/bg.png", localPath: "images/bg.png", type: "image" as const, size: 2000 },
      ],
      totalSize: 2000,
    };

    const result = rewriteUrls(html, manifest);
    expect(result).toContain('url("images/bg.png")');
  });

  it("rewrites srcset attributes", () => {
    const html = '<img srcset="https://example.com/small.png 1x, https://example.com/large.png 2x">';
    const manifest = {
      assets: [
        { originalUrl: "https://example.com/small.png", localPath: "images/small.png", type: "image" as const, size: 500 },
        { originalUrl: "https://example.com/large.png", localPath: "images/large.png", type: "image" as const, size: 1000 },
      ],
      totalSize: 1500,
    };

    const result = rewriteUrls(html, manifest);
    expect(result).toContain("images/small.png");
    expect(result).toContain("images/large.png");
  });

  it("handles multiple assets", () => {
    const html = `
      <img src="https://example.com/logo.png">
      <link href="https://example.com/styles.css" rel="stylesheet">
    `;
    const manifest = {
      assets: [
        { originalUrl: "https://example.com/logo.png", localPath: "images/logo.png", type: "image" as const, size: 1000 },
        { originalUrl: "https://example.com/styles.css", localPath: "styles/main.css", type: "css" as const, size: 500 },
      ],
      totalSize: 1500,
    };

    const result = rewriteUrls(html, manifest);
    expect(result).toContain('src="images/logo.png"');
    expect(result).toContain('href="styles/main.css"');
  });

  it("handles URLs with special regex characters", () => {
    const html = '<img src="https://example.com/image.png?v=1.0">';
    const manifest = {
      assets: [
        { originalUrl: "https://example.com/image.png?v=1.0", localPath: "images/image.png", type: "image" as const, size: 1000 },
      ],
      totalSize: 1000,
    };

    const result = rewriteUrls(html, manifest);
    expect(result).toBe('<img src="images/image.png">');
  });

  it("preserves URLs not in manifest", () => {
    const html = '<img src="https://other.com/logo.png">';
    const manifest = {
      assets: [],
      totalSize: 0,
    };

    const result = rewriteUrls(html, manifest);
    expect(result).toBe('<img src="https://other.com/logo.png">');
  });
});

describe("download", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "asset-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates output directory structure", async () => {
    const snapshot = createSnapshot("<div>No assets</div>");
    await download([snapshot], tempDir);

    const dirs = await fs.readdir(tempDir);
    expect(dirs).toContain("images");
    expect(dirs).toContain("fonts");
    expect(dirs).toContain("styles");
  });

  it("returns empty manifest for snapshots without assets", async () => {
    const snapshot = createSnapshot("<div>No assets here</div>");
    const manifest = await download([snapshot], tempDir);

    expect(manifest.assets).toHaveLength(0);
    expect(manifest.totalSize).toBe(0);
  });

  it("returns manifest with correct structure", async () => {
    const snapshot = createSnapshot("<div>No assets</div>");
    const manifest = await download([snapshot], tempDir);

    expect(manifest).toHaveProperty("assets");
    expect(manifest).toHaveProperty("totalSize");
    expect(Array.isArray(manifest.assets)).toBe(true);
    expect(typeof manifest.totalSize).toBe("number");
  });

  it("handles multiple snapshots", async () => {
    const snapshots = [
      createSnapshot("<div>Page 1</div>", "https://example.com/page1"),
      createSnapshot("<div>Page 2</div>", "https://example.com/page2"),
    ];
    const manifest = await download(snapshots, tempDir);

    expect(manifest).toBeDefined();
    expect(Array.isArray(manifest.assets)).toBe(true);
  });

  it("handles snapshots without HTML", async () => {
    const snapshot: DOMSnapshot = {
      id: "test",
      timestamp: Date.now(),
      url: "https://example.com",
      type: "diff",
      viewport: { width: 1920, height: 1080 },
    };

    const manifest = await download([snapshot], tempDir);
    expect(manifest.assets).toHaveLength(0);
  });
});
