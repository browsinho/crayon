/**
 * Widget Detector - Detects third-party widgets in recorded DOM that need mocking
 *
 * Detects:
 * - Google OAuth buttons (data-client_id, accounts.google.com)
 * - Stripe payment elements (.StripeElement, js.stripe.com)
 * - Google Maps embeds (.gm-style, maps.googleapis.com)
 * - reCAPTCHA (.g-recaptcha, recaptcha)
 */

import type { DOMSnapshot, WidgetInfo, WidgetType } from "@crayon/types";

// Detection patterns for each widget type
interface WidgetPattern {
  type: WidgetType;
  provider: string;
  selectors: RegExp[];
  scripts: RegExp[];
}

const WIDGET_PATTERNS: WidgetPattern[] = [
  {
    type: "oauth-google",
    provider: "google",
    selectors: [/data-client_id/i, /data-login_uri/i, /g_id_onload/i, /g_id_signin/i],
    scripts: [/accounts\.google\.com/i, /apis\.google\.com\/js\/platform/i],
  },
  {
    type: "stripe",
    provider: "stripe",
    selectors: [/class="[^"]*StripeElement[^"]*"/i, /class='[^']*StripeElement[^']*'/i],
    scripts: [/js\.stripe\.com/i],
  },
  {
    type: "maps",
    provider: "google",
    selectors: [/class="[^"]*gm-style[^"]*"/i, /class='[^']*gm-style[^']*'/i],
    scripts: [/maps\.googleapis\.com/i, /maps\.google\.com/i],
  },
  {
    type: "recaptcha",
    provider: "google",
    selectors: [/class="[^"]*g-recaptcha[^"]*"/i, /class='[^']*g-recaptcha[^']*'/i, /data-sitekey/i],
    scripts: [/www\.google\.com\/recaptcha/i, /recaptcha\/api/i],
  },
];

// Selector mappings for extraction
const SELECTOR_MAP: Record<WidgetType, string> = {
  "oauth-google": "[data-client_id], .g_id_signin, .g_id_onload",
  stripe: ".StripeElement",
  maps: ".gm-style",
  recaptcha: ".g-recaptcha, [data-sitekey]",
};

interface DetectedWidget {
  type: WidgetType;
  provider: string;
  matchedPattern: string;
}

/**
 * Check if a pattern matches in the HTML content
 */
function matchesPattern(html: string, pattern: RegExp): boolean {
  return pattern.test(html);
}

/**
 * Detect widgets in a single DOM snapshot
 */
function detectInSnapshot(snapshot: DOMSnapshot): DetectedWidget[] {
  const html = snapshot.html ?? "";
  const detected: DetectedWidget[] = [];

  for (const widgetPattern of WIDGET_PATTERNS) {
    // Check selector patterns
    for (const selector of widgetPattern.selectors) {
      if (matchesPattern(html, selector)) {
        detected.push({
          type: widgetPattern.type,
          provider: widgetPattern.provider,
          matchedPattern: selector.source,
        });
        break; // Only need one match per widget type from selectors
      }
    }

    // Check script patterns
    for (const script of widgetPattern.scripts) {
      if (matchesPattern(html, script)) {
        // Check if we already detected this widget type
        const alreadyDetected = detected.some((d) => d.type === widgetPattern.type);
        if (!alreadyDetected) {
          detected.push({
            type: widgetPattern.type,
            provider: widgetPattern.provider,
            matchedPattern: script.source,
          });
        }
        break;
      }
    }
  }

  return detected;
}

/**
 * Detect third-party widgets from DOM snapshots
 *
 * @param snapshots - Array of DOM snapshots to analyze
 * @returns Array of detected widgets with their type, selector, and provider
 */
export function detect(snapshots: DOMSnapshot[]): WidgetInfo[] {
  if (snapshots.length === 0) {
    return [];
  }

  // Collect all detected widgets across snapshots
  const detectedMap = new Map<WidgetType, DetectedWidget>();

  for (const snapshot of snapshots) {
    const detected = detectInSnapshot(snapshot);
    for (const widget of detected) {
      // Only keep first detection of each type
      if (!detectedMap.has(widget.type)) {
        detectedMap.set(widget.type, widget);
      }
    }
  }

  // Convert to WidgetInfo array
  const result: WidgetInfo[] = [];
  for (const [type, widget] of detectedMap) {
    result.push({
      type,
      selector: SELECTOR_MAP[type],
      provider: widget.provider,
    });
  }

  return result;
}
