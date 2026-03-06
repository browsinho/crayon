import type { DOMSnapshot, Mutation, Viewport, PageMetadata } from "@crayon/types";
import { EventEmitter } from "events";

export interface CDPSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: (params: unknown) => void): void;
  off(event: string, handler: (params: unknown) => void): void;
}

interface CDPNode {
  nodeId: number;
  backendNodeId?: number;
  nodeType: number;
  nodeName: string;
  localName?: string;
  nodeValue?: string;
  childNodeCount?: number;
  children?: CDPNode[];
  attributes?: string[];
}

interface CDPGetDocumentResult {
  root: CDPNode;
}

interface CDPGetOuterHTMLResult {
  outerHTML: string;
}

interface CDPChildNodeInsertedParams {
  parentNodeId: number;
  previousNodeId: number;
  node: CDPNode;
}

interface CDPChildNodeRemovedParams {
  parentNodeId: number;
  nodeId: number;
}

interface CDPAttributeModifiedParams {
  nodeId: number;
  name: string;
  value: string;
}

interface CDPCharacterDataModifiedParams {
  nodeId: number;
  characterData: string;
}

interface CDPFrameNavigatedParams {
  frame: {
    id: string;
    parentId?: string;
    url: string;
    securityOrigin?: string;
    mimeType?: string;
  };
}

interface CDPLayoutMetrics {
  layoutViewport: {
    pageX: number;
    pageY: number;
    clientWidth: number;
    clientHeight: number;
  };
  visualViewport: {
    offsetX: number;
    offsetY: number;
    pageX: number;
    pageY: number;
    clientWidth: number;
    clientHeight: number;
    scale: number;
    zoom?: number;
  };
  contentSize: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cssLayoutViewport?: {
    clientWidth: number;
    clientHeight: number;
  };
}

export interface DOMCaptureConfig {
  mutationBatchInterval?: number;
  mutationThreshold?: number;
}

const DEFAULT_CONFIG: Required<DOMCaptureConfig> = {
  mutationBatchInterval: 100,
  mutationThreshold: 10,
};

/**
 * JavaScript code to extract page metadata, executed in the browser context via CDP
 */
