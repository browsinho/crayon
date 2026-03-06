/**
 * Framework Detector - Analyzes DOM snapshots to detect frontend frameworks
 *
 * Detects:
 * - React (data-reactroot, data-reactid, _reactRootContainer)
 * - Vue (data-v-*, __vue__, Vue.config)
 * - Angular (ng-version, _nghost-*, _ngcontent-*)
 * - Returns 'vanilla' if no framework detected
 */

import type { DOMSnapshot, FrameworkInfo, FrameworkType } from "@crayon/types";

// Detection signal patterns
const REACT_SIGNALS = {
  "data-reactroot": /data-reactroot/i,
  "data-reactid": /data-reactid/i,
  _reactRootContainer: /_reactRootContainer/i,
  __REACT_DEVTOOLS_GLOBAL_HOOK__: /__REACT_DEVTOOLS_GLOBAL_HOOK__/i,
};

const VUE_SIGNALS = {
  "data-v-": /data-v-[a-f0-9]+/i,
  __vue__: /__vue__/i,
  "Vue.config": /Vue\.config/i,
  "data-v-app": /data-v-app/i,
};

const ANGULAR_SIGNALS = {
  "ng-version": /ng-version/i,
  "_nghost-": /_nghost-/i,
  "_ngcontent-": /_ngcontent-/i,
  "ng-reflect-": /ng-reflect-/i,
};

interface SignalMatch {
  framework: FrameworkType;
  signal: string;
  weight: number;
}

/**
 * Calculate confidence score based on signal matches
 * More signals = higher confidence, with diminishing returns
 */
function calculateConfidence(matchCount: number, totalSignals: number): number {
  if (matchCount === 0) return 0;
  // Base confidence starts at 0.5 for any match
  // Each additional match adds decreasing confidence up to ~0.95
  const base = 0.5;
  const remaining = 0.45;
  const ratio = matchCount / totalSignals;
  return Math.min(base + remaining * ratio, 0.95);
}

/**
 * Detect signals in HTML content for a specific framework
 */
function detectSignals(
  html: string,
  signals: Record<string, RegExp>,
  framework: FrameworkType
): SignalMatch[] {
  const matches: SignalMatch[] = [];

  for (const [signal, pattern] of Object.entries(signals)) {
    if (pattern.test(html)) {
      matches.push({
        framework,
        signal,
        weight: 1,
      });
    }
  }

  return matches;
}

/**
 * Analyze a single DOM snapshot for framework signals
 */
function analyzeSnapshot(snapshot: DOMSnapshot): SignalMatch[] {
  const html = snapshot.html ?? "";
  const allMatches: SignalMatch[] = [];

  // Check for React
  allMatches.push(...detectSignals(html, REACT_SIGNALS, "react"));

  // Check for Vue
  allMatches.push(...detectSignals(html, VUE_SIGNALS, "vue"));

  // Check for Angular
  allMatches.push(...detectSignals(html, ANGULAR_SIGNALS, "angular"));

  return allMatches;
}

/**
 * Detect frontend framework used in recorded DOM snapshots
 *
 * @param snapshots - Array of DOM snapshots to analyze
 * @returns FrameworkInfo with detected framework, confidence, and signals
 */
export function detect(snapshots: DOMSnapshot[]): FrameworkInfo {
  if (snapshots.length === 0) {
    return {
      framework: "vanilla",
      confidence: 1.0,
      signals: [],
    };
  }

  // Collect all signal matches across snapshots
  const allMatches: SignalMatch[] = [];
  for (const snapshot of snapshots) {
    allMatches.push(...analyzeSnapshot(snapshot));
  }

  if (allMatches.length === 0) {
    return {
      framework: "vanilla",
      confidence: 1.0,
      signals: [],
    };
  }

  // Group matches by framework
  const frameworkMatches = new Map<FrameworkType, Set<string>>();

  for (const match of allMatches) {
    const existing = frameworkMatches.get(match.framework) ?? new Set();
    existing.add(match.signal);
    frameworkMatches.set(match.framework, existing);
  }

  // Find framework with most unique signals
  let bestFramework: FrameworkType = "vanilla";
  let maxSignals = 0;
  let bestSignalSet = new Set<string>();

  for (const [framework, signals] of frameworkMatches.entries()) {
    if (signals.size > maxSignals) {
      maxSignals = signals.size;
      bestFramework = framework;
      bestSignalSet = signals;
    }
  }

  // Calculate confidence based on number of signals detected
  const totalPossibleSignals =
    bestFramework === "react"
      ? Object.keys(REACT_SIGNALS).length
      : bestFramework === "vue"
        ? Object.keys(VUE_SIGNALS).length
        : bestFramework === "angular"
          ? Object.keys(ANGULAR_SIGNALS).length
          : 0;

  const confidence = calculateConfidence(bestSignalSet.size, totalPossibleSignals);

  return {
    framework: bestFramework,
    confidence,
    signals: Array.from(bestSignalSet),
  };
}
