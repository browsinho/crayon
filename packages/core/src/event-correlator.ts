import type {
  UserEvent,
  Mutation,
  CorrelatedEventGroup,
  CorrelationMetrics,
  UIStateChangeType,
  AffectedArea,
  DOMSnapshot,
} from "@crayon/types";
import { EventEmitter } from "events";
import type { UserEventCapture } from "./user-event-capture.js";
import type { DOMCapture } from "./dom-capture.js";
import type { NetworkCapture } from "./network-capture.js";
import { StateChangeClassifier } from "./state-change-classifier.js";

export interface CorrelationConfig {
  domCorrelationWindowMs?: number;
  networkCorrelationWindowMs?: number;
  debounceMs?: number;
  minMutationsForGroup?: number;
}

const DEFAULT_CONFIG: Required<CorrelationConfig> = {
  domCorrelationWindowMs: 500,
  networkCorrelationWindowMs: 2000,
  debounceMs: 100,
  minMutationsForGroup: 1,
};

interface PendingCorrelation {
  id: string;
  triggerEvent: UserEvent;
  timestamp: number;
  domMutations: Mutation[];
  networkCallIds: string[];
  windowCloseTimer: ReturnType<typeof setTimeout>;
  snapshotBeforeEvent: DOMSnapshot | null;
}

export class EventCorrelator extends EventEmitter {
  private config: Required<CorrelationConfig>;
  private pendingCorrelations: Map<string, PendingCorrelation> = new Map();
  private correlatedGroups: CorrelatedEventGroup[] = [];
  private classifier: StateChangeClassifier;

  private userEventCapture: UserEventCapture | null = null;
  private domCapture: DOMCapture | null = null;
  private networkCapture: NetworkCapture | null = null;

  private boundHandlers = {
    userEvent: this.handleUserEvent.bind(this),
    mutation: this.handleMutation.bind(this),
    networkRequest: this.handleNetworkRequest.bind(this),
  };

  constructor(config: CorrelationConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.classifier = new StateChangeClassifier();
  }

  attachCaptures(
    userEventCapture: UserEventCapture,
    domCapture: DOMCapture,
    networkCapture: NetworkCapture
  ): void {
    this.userEventCapture = userEventCapture;
    this.domCapture = domCapture;
    this.networkCapture = networkCapture;

    this.userEventCapture.on("event", this.boundHandlers.userEvent);
    this.domCapture.on("mutation", this.boundHandlers.mutation);
    this.networkCapture.on("request", this.boundHandlers.networkRequest);
  }

  detach(): void {
    if (this.userEventCapture) {
      this.userEventCapture.off("event", this.boundHandlers.userEvent);
    }
    if (this.domCapture) {
      this.domCapture.off("mutation", this.boundHandlers.mutation);
    }
    if (this.networkCapture) {
      this.networkCapture.off("request", this.boundHandlers.networkRequest);
    }

    for (const [, correlation] of this.pendingCorrelations) {
      clearTimeout(correlation.windowCloseTimer);
    }
    this.pendingCorrelations.clear();

    this.userEventCapture = null;
    this.domCapture = null;
    this.networkCapture = null;
  }

  getGroups(): CorrelatedEventGroup[] {
    return [...this.correlatedGroups];
  }

  private handleUserEvent(event: UserEvent): void {
    const snapshotBefore = this.domCapture?.getLatestSnapshot() ?? null;

    const correlation: PendingCorrelation = {
      id: this.generateId(),
      triggerEvent: event,
      timestamp: event.timestamp,
      domMutations: [],
      networkCallIds: [],
      snapshotBeforeEvent: snapshotBefore,
      windowCloseTimer: setTimeout(
        () => this.finalizeCorrelation(correlation.id),
        this.config.domCorrelationWindowMs
      ),
    };

    this.pendingCorrelations.set(correlation.id, correlation);
  }

  private handleMutation(mutation: Mutation, timestamp: number): void {
    for (const [id, correlation] of this.pendingCorrelations) {
      const timeSinceEvent = timestamp - correlation.timestamp;
      if (timeSinceEvent >= 0 && timeSinceEvent <= this.config.domCorrelationWindowMs) {
        correlation.domMutations.push(mutation);

        clearTimeout(correlation.windowCloseTimer);
        correlation.windowCloseTimer = setTimeout(
          () => this.finalizeCorrelation(id),
          this.config.debounceMs
        );
      }
    }
  }

