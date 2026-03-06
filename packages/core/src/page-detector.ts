import type {
  Page,
  PageType,
  PageEntryType,
  DOMSnapshot,
  CorrelatedEventGroup,
  UserEvent,
} from "@crayon/types";
import { EventEmitter } from "events";
import type { EventCorrelator } from "./event-correlator.js";
import type { DOMCapture } from "./dom-capture.js";
import type { UserEventCapture } from "./user-event-capture.js";

export interface PageDetectorConfig {
  pageTransitionThreshold?: number;
  treatModalsAsPages?: boolean;
  contentChangeThreshold?: number;
}

const DEFAULT_CONFIG: Required<PageDetectorConfig> = {
  pageTransitionThreshold: 0.7,
  treatModalsAsPages: true,
  contentChangeThreshold: 0.6,
};

export class PageDetector extends EventEmitter {
  private config: Required<PageDetectorConfig>;
  private pages: Page[] = [];
  private currentPage: Page | null = null;
  private correlator: EventCorrelator | null = null;
  private domCapture: DOMCapture | null = null;
  private userEventCapture: UserEventCapture | null = null;

  private boundHandlers = {
    correlatedGroup: this.handleCorrelatedGroup.bind(this),
    snapshot: this.handleSnapshot.bind(this),
    spaNavigation: this.handleSpaNavigation.bind(this),
  };

