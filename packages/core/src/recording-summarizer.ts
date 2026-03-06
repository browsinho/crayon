/**
 * Recording Summarizer - Extracts factual data from recorded sessions
 *
 * This module focuses on extracting factual, verifiable information:
 * - Page URLs and titles
 * - Framework detection (structural analysis)
 * - Color palette extraction
 * - Font family extraction
 *
 * Classification tasks (page types, components, domain) are delegated to
 * the generation LLM which can understand context from the actual DOM.
 */

import type {
  BrandStyle,
  ComponentSummary,
  DOMSnapshot,
  InteractionSummary,
  PageSummary,
  Recording,
  RecordingSummary,
} from "@crayon/types";
import { detect as detectFramework } from "./framework-detector.js";

// Re-export type for convenience
export type { RecordingSummary };

/**
 * Extract colors from HTML content
 * Looks for color values in style attributes
 */
function extractColors(html: string): string[] {
  const colorSet = new Set<string>();

  // Extract hex colors
  const hexMatches = html.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g);
  if (hexMatches) {
    hexMatches.forEach((color) => colorSet.add(color.toLowerCase()));
  }

  // Extract rgb/rgba colors
  const rgbMatches = html.match(/rgba?\([^)]+\)/g);
  if (rgbMatches) {
    rgbMatches.forEach((color) => colorSet.add(color));
  }

  return Array.from(colorSet).slice(0, 10); // Limit to top 10 colors
}

/**
 * Extract font families from HTML content
 */
function extractFonts(html: string): string[] {
  const fontSet = new Set<string>();

  // Extract from font-family style declarations
  const fontMatches = html.match(/font-family:\s*([^;}"]+)/gi);
  if (fontMatches) {
    fontMatches.forEach((match) => {
      const fonts = match.replace(/font-family:\s*/i, "").split(",");
      fonts.forEach((font) => {
        const cleanFont = font.trim().replace(/['"]/g, "");
        if (cleanFont) {
          fontSet.add(cleanFont);
        }
      });
    });
  }

  return Array.from(fontSet).slice(0, 5); // Limit to top 5 fonts
}

/**
 * Extract page title from HTML
 */
function extractTitle(html: string, url: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : url;
}

/**
 * Analyze a single DOM snapshot to extract page information
 * Only extracts factual data - no classification
 */
function analyzePage(snapshot: DOMSnapshot): PageSummary {
  const html = snapshot.html ?? "";
  const url = snapshot.url;
  const title = extractTitle(html, url);

  return {
    url,
    title,
    pageType: "page", // Let the LLM determine from DOM context
    keyElements: [], // Let the LLM identify from DOM structure
  };
}

/**
 * Extract brand style from all snapshots
 * Only extracts factual data (colors, fonts)
 */
function extractBrandStyle(snapshots: DOMSnapshot[]): BrandStyle {
  const allColors = new Set<string>();
  const allFonts = new Set<string>();

  for (const snapshot of snapshots) {
    const html = snapshot.html ?? "";
    extractColors(html).forEach((c) => allColors.add(c));
    extractFonts(html).forEach((f) => allFonts.add(f));
  }

  return {
    colors: Array.from(allColors),
    fonts: Array.from(allFonts),
    styleKeywords: [], // Let the LLM determine style from DOM
  };
}

/**
 * Analyze user interactions from recording
 */
function analyzeInteractions(recording: Recording): InteractionSummary[] {
  const interactions: InteractionSummary[] = [];

  // Count navigation events (URL changes) - factual
  const uniqueUrls = new Set(recording.domSnapshots.map((s) => s.url));
  if (uniqueUrls.size > 1) {
    interactions.push({
      type: "navigation",
      description: `Navigated between ${uniqueUrls.size} different pages`,
      frequency: uniqueUrls.size,
    });
  }

  return interactions;
}

/**
 * Generate a minimal description from factual data
 */
function generateDescription(pages: PageSummary[], framework: string): string {
  if (pages.length === 0) {
    return "A web application";
  }

  const pageCount = pages.length;
  const frameworkNote = framework !== "vanilla" ? ` built with ${framework}` : "";

  if (pageCount === 1) {
    return `A single-page web application${frameworkNote}`;
  }

  return `A web application with ${pageCount} pages${frameworkNote}`;
}

/**
 * Generate summary from recording
 *
 * Focuses on factual extraction only - classification is delegated to the
 * generation LLM which has full context from the DOM structure.
 *
 * @param recording - Recording to analyze (supports both V1 and V2)
 * @returns RecordingSummary with factual data
 */
export async function summarize(recording: Recording): Promise<RecordingSummary> {
  const snapshots = recording.domSnapshots;

  // Analyze framework (structural analysis, not string matching)
  const framework = detectFramework(snapshots);

  // Extract pages - factual data only (URL, title)
  const pages: PageSummary[] = [];
  const seenUrls = new Set<string>();

  // Check if recording has V2 pages array (multi-page recording)
  const recordingV2 = recording as unknown as {
    pages?: Array<{ url: string; title?: string; initialSnapshot?: { html?: string } }>;
  };

  if (recordingV2.pages && recordingV2.pages.length > 0) {
    // Use pages from V2 recording (includes pages detected via SPA navigation)
    for (const page of recordingV2.pages) {
      if (!seenUrls.has(page.url) && !page.url.includes("about:blank")) {
        // Try to find a matching snapshot for this page
        const matchingSnapshot = snapshots.find((s) => s.url === page.url);
        if (matchingSnapshot) {
          pages.push(analyzePage(matchingSnapshot));
        } else if (page.initialSnapshot) {
          // Use page URL but extract title from snapshot if available
          const html = page.initialSnapshot.html ?? "";
          const title = page.title || extractTitle(html, page.url);
          pages.push({
            url: page.url,
            title,
            pageType: "page",
            keyElements: [],
          });
        } else {
          // Create a basic page summary from the page URL
          pages.push({
            url: page.url,
            title: page.title || page.url,
            pageType: "page",
            keyElements: [],
          });
        }
        seenUrls.add(page.url);
      }
    }
  }

  // Also include any pages from snapshots not already seen
  for (const snapshot of snapshots) {
    if (!seenUrls.has(snapshot.url) && !snapshot.url.includes("about:blank")) {
      pages.push(analyzePage(snapshot));
      seenUrls.add(snapshot.url);
    }
  }

  // Extract brand style (factual: colors, fonts)
  const brandStyle = extractBrandStyle(snapshots);

  // Generate minimal description
  const description = generateDescription(pages, framework.framework);

  // Analyze interactions (factual)
  const interactions = analyzeInteractions(recording);

  return {
    description,
    domain: "general", // Let the LLM determine from DOM context
    pages,
    components: [], // Let the LLM identify from DOM structure
    brandStyle,
    framework,
    interactions,
  };
}