const EXTRACT_METADATA_SCRIPT = `
(function() {
  const result = {};

  // Basic metadata
  result.title = document.title || undefined;

  // Meta tags
  const getMetaContent = (name) => {
    const meta = document.querySelector('meta[name="' + name + '"]') ||
                 document.querySelector('meta[property="' + name + '"]');
    return meta ? meta.getAttribute('content') : undefined;
  };

  result.description = getMetaContent('description');
  result.author = getMetaContent('author');

  const keywords = getMetaContent('keywords');
  result.keywords = keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : undefined;

  // Language and charset
  result.language = document.documentElement.lang || undefined;
  const charset = document.querySelector('meta[charset]');
  result.charset = charset ? charset.getAttribute('charset') : undefined;

  // Canonical URL
  const canonical = document.querySelector('link[rel="canonical"]');
  result.canonicalUrl = canonical ? canonical.getAttribute('href') : undefined;

  // Open Graph
  const og = {};
  ['title', 'description', 'image', 'url', 'type', 'site_name'].forEach(prop => {
    const value = getMetaContent('og:' + prop);
    if (value) og[prop === 'site_name' ? 'siteName' : prop] = value;
  });
  if (Object.keys(og).length > 0) result.openGraph = og;

  // Twitter Card
  const twitter = {};
  ['card', 'title', 'description', 'image', 'site', 'creator'].forEach(prop => {
    const value = getMetaContent('twitter:' + prop);
    if (value) twitter[prop] = value;
  });
  if (Object.keys(twitter).length > 0) result.twitterCard = twitter;

  // Favicon
  const favicon = document.querySelector('link[rel="icon"]') ||
                  document.querySelector('link[rel="shortcut icon"]');
  result.favicon = favicon ? favicon.getAttribute('href') : undefined;

  // Headings (limit to first 20)
  const headings = [];
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h, i) => {
    if (i < 20) {
      headings.push({
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim().substring(0, 200)
      });
    }
  });
  if (headings.length > 0) result.headings = headings;

  // Navigation links (from nav elements, limit to 30)
  const navLinks = [];
  document.querySelectorAll('nav a[href]').forEach((a, i) => {
    if (i < 30) {
      const text = a.textContent.trim();
      const href = a.getAttribute('href');
      if (text && href) {
        navLinks.push({ text: text.substring(0, 100), href });
      }
    }
  });
  if (navLinks.length > 0) result.navLinks = navLinks;

  // Main content preview (from main, article, or first large text block)
  const mainEl = document.querySelector('main') || document.querySelector('article') || document.querySelector('[role="main"]');
  if (mainEl) {
    const text = mainEl.textContent.replace(/\\s+/g, ' ').trim();
    result.mainContentPreview = text.substring(0, 500);
  }

  // Forms
  const forms = [];
  document.querySelectorAll('form').forEach((form, i) => {
    if (i < 10) {
      const inputs = form.querySelectorAll('input');
      forms.push({
        action: form.getAttribute('action') || undefined,
        method: form.getAttribute('method') || undefined,
        id: form.id || undefined,
        name: form.getAttribute('name') || undefined,
        inputCount: inputs.length,
        hasPasswordField: form.querySelector('input[type="password"]') !== null,
        hasEmailField: form.querySelector('input[type="email"]') !== null
      });
    }
  });
  if (forms.length > 0) result.forms = forms;

  // Link counts
  const allLinks = document.querySelectorAll('a[href]');
  let internal = 0, external = 0;
  const currentHost = window.location.host;
  allLinks.forEach(a => {
    try {
      const href = a.getAttribute('href');
      if (href.startsWith('#') || href.startsWith('/') || href.startsWith('.')) {
        internal++;
      } else {
        const url = new URL(href, window.location.origin);
        if (url.host === currentHost) internal++;
        else external++;
      }
    } catch (e) { internal++; }
  });
  result.internalLinkCount = internal;
  result.externalLinkCount = external;

  // Semantic regions
  result.hasHeader = document.querySelector('header') !== null;
  result.hasFooter = document.querySelector('footer') !== null;
  result.hasNav = document.querySelector('nav') !== null;
  result.hasMain = document.querySelector('main') !== null;
  result.hasAside = document.querySelector('aside') !== null;

  return result;
})()
`;

export class DOMCapture extends EventEmitter {
  private cdpSession: CDPSession | null = null;
  private snapshots: DOMSnapshot[] = [];
  private pendingMutations: Mutation[] = [];
  private mutationBatchTimer: ReturnType<typeof setTimeout> | null = null;
  private config: Required<DOMCaptureConfig>;
  private currentUrl: string = "";
  private documentNodeId: number = 0;
  private isAttached: boolean = false;
  private lastViewport: Viewport = { width: 1280, height: 720 };

  private boundHandlers = {
    childNodeInserted: this.handleChildNodeInserted.bind(this),
    childNodeRemoved: this.handleChildNodeRemoved.bind(this),
    attributeModified: this.handleAttributeModified.bind(this),
    characterDataModified: this.handleCharacterDataModified.bind(this),
    documentUpdated: this.handleDocumentUpdated.bind(this),
    frameNavigated: this.handleFrameNavigated.bind(this),
    loadEventFired: this.handleLoadEventFired.bind(this),
  };