  constructor(config: PageDetectorConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  attachCaptures(correlator: EventCorrelator, domCapture: DOMCapture, userEventCapture?: UserEventCapture): void {
    this.correlator = correlator;
    this.domCapture = domCapture;
    this.userEventCapture = userEventCapture ?? null;

    this.correlator.on("correlatedGroup", this.boundHandlers.correlatedGroup);
    
    // Listen for DOM snapshots to detect URL changes (most reliable for page detection)
    this.domCapture.on("snapshot", this.boundHandlers.snapshot);
    
    // Listen for SPA navigation events
    if (this.userEventCapture) {
      this.userEventCapture.on("spaNavigation", this.boundHandlers.spaNavigation);
    }
  }

  detach(): void {
    if (this.correlator) {
      this.correlator.off("correlatedGroup", this.boundHandlers.correlatedGroup);
    }
    if (this.domCapture) {
      this.domCapture.off("snapshot", this.boundHandlers.snapshot);
    }
    if (this.userEventCapture) {
      this.userEventCapture.off("spaNavigation", this.boundHandlers.spaNavigation);
    }

    this.correlator = null;
    this.domCapture = null;
    this.userEventCapture = null;
  }

  initializeFirstPage(snapshot: DOMSnapshot): void {
    this.currentPage = {
      id: this.generateId(),
      url: snapshot.url,
      title: snapshot.metadata?.title,
      pageType: "page",
      startTimestamp: snapshot.timestamp,
      entryTrigger: {
        type: "initial_load",
      },
      initialSnapshot: snapshot,
      userEvents: [],
      correlatedGroups: [],
      screenshotIds: [],
      networkCallIds: [],
    };

    this.emit("pageStart", this.currentPage);
  }

  getPages(): Page[] {
    const allPages = [...this.pages];
    if (this.currentPage) {
      allPages.push(this.currentPage);
    }
    return allPages;
  }

  getCurrentPage(): Page | null {
    return this.currentPage;
  }

  finalize(): void {
    if (this.currentPage) {
      const latestSnapshot = this.domCapture?.getLatestSnapshot();
      if (latestSnapshot) {
        this.currentPage.endTimestamp = latestSnapshot.timestamp;
        this.currentPage.finalSnapshot = latestSnapshot;
      }
      this.pages.push(this.currentPage);
      this.currentPage = null;
    }
  }

  private handleCorrelatedGroup(group: CorrelatedEventGroup): void {
    const transition = this.determineTransition(group);

    if (transition.isNewPage) {
      this.finishCurrentPage(group.timestamp);
      this.startNewPage(group, transition.pageType, transition.entryType);
    } else {
      this.addEventToCurrentPage(group);
    }
  }

  private handleSnapshot(snapshot: DOMSnapshot): void {
    // Most reliable page detection: URL changed in a new snapshot
    if (!this.currentPage) return;
    
    const currentUrl = this.currentPage.url;
    const newUrl = snapshot.url;
    
    // Normalize URLs for comparison (remove trailing slashes, ignore hash for some cases)
    const normalizeUrl = (url: string) => {
      try {
        const parsed = new URL(url);
        // Compare origin + pathname (ignore hash for SPA detection)
        return parsed.origin + parsed.pathname.replace(/\/$/, '');
      } catch {
        return url;
      }
    };
    
    const normalizedCurrent = normalizeUrl(currentUrl);
    const normalizedNew = normalizeUrl(newUrl);
    
    if (normalizedCurrent !== normalizedNew && !newUrl.includes('about:blank')) {
      this.finishCurrentPage(snapshot.timestamp);
      this.startNewPageFromSnapshot(snapshot, "navigation");
    }
  }

  private handleSpaNavigation(event: { url: string; timestamp: number }): void {
    if (!this.currentPage) return;
    
    const currentUrl = this.currentPage.url;
    
    if (currentUrl !== event.url && !event.url.includes('about:blank')) {
      this.finishCurrentPage(event.timestamp);
      
      // Get latest snapshot for the new page, but use the event URL
      // (snapshot URL might be stale due to async nature of SPA navigation)
      const latestSnapshot = this.domCapture?.getLatestSnapshot();
      if (latestSnapshot) {
        this.startNewPageFromSnapshot(latestSnapshot, "spa_transition", event.url);
      }
    }
  }

  private startNewPageFromSnapshot(snapshot: DOMSnapshot, entryType: PageEntryType, overrideUrl?: string): void {
    const previousPageId = this.pages.length > 0 ? this.pages[this.pages.length - 1].id : undefined;
    
    // Use override URL if provided (for SPA navigation where snapshot URL might be stale)
    const pageUrl = overrideUrl || snapshot.url;

    this.currentPage = {
      id: this.generateId(),
      url: pageUrl,
      title: snapshot.metadata?.title,
      pageType: "page",
      startTimestamp: snapshot.timestamp,
      entryTrigger: {
        type: entryType,
        previousPageId,
      },
      initialSnapshot: snapshot,
      userEvents: [],
      correlatedGroups: [],
      screenshotIds: [],
      networkCallIds: [],
    };

    this.emit("pageStart", this.currentPage);
  }

  private determineTransition(group: CorrelatedEventGroup): {
    isNewPage: boolean;
    pageType: PageType;
    entryType: PageEntryType;
  } {
    // URL change always means new page
    if (group.metrics.hasUrlChange) {
      return {
        isNewPage: true,
        pageType: "page",
        entryType: "navigation",
      };
    }

    // History change (SPA navigation) means new page
    if (group.metrics.hasHistoryChange) {
      return {
        isNewPage: true,
        pageType: "page",
        entryType: "spa_transition",
      };
    }

    // Page transition with high confidence
    if (
      group.uiStateChange === "page_transition" &&
      group.confidence >= this.config.pageTransitionThreshold
    ) {
      return {
        isNewPage: true,
        pageType: "page",
        entryType: "spa_transition",
      };
    }

    // Large content change that affects full page
    if (
      group.metrics.contentChangeRatio > this.config.contentChangeThreshold &&
      group.metrics.affectedArea.isFullPage
    ) {
      return {
        isNewPage: true,
        pageType: "page",
        entryType: "spa_transition",
      };
    }

    // Modal opening (if configured to treat as pages)
    if (this.config.treatModalsAsPages && group.uiStateChange === "modal_open") {
      return {
        isNewPage: true,
        pageType: "modal",
        entryType: "modal_open",
      };
    }

    // Modal closing - return to previous page context
    if (group.uiStateChange === "modal_close" && this.currentPage?.pageType === "modal") {
      return {
        isNewPage: true,
        pageType: "page",
        entryType: "back_forward",
      };
    }

    return {
      isNewPage: false,
      pageType: "page",
      entryType: "navigation",
    };
  }

  private finishCurrentPage(endTimestamp: number): void {
    if (!this.currentPage) return;

    this.currentPage.endTimestamp = endTimestamp;
    const latestSnapshot = this.domCapture?.getLatestSnapshot();
    if (latestSnapshot) {
      this.currentPage.finalSnapshot = latestSnapshot;
    }

    this.pages.push(this.currentPage);
    this.emit("pageEnd", this.currentPage);
  }

  private startNewPage(
    trigger: CorrelatedEventGroup,
    pageType: PageType,
    entryType: PageEntryType
  ): void {
    const latestSnapshot = this.domCapture?.getLatestSnapshot();
    if (!latestSnapshot) {
      return;
    }

    const previousPageId = this.pages.length > 0 ? this.pages[this.pages.length - 1].id : undefined;

    this.currentPage = {
      id: this.generateId(),
      url: latestSnapshot.url,
      title: latestSnapshot.metadata?.title,
      pageType,
      startTimestamp: trigger.timestamp,
      entryTrigger: {
        type: entryType,
        triggerEventId: trigger.triggerEvent.id,
        previousPageId,
      },
      initialSnapshot: latestSnapshot,
      userEvents: [],
      correlatedGroups: [trigger],
      screenshotIds: [],
      networkCallIds: trigger.networkCallIds,
    };

    this.emit("pageStart", this.currentPage);
  }

  private addEventToCurrentPage(group: CorrelatedEventGroup): void {
    if (!this.currentPage) return;

    this.currentPage.userEvents.push(group.triggerEvent);
    this.currentPage.correlatedGroups.push(group);
    this.currentPage.networkCallIds.push(...group.networkCallIds);
  }

  addUserEvent(event: UserEvent): void {
    if (this.currentPage) {
      this.currentPage.userEvents.push(event);
    }
  }

  addScreenshot(screenshotId: string): void {
    if (this.currentPage) {
      this.currentPage.screenshotIds.push(screenshotId);
    }
  }

  addNetworkCall(networkCallId: string): void {
    if (this.currentPage) {
      this.currentPage.networkCallIds.push(networkCallId);
    }
  }

  private generateId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const createPageDetector = (config?: PageDetectorConfig): PageDetector => {
  return new PageDetector(config);
};

/**
 * Post-processing function to detect pages from recorded DOM snapshots.
 * This serves as validation/enhancement for real-time detection.
 * 
 * It analyzes URL changes in snapshots and creates pages for each unique URL.
 * Can merge with real-time detected pages to fill any gaps.
 */
export function detectPagesFromSnapshots(
  snapshots: DOMSnapshot[],
  existingPages?: Page[]
): Page[] {
  if (snapshots.length === 0) {
    return existingPages ?? [];
  }

  // Sort snapshots by timestamp
  const sortedSnapshots = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  
  // Detect pages from URL changes in snapshots
  const detectedPages: Page[] = [];
  let currentUrl = "";
  let currentPage: Page | null = null;
  
  const normalizeUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      // Normalize: origin + pathname (remove trailing slash, ignore hash)
      return parsed.origin + parsed.pathname.replace(/\/$/, '');
    } catch {
      return url;
    }
  };

