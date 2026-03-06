/**
 * Recording Cleaner - Cleans and prepares DOM snapshots and network requests for AI code generation
 *
 * This module removes noise, irrelevant elements, and PII from recordings to create
 * a focused, token-efficient representation for AI prompts.
 */

import { z } from "zod";
import type { Recording, DOMSnapshot, NetworkCall, PageMetadata } from "@crayon/types";
import { PageMetadataSchema } from "@crayon/types";
import { anonymizeDom, anonymizeJson } from "./pii-anonymizer.js";

// Zod schemas for cleaned types
export const CleanedDOMSnapshotSchema = z.object({
  url: z.string(),
  timestamp: z.number(),
  html: z.string(),
  structure: z.string(),
  metadata: PageMetadataSchema.optional(),
});
export type CleanedDOMSnapshot = z.infer<typeof CleanedDOMSnapshotSchema>;

export const CleanedNetworkRequestSchema = z.object({
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string()),
  body: z.unknown().optional(),
  response: z.unknown().optional(),
});
export type CleanedNetworkRequest = z.infer<typeof CleanedNetworkRequestSchema>;

export const CleanedRecordingMetadataSchema = z.object({
  originalTokenCount: z.number(),
  cleanedTokenCount: z.number(),
  elementsRemoved: z.number(),
  requestsFiltered: z.number(),
});
export type CleanedRecordingMetadata = z.infer<typeof CleanedRecordingMetadataSchema>;

export const CleanedRecordingSchema = z.object({
  dom: z.array(CleanedDOMSnapshotSchema),
  network: z.array(CleanedNetworkRequestSchema),
  metadata: CleanedRecordingMetadataSchema,
});
export type CleanedRecording = z.infer<typeof CleanedRecordingSchema>;

// Patterns for detecting noise in DOM
const SCRIPT_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<script\b[^>]*\/>/gi,
];

const ANALYTICS_PATTERNS = [
  /google-analytics/i,
  /googletagmanager/i,
  /gtag/i,
  /segment\.com/i,
  /mixpanel/i,
  /amplitude/i,
  /hotjar/i,
  /intercom/i,
  /heap/i,
];

