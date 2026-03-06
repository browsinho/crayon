/**
 * Asset Downloader - Downloads and localizes assets from recorded websites
 *
 * Downloads images, fonts, and CSS files from DOM snapshots and rewrites
 * URLs in HTML/CSS to point to local paths.
 */

import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { DOMSnapshot } from "@crayon/types";

// Size limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total

export const AssetTypeSchema = z.enum(["image", "font", "css"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetEntrySchema = z.object({
  originalUrl: z.string(),
  localPath: z.string(),
  type: AssetTypeSchema,
  size: z.number(),
});
export type AssetEntry = z.infer<typeof AssetEntrySchema>;

export const AssetManifestSchema = z.object({
  assets: z.array(AssetEntrySchema),
  totalSize: z.number(),
});
export type AssetManifest = z.infer<typeof AssetManifestSchema>;

/**
 * Image file extensions
 */
const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".bmp",
  ".avif",
];

/**
 * Font file extensions
 */
const FONT_EXTENSIONS = [".woff", ".woff2", ".ttf", ".otf", ".eot"];

/**
 * CSS file extensions
 */
const CSS_EXTENSIONS = [".css"];

/**
 * Determine asset type from URL
 */
export function getAssetType(url: string): AssetType | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const ext = path.extname(pathname);

    if (IMAGE_EXTENSIONS.includes(ext)) {
      return "image";
    }
    if (FONT_EXTENSIONS.includes(ext)) {
      return "font";
    }
    if (CSS_EXTENSIONS.includes(ext)) {
      return "css";
    }

    // Check for data URLs
    if (url.startsWith("data:image/")) {
      return "image";
    }
    if (url.startsWith("data:font/") || url.startsWith("data:application/font")) {
      return "font";
    }

    return null;
  } catch {
    // Handle relative URLs or malformed URLs
    const pathname = url.toLowerCase();
    const ext = path.extname(pathname.split("?")[0]);

    if (IMAGE_EXTENSIONS.includes(ext)) {
      return "image";
    }
    if (FONT_EXTENSIONS.includes(ext)) {
      return "font";
    }
    if (CSS_EXTENSIONS.includes(ext)) {
      return "css";
    }

    return null;
  }
}

/**
 * Extract all asset URLs from HTML content
 */
export function extractAssetUrls(html: string, baseUrl: string): Map<string, AssetType> {
  const assets = new Map<string, AssetType>();

  // Extract image sources from img tags
  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgSrcRegex.exec(html)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (url && !url.startsWith("data:")) {
      assets.set(url, "image");
    }
  }

  // Extract image sources from srcset
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    const urls = srcset.split(",").map((entry) => entry.trim().split(/\s+/)[0]);
    for (const url of urls) {
      const resolved = resolveUrl(url, baseUrl);
      if (resolved && !resolved.startsWith("data:")) {
        assets.set(resolved, "image");
      }
    }
  }

  // Extract background images from inline styles
  const bgImageRegex = /url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgImageRegex.exec(html)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (url && !url.startsWith("data:")) {
      const type = getAssetType(url);
      if (type) {
        assets.set(url, type);
      }
    }
  }

  // Extract CSS link tags
  const cssLinkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi;
  while ((match = cssLinkRegex.exec(html)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (url) {
      assets.set(url, "css");
    }
  }

  // Also match link tags with href before rel
  const cssLinkRegex2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi;
  while ((match = cssLinkRegex2.exec(html)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (url) {
      assets.set(url, "css");
    }
  }

  return assets;
}

/**
 * Extract asset URLs from CSS content
 */
export function extractCssAssetUrls(css: string, baseUrl: string): Map<string, AssetType> {
  const assets = new Map<string, AssetType>();

  // Extract url() references
  const urlRegex = /url\(["']?([^"')]+)["']?\)/gi;
  let match;
  while ((match = urlRegex.exec(css)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (url && !url.startsWith("data:")) {
      const type = getAssetType(url);
      if (type) {
        assets.set(url, type);
      }
    }
  }

  // Extract @import rules
  const importRegex = /@import\s+(?:url\()?["']?([^"');\s]+)["']?\)?/gi;
  while ((match = importRegex.exec(css)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (url) {
      assets.set(url, "css");
    }
  }

  // Extract @font-face src
  const fontFaceRegex = /@font-face\s*{[^}]*src:\s*([^;]+)/gi;
  while ((match = fontFaceRegex.exec(css)) !== null) {
    const srcValue = match[1];
    const fontUrlRegex = /url\(["']?([^"')]+)["']?\)/gi;
    let fontMatch;
    while ((fontMatch = fontUrlRegex.exec(srcValue)) !== null) {
      const url = resolveUrl(fontMatch[1], baseUrl);
      if (url && !url.startsWith("data:")) {
        assets.set(url, "font");
      }
    }
  }

  return assets;
}

/**
 * Resolve a URL relative to a base URL
 */
export function resolveUrl(url: string, baseUrl: string): string | null {
  if (!url || url.startsWith("data:") || url.startsWith("javascript:")) {
    return url.startsWith("data:") ? url : null;
  }

  try {
    // Handle protocol-relative URLs
    if (url.startsWith("//")) {
      return `https:${url}`;
    }

    // Handle absolute URLs
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    // Resolve relative URLs
    const base = new URL(baseUrl);
    const resolved = new URL(url, base);
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Generate a safe local filename from a URL
 */
export function generateLocalFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const basename = path.basename(pathname);

    // Remove query parameters and decode
    const cleanName = decodeURIComponent(basename.split("?")[0]);

    // Sanitize filename - remove unsafe characters
    const safeName = cleanName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 100); // Limit filename length

    if (!safeName || safeName === "_") {
      // Generate a hash-based name for edge cases
      const hash = simpleHash(url);
      const ext = path.extname(pathname) || "";
      return `asset_${hash}${ext}`;
    }

    return safeName;
  } catch {
    const hash = simpleHash(url);
    return `asset_${hash}`;
  }
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

/**
 * Get the output directory for an asset type
 */
function getAssetDirectory(type: AssetType): string {
  switch (type) {
    case "image":
      return "images";
    case "font":
      return "fonts";
    case "css":
      return "styles";
  }
}

/**
 * Download a single asset
 */
async function downloadAsset(
  url: string,
  type: AssetType,
  outputDir: string,
  currentTotalSize: number
): Promise<AssetEntry | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Crayon/1.0)",
        Accept: "*/*",
      },
    });

    if (!response.ok) {
      return null;
    }

    // Check content length header first if available
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_FILE_SIZE) {
        return null;
      }
      if (currentTotalSize + size > MAX_TOTAL_SIZE) {
        return null;
      }
    }

    const buffer = await response.arrayBuffer();
    const size = buffer.byteLength;

    // Enforce size limits
    if (size > MAX_FILE_SIZE) {
      return null;
    }
    if (currentTotalSize + size > MAX_TOTAL_SIZE) {
      return null;
    }

    // Generate local path
    const assetDir = getAssetDirectory(type);
    const filename = generateLocalFilename(url);
    const localPath = path.join(assetDir, filename);
    const fullPath = path.join(outputDir, localPath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file
    await fs.writeFile(fullPath, Buffer.from(buffer));

    return {
      originalUrl: url,
      localPath,
      type,
      size,
    };
  } catch {
    return null;
  }
}