  for (const snapshot of sortedSnapshots) {
    // Skip about:blank and invalid URLs
    if (!snapshot.url || snapshot.url.includes('about:blank')) {
      continue;
    }

    const normalizedUrl = normalizeUrl(snapshot.url);
    const normalizedCurrent = currentUrl ? normalizeUrl(currentUrl) : "";

    // Only consider full snapshots for page detection (not diffs)
    if (snapshot.type === "full" && normalizedUrl !== normalizedCurrent) {
      // Finish previous page
      if (currentPage) {
        currentPage.endTimestamp = snapshot.timestamp;
        detectedPages.push(currentPage);
      }

      // Start new page
      currentPage = {
        id: `page-post-${snapshot.timestamp}-${Math.random().toString(36).substring(2, 9)}`,
        url: snapshot.url,
        title: snapshot.metadata?.title,
        pageType: "page" as PageType,
        startTimestamp: snapshot.timestamp,
        entryTrigger: {
          type: detectedPages.length === 0 ? "initial_load" : "navigation" as PageEntryType,
          previousPageId: detectedPages.length > 0 ? detectedPages[detectedPages.length - 1].id : undefined,
        },
        initialSnapshot: snapshot,
        userEvents: [],
        correlatedGroups: [],
        screenshotIds: [],
        networkCallIds: [],
      };
      
      currentUrl = snapshot.url;
    }
  }

  // Finalize the last page
  if (currentPage) {
    const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
    currentPage.endTimestamp = lastSnapshot.timestamp;
    currentPage.finalSnapshot = lastSnapshot;
    detectedPages.push(currentPage);
  }

  // If no existing pages, return detected pages
  if (!existingPages || existingPages.length === 0) {
    return detectedPages;
  }

  // Merge: Use existing pages but fill gaps with detected pages
  return mergePages(existingPages, detectedPages);
}

/**
 * Merge real-time detected pages with post-processed pages.
 * Prioritizes real-time pages but adds any missed pages from post-processing.
 */
function mergePages(realTimePages: Page[], postProcessedPages: Page[]): Page[] {
  if (postProcessedPages.length === 0) {
    return realTimePages;
  }
  
  if (realTimePages.length === 0) {
    return postProcessedPages;
  }

  // Create a set of normalized URLs from real-time pages
  const normalizeUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname.replace(/\/$/, '');
    } catch {
      return url;
    }
  };

  const realTimeUrls = new Set(realTimePages.map(p => normalizeUrl(p.url)));
  
  // Find pages detected in post-processing that were missed in real-time
  const missedPages = postProcessedPages.filter(pp => !realTimeUrls.has(normalizeUrl(pp.url)));
  
  if (missedPages.length === 0) {
    return realTimePages;
  }

  // Merge by timestamp order
  const allPages = [...realTimePages, ...missedPages];
  allPages.sort((a, b) => a.startTimestamp - b.startTimestamp);
  
  // Re-link previousPageId references
  for (let i = 1; i < allPages.length; i++) {
    allPages[i].entryTrigger.previousPageId = allPages[i - 1].id;
  }

  return allPages;
}