  private handleNetworkRequest(callId: string, timestamp: number): void {
    for (const [, correlation] of this.pendingCorrelations) {
      const timeSinceEvent = timestamp - correlation.timestamp;
      if (timeSinceEvent >= 0 && timeSinceEvent <= this.config.networkCorrelationWindowMs) {
        correlation.networkCallIds.push(callId);
      }
    }
  }

  private finalizeCorrelation(correlationId: string): void {
    const correlation = this.pendingCorrelations.get(correlationId);
    if (!correlation) return;

    this.pendingCorrelations.delete(correlationId);

    if (
      correlation.domMutations.length < this.config.minMutationsForGroup &&
      correlation.networkCallIds.length === 0
    ) {
      return;
    }

    const snapshotAfter = this.domCapture?.getLatestSnapshot() ?? null;
    const metrics = this.computeMetrics(correlation, snapshotAfter);

    const classification = this.classifier.classify(
      correlation.triggerEvent,
      correlation.domMutations,
      correlation.snapshotBeforeEvent,
      snapshotAfter,
      metrics
    );

    const group: CorrelatedEventGroup = {
      id: correlation.id,
      triggerEvent: correlation.triggerEvent,
      timestamp: correlation.timestamp,
      domMutations: correlation.domMutations,
      networkCallIds: correlation.networkCallIds,
      uiStateChange: classification.type,
      confidence: classification.confidence,
      metrics,
    };

    this.correlatedGroups.push(group);
    this.emit("correlatedGroup", group);
  }

  private computeMetrics(
    correlation: PendingCorrelation,
    snapshotAfter: DOMSnapshot | null
  ): CorrelationMetrics {
    let domNodesAdded = 0;
    let domNodesRemoved = 0;
    let domAttributesChanged = 0;

    for (const mutation of correlation.domMutations) {
      if (mutation.type === "childList") {
        domNodesAdded += mutation.addedNodes?.length ?? 0;
        domNodesRemoved += mutation.removedNodes?.length ?? 0;
      } else if (mutation.type === "attributes") {
        domAttributesChanged++;
      }
    }

    const hasUrlChange =
      correlation.snapshotBeforeEvent?.url !== snapshotAfter?.url &&
      snapshotAfter?.url !== undefined;

    const contentChangeRatio = this.computeContentChangeRatio(
      correlation.snapshotBeforeEvent,
      snapshotAfter
    );

    const affectedArea = this.determineAffectedArea(
      correlation.domMutations,
      contentChangeRatio
    );

    return {
      domNodesAdded,
      domNodesRemoved,
      domAttributesChanged,
      contentChangeRatio,
      hasUrlChange,
      hasHistoryChange: false,
      affectedArea,
    };
  }

  private computeContentChangeRatio(
    before: DOMSnapshot | null,
    after: DOMSnapshot | null
  ): number {
    if (!before?.html || !after?.html) {
      return 0;
    }

    const beforeText = this.extractTextContent(before.html);
    const afterText = this.extractTextContent(after.html);

    if (beforeText.length === 0 && afterText.length === 0) {
      return 0;
    }

    const similarity = this.computeTextSimilarity(beforeText, afterText);
    return 1 - similarity;
  }

  private extractTextContent(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 10000);
  }

  private computeTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    let intersection = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        intersection++;
      }
    }

    const union = words1.size + words2.size - intersection;
    return intersection / union;
  }

  private determineAffectedArea(
    mutations: Mutation[],
    contentChangeRatio: number
  ): AffectedArea {
    const isFullPage = contentChangeRatio > 0.5;
    const isLocalized = mutations.length > 0 && mutations.length < 20 && contentChangeRatio < 0.2;

    const isOverlay = mutations.some((m) => {
      if (m.type === "attributes" && m.attributeName === "class") {
        const value = m.newValue?.toLowerCase() ?? "";
        return (
          value.includes("modal") ||
          value.includes("dialog") ||
          value.includes("overlay") ||
          value.includes("backdrop") ||
          value.includes("popup")
        );
      }
      return false;
    });

    return {
      isFullPage,
      isOverlay,
      isLocalized,
    };
  }

  private generateId(): string {
    return `cor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const createEventCorrelator = (config?: CorrelationConfig): EventCorrelator => {
  return new EventCorrelator(config);
};