  constructor(config: DOMCaptureConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async attach(cdpSession: CDPSession): Promise<void> {
    if (this.isAttached) {
      throw new DOMCaptureError("Already attached to a CDP session");
    }

    this.cdpSession = cdpSession;
    this.isAttached = true;
    this.snapshots = [];
    this.pendingMutations = [];

    await this.cdpSession.send("DOM.enable");
    await this.cdpSession.send("Page.enable");

    this.cdpSession.on("DOM.childNodeInserted", this.boundHandlers.childNodeInserted);
    this.cdpSession.on("DOM.childNodeRemoved", this.boundHandlers.childNodeRemoved);
    this.cdpSession.on("DOM.attributeModified", this.boundHandlers.attributeModified);
    this.cdpSession.on("DOM.characterDataModified", this.boundHandlers.characterDataModified);
    this.cdpSession.on("DOM.documentUpdated", this.boundHandlers.documentUpdated);
    this.cdpSession.on("Page.frameNavigated", this.boundHandlers.frameNavigated);
    this.cdpSession.on("Page.loadEventFired", this.boundHandlers.loadEventFired);

    await this.captureInitialSnapshot();
  }

  stop(): void {
    if (!this.isAttached || !this.cdpSession) {
      return;
    }

    if (this.mutationBatchTimer) {
      clearTimeout(this.mutationBatchTimer);
      this.mutationBatchTimer = null;
    }

    if (this.pendingMutations.length >= this.config.mutationThreshold) {
      this.flushMutationsSync();
    }
    this.pendingMutations = [];

    this.cdpSession.off("DOM.childNodeInserted", this.boundHandlers.childNodeInserted);
    this.cdpSession.off("DOM.childNodeRemoved", this.boundHandlers.childNodeRemoved);
    this.cdpSession.off("DOM.attributeModified", this.boundHandlers.attributeModified);
    this.cdpSession.off("DOM.characterDataModified", this.boundHandlers.characterDataModified);
    this.cdpSession.off("DOM.documentUpdated", this.boundHandlers.documentUpdated);
    this.cdpSession.off("Page.frameNavigated", this.boundHandlers.frameNavigated);
    this.cdpSession.off("Page.loadEventFired", this.boundHandlers.loadEventFired);

    this.isAttached = false;
    this.cdpSession = null;
  }

  getSnapshots(): DOMSnapshot[] {
    return [...this.snapshots];
  }

  getLatestSnapshot(): DOMSnapshot | null {
    if (this.snapshots.length === 0) {
      return null;
    }
    return this.snapshots[this.snapshots.length - 1];
  }

  private async captureInitialSnapshot(): Promise<void> {
    if (!this.cdpSession) return;

    try {
      const result = await this.cdpSession.send("DOM.getDocument", {
        depth: -1,
        pierce: true,
      }) as CDPGetDocumentResult;

      this.documentNodeId = result.root.nodeId;

      const htmlResult = await this.cdpSession.send("DOM.getOuterHTML", {
        nodeId: this.documentNodeId,
      }) as CDPGetOuterHTMLResult;

      const viewport = await this.getViewport();
      const url = await this.getCurrentUrl();
      const metadata = await this.extractPageMetadata();
      this.currentUrl = url;

      const snapshot: DOMSnapshot = {
        id: this.generateId(),
        timestamp: Date.now(),
        url,
        type: "full",
        html: htmlResult.outerHTML,
        viewport,
        metadata,
      };

      this.snapshots.push(snapshot);
      this.emit("snapshot", snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new DOMCaptureError(`Failed to capture initial snapshot: ${message}`, error);
    }
  }

  private async captureFullSnapshot(): Promise<void> {
    if (!this.cdpSession || !this.isAttached) return;

    try {
      const result = await this.cdpSession.send("DOM.getDocument", {
        depth: -1,
        pierce: true,
      }) as CDPGetDocumentResult;

      this.documentNodeId = result.root.nodeId;

      const htmlResult = await this.cdpSession.send("DOM.getOuterHTML", {
        nodeId: this.documentNodeId,
      }) as CDPGetOuterHTMLResult;

      const viewport = await this.getViewport();
      const url = await this.getCurrentUrl();
      const metadata = await this.extractPageMetadata();
      this.currentUrl = url;

      const snapshot: DOMSnapshot = {
        id: this.generateId(),
        timestamp: Date.now(),
        url,
        type: "full",
        html: htmlResult.outerHTML,
        viewport,
        metadata,
      };

      this.snapshots.push(snapshot);
      this.emit("snapshot", snapshot);
    } catch {
      // Snapshot capture failed - page might still be loading
    }
  }

  private async getViewport(): Promise<Viewport> {
    if (!this.cdpSession) {
      return this.lastViewport;
    }

    try {
      const metrics = await this.cdpSession.send("Page.getLayoutMetrics") as CDPLayoutMetrics;
      this.lastViewport = {
        width: metrics.visualViewport.clientWidth,
        height: metrics.visualViewport.clientHeight,
      };
      return this.lastViewport;
    } catch {
      return this.lastViewport;
    }
  }

  private async getCurrentUrl(): Promise<string> {
    if (!this.cdpSession) {
      return this.currentUrl;
    }

    try {
      const result = await this.cdpSession.send("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true,
      }) as { result: { value: string } };
      return result.result.value || this.currentUrl;
    } catch {
      return this.currentUrl;
    }
  }

  private async extractPageMetadata(): Promise<PageMetadata | undefined> {
    if (!this.cdpSession) {
      return undefined;
    }

    try {
      const result = await this.cdpSession.send("Runtime.evaluate", {
        expression: EXTRACT_METADATA_SCRIPT,
        returnByValue: true,
      }) as { result: { value: PageMetadata } };
      return result.result.value || undefined;
    } catch {
      return undefined;
    }
  }

  private handleChildNodeInserted(params: unknown): void {
    const typedParams = params as CDPChildNodeInsertedParams;
    const mutation: Mutation = {
      type: "childList",
      target: String(typedParams.parentNodeId),
      addedNodes: [String(typedParams.node.nodeId)],
    };
    this.queueMutation(mutation);
  }

  private handleChildNodeRemoved(params: unknown): void {
    const typedParams = params as CDPChildNodeRemovedParams;
    const mutation: Mutation = {
      type: "childList",
      target: String(typedParams.parentNodeId),
      removedNodes: [String(typedParams.nodeId)],
    };
    this.queueMutation(mutation);
  }

  private handleAttributeModified(params: unknown): void {
    const typedParams = params as CDPAttributeModifiedParams;
    const mutation: Mutation = {
      type: "attributes",
      target: String(typedParams.nodeId),
      attributeName: typedParams.name,
      newValue: typedParams.value,
    };
    this.queueMutation(mutation);
  }

  private handleCharacterDataModified(params: unknown): void {
    const typedParams = params as CDPCharacterDataModifiedParams;
    const mutation: Mutation = {
      type: "characterData",
      target: String(typedParams.nodeId),
      newValue: typedParams.characterData,
    };
    this.queueMutation(mutation);
  }

  private handleDocumentUpdated(): void {
    this.pendingMutations = [];
    if (this.mutationBatchTimer) {
      clearTimeout(this.mutationBatchTimer);
      this.mutationBatchTimer = null;
    }

    void this.captureFullSnapshot();
  }

  private handleFrameNavigated(params: unknown): void {
    const typedParams = params as CDPFrameNavigatedParams;

    if (typedParams.frame.parentId) {
      return;
    }

    const newUrl = typedParams.frame.url;
    if (newUrl !== this.currentUrl) {
      this.currentUrl = newUrl;
      void this.captureFullSnapshot();
    }
  }

  private handleLoadEventFired(): void {
    void this.captureFullSnapshot();
  }

  private queueMutation(mutation: Mutation): void {
    this.pendingMutations.push(mutation);

    // Emit mutation event for correlation
    this.emit("mutation", mutation, Date.now());

    if (this.mutationBatchTimer) {
      clearTimeout(this.mutationBatchTimer);
    }

    this.mutationBatchTimer = setTimeout(() => {
      this.flushMutations();
    }, this.config.mutationBatchInterval);
  }

  private async flushMutations(): Promise<void> {
    if (this.pendingMutations.length < this.config.mutationThreshold) {
      this.pendingMutations = [];
      this.mutationBatchTimer = null;
      return;
    }

    const mutations = [...this.pendingMutations];
    this.pendingMutations = [];
    this.mutationBatchTimer = null;

    const viewport = await this.getViewport();

    const snapshot: DOMSnapshot = {
      id: this.generateId(),
      timestamp: Date.now(),
      url: this.currentUrl,
      type: "diff",
      mutations,
      viewport,
    };

    this.snapshots.push(snapshot);
  }

  private flushMutationsSync(): void {
    const mutations = [...this.pendingMutations];
    this.pendingMutations = [];
    this.mutationBatchTimer = null;

    const snapshot: DOMSnapshot = {
      id: this.generateId(),
      timestamp: Date.now(),
      url: this.currentUrl,
      type: "diff",
      mutations,
      viewport: this.lastViewport,
    };

    this.snapshots.push(snapshot);
  }

  private generateId(): string {
    return `dom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export class DOMCaptureError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DOMCaptureError";
    this.cause = cause;
  }
}

export const createDOMCapture = (config?: DOMCaptureConfig): DOMCapture => {
  return new DOMCapture(config);
};