/**
 * Download assets from DOM snapshots
 */
export async function download(
  snapshots: DOMSnapshot[],
  outputDir: string
): Promise<AssetManifest> {
  const allAssets = new Map<string, AssetType>();

  // Extract all asset URLs from all snapshots
  for (const snapshot of snapshots) {
    if (snapshot.html) {
      const htmlAssets = extractAssetUrls(snapshot.html, snapshot.url);
      for (const [url, type] of htmlAssets) {
        allAssets.set(url, type);
      }
    }
  }

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Download assets
  const assets: AssetEntry[] = [];
  let totalSize = 0;

  // Create subdirectories
  await fs.mkdir(path.join(outputDir, "images"), { recursive: true });
  await fs.mkdir(path.join(outputDir, "fonts"), { recursive: true });
  await fs.mkdir(path.join(outputDir, "styles"), { recursive: true });

  // Process CSS files first to discover additional assets
  const cssUrls: string[] = [];
  for (const [url, type] of allAssets) {
    if (type === "css") {
      cssUrls.push(url);
    }
  }

  // Download CSS files and extract additional assets
  for (const cssUrl of cssUrls) {
    try {
      const response = await fetch(cssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Crayon/1.0)",
          Accept: "text/css,*/*",
        },
      });

      if (response.ok) {
        const cssContent = await response.text();
        const cssAssets = extractCssAssetUrls(cssContent, cssUrl);
        for (const [url, type] of cssAssets) {
          if (!allAssets.has(url)) {
            allAssets.set(url, type);
          }
        }
      }
    } catch {
      // Ignore CSS fetch errors
    }
  }

  // Download all assets
  for (const [url, type] of allAssets) {
    // Check if we've hit the total size limit
    if (totalSize >= MAX_TOTAL_SIZE) {
      break;
    }

    const asset = await downloadAsset(url, type, outputDir, totalSize);
    if (asset) {
      assets.push(asset);
      totalSize += asset.size;
    }
  }

  return {
    assets,
    totalSize,
  };
}

/**
 * Rewrite URLs in HTML to use local asset paths
 */
export function rewriteUrls(html: string, manifest: AssetManifest): string {
  let result = html;

  // Create a map for quick lookup
  const urlMap = new Map<string, string>();
  for (const asset of manifest.assets) {
    urlMap.set(asset.originalUrl, asset.localPath);
  }

  // Sort by URL length descending to avoid partial replacements
  const sortedAssets = [...manifest.assets].sort(
    (a, b) => b.originalUrl.length - a.originalUrl.length
  );

  for (const asset of sortedAssets) {
    const originalUrl = asset.originalUrl;
    const localPath = asset.localPath;

    // Escape special regex characters in the URL
    const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Replace in src attributes
    result = result.replace(
      new RegExp(`(src=["'])${escapedUrl}(["'])`, "gi"),
      `$1${localPath}$2`
    );

    // Replace in href attributes (for CSS links)
    result = result.replace(
      new RegExp(`(href=["'])${escapedUrl}(["'])`, "gi"),
      `$1${localPath}$2`
    );

    // Replace in srcset attributes
    result = result.replace(
      new RegExp(`(srcset=["'][^"']*)${escapedUrl}`, "gi"),
      `$1${localPath}`
    );

    // Replace in url() (inline styles and CSS)
    result = result.replace(
      new RegExp(`url\\(["']?${escapedUrl}["']?\\)`, "gi"),
      `url("${localPath}")`
    );

    // Replace in style attributes
    result = result.replace(
      new RegExp(`(style=["'][^"']*)${escapedUrl}`, "gi"),
      `$1${localPath}`
    );
  }

  return result;
}