const AD_PATTERNS = [
  /doubleclick/i,
  /googlesyndication/i,
  /adsbygoogle/i,
  /advertising/i,
  /adsystem/i,
  /class=["'].*ad[-_].*["']/i,
  /id=["'].*ad[-_].*["']/i,
];

// Patterns for detecting third-party domains
const THIRD_PARTY_DOMAINS = [
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "facebook.com",
  "twitter.com",
  "linkedin.com",
  "analytics.google.com",
  "segment.io",
  "segment.com",
  "mixpanel.com",
  "amplitude.com",
  "hotjar.com",
  "intercom.io",
  "heap.io",
];

// Essential headers to keep
const ESSENTIAL_HEADERS = [
  "content-type",
  "accept",
  "cache-control",
  "user-agent",
];

/**
 * Estimate token count for a string (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Clean HTML by removing scripts, inline styles, and other noise
 */
function cleanHtml(html: string): { cleaned: string; elementsRemoved: number } {
  let cleaned = html;
  let elementsRemoved = 0;

  // Remove script tags
  for (const pattern of SCRIPT_PATTERNS) {
    const matches = cleaned.match(pattern);
    if (matches) {
      elementsRemoved += matches.length;
    }
    cleaned = cleaned.replace(pattern, "");
  }

  // Remove comments
  const commentMatches = cleaned.match(/<!--[\s\S]*?-->/g);
  if (commentMatches) {
    elementsRemoved += commentMatches.length;
  }
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

  // Remove inline styles but keep class and id attributes
  cleaned = cleaned.replace(/\s+style=["'][^"']*["']/gi, "");

  // Remove data attributes except data-testid and data-component
  cleaned = cleaned.replace(/\s+data-(?!testid|component)[a-z-]+(?:=["'][^"']*["'])?/gi, "");

  // Remove empty attributes
  cleaned = cleaned.replace(/\s+[a-z-]+(?:=["']["'])/gi, "");

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ");
  cleaned = cleaned.replace(/>\s+</g, "><");

  // Remove elements with display: none (basic detection)
  const displayNoneMatches = cleaned.match(/<[^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi);
  if (displayNoneMatches) {
    elementsRemoved += displayNoneMatches.length;
  }
  cleaned = cleaned.replace(/<[^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi, "");

  return { cleaned, elementsRemoved };
}

/**
 * Generate a simplified structure representation of HTML for pattern matching
 */
function generateStructure(html: string): string {
  // Extract just the tag structure without attributes or content
  const tagPattern = /<(\w+)(?:\s[^>]*)?>|<\/(\w+)>/g;
  const tags: string[] = [];
  let match;

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1] || match[2];
    if (tag) {
      tags.push(tag);
    }
  }

  // Create a simplified tree representation
  return tags.join(" > ");
}

/**
 * Check if a URL is from a third-party domain
 */
function isThirdPartyDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return THIRD_PARTY_DOMAINS.some((domain) =>
      urlObj.hostname.includes(domain)
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL is for analytics or tracking
 */
function isAnalyticsRequest(url: string): boolean {
  return ANALYTICS_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if a URL is for ads
 */
function isAdRequest(url: string): boolean {
  return AD_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if a request should be kept (API, assets, etc.)
 */
function shouldKeepRequest(call: NetworkCall, baseUrl: string): boolean {
  const url = call.request.url;

  // Filter out analytics
  if (isAnalyticsRequest(url)) {
    return false;
  }

  // Filter out ads
  if (isAdRequest(url)) {
    return false;
  }

  // Filter out third-party domains (except for assets)
  if (isThirdPartyDomain(url)) {
    // Keep CDN assets (images, fonts, stylesheets)
    const isAsset = /\.(jpg|jpeg|png|gif|svg|woff|woff2|ttf|css|js)$/i.test(url);
    return isAsset;
  }

  // Keep everything from the same domain
  try {
    const requestUrl = new URL(url);
    const recordingUrl = new URL(baseUrl);
    return requestUrl.hostname === recordingUrl.hostname;
  } catch {
    return false;
  }
}

/**
 * Filter headers to keep only essential ones
 */
function filterHeaders(headers: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (ESSENTIAL_HEADERS.includes(lowerKey)) {
      filtered[key] = value;
    }
  }

  // Remove authentication tokens
  delete filtered.authorization;
  delete filtered.Authorization;
  delete filtered["x-api-key"];
  delete filtered["X-API-Key"];

  return filtered;
}

/**
 * Parse and clean request/response body
 */
function parseAndCleanBody(body: string | undefined, contentType: string): unknown {
  if (!body) {
    return undefined;
  }

  try {
    // Try to parse JSON
    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(body);
      return anonymizeJson(parsed);
    }

    // For other types, anonymize as string
    return anonymizeDom(body);
  } catch {
    // If parsing fails, anonymize as string
    return anonymizeDom(body);
  }
}

/**
 * Clean a single DOM snapshot
 */
function cleanDomSnapshot(snapshot: DOMSnapshot): CleanedDOMSnapshot | null {
  // Skip diff snapshots (they don't have full HTML)
  if (snapshot.type === "diff" || !snapshot.html) {
    return null;
  }

  // Clean HTML
  const { cleaned } = cleanHtml(snapshot.html);

  // Anonymize PII
  const anonymized = anonymizeDom(cleaned);

  // Generate structure
  const structure = generateStructure(anonymized);

  return {
    url: snapshot.url,
    timestamp: snapshot.timestamp,
    html: anonymized,
    structure,
    metadata: snapshot.metadata,
  };
}

/**
 * Clean a single network call
 */
function cleanNetworkCall(call: NetworkCall): CleanedNetworkRequest {
  // Filter headers
  const requestHeaders = filterHeaders(call.request.headers);
  const responseHeaders = filterHeaders(call.response.headers);

  // Parse and clean bodies
  const requestBody = parseAndCleanBody(
    call.request.body,
    call.request.headers["content-type"] || ""
  );
  const responseBody = parseAndCleanBody(
    call.response.body,
    call.response.contentType
  );

  return {
    method: call.request.method,
    url: call.request.url,
    headers: { ...requestHeaders, ...responseHeaders },
    body: requestBody,
    response: responseBody,
  };
}

/**
 * Clean a complete recording
 */
export async function clean(recording: Recording): Promise<CleanedRecording> {
  const baseUrl = recording.metadata.startUrl;
  let totalElementsRemoved = 0;

  // Clean DOM snapshots
  const cleanedDomSnapshots: CleanedDOMSnapshot[] = [];
  for (const snapshot of recording.domSnapshots) {
    const cleaned = cleanDomSnapshot(snapshot);
    if (cleaned) {
      // Track elements removed (approximate based on size reduction)
      if (snapshot.html) {
        const originalSize = snapshot.html.length;
        const cleanedSize = cleaned.html.length;
        const reductionRatio = (originalSize - cleanedSize) / originalSize;
        totalElementsRemoved += Math.floor(reductionRatio * 100);
      }
      cleanedDomSnapshots.push(cleaned);
    }
  }

  // Filter and clean network calls
  const filteredCalls = recording.networkCalls.filter((call) =>
    shouldKeepRequest(call, baseUrl)
  );
  const cleanedNetworkRequests: CleanedNetworkRequest[] = filteredCalls.map((call) =>
    cleanNetworkCall(call)
  );

  // Calculate token counts
  const originalDomTokens = recording.domSnapshots.reduce(
    (sum, snapshot) => sum + estimateTokens(snapshot.html || ""),
    0
  );
  const originalNetworkTokens = recording.networkCalls.reduce(
    (sum, call) =>
      sum +
      estimateTokens(call.request.body || "") +
      estimateTokens(call.response.body || ""),
    0
  );
  const originalTokenCount = originalDomTokens + originalNetworkTokens;

  const cleanedDomTokens = cleanedDomSnapshots.reduce(
    (sum, snapshot) => sum + estimateTokens(snapshot.html),
    0
  );
  const cleanedNetworkTokens = cleanedNetworkRequests.reduce(
    (sum, request) =>
      sum +
      estimateTokens(JSON.stringify(request.body || "")) +
      estimateTokens(JSON.stringify(request.response || "")),
    0
  );
  const cleanedTokenCount = cleanedDomTokens + cleanedNetworkTokens;

  return {
    dom: cleanedDomSnapshots,
    network: cleanedNetworkRequests,
    metadata: {
      originalTokenCount,
      cleanedTokenCount,
      elementsRemoved: totalElementsRemoved,
      requestsFiltered: recording.networkCalls.length - cleanedNetworkRequests.length,
    },
  };
}
