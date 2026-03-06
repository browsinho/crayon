import type {
  UserEvent,
  Mutation,
  DOMSnapshot,
  UIStateChangeType,
  CorrelationMetrics,
} from "@crayon/types";

export interface ClassificationResult {
  type: UIStateChangeType;
  confidence: number;
  reasoning: string[];
}

interface ClassificationSignal {
  type: UIStateChangeType;
  weight: number;
  reason: string;
}

const MODAL_PATTERNS = [
  /\bmodal\b/i,
  /\bdialog\b/i,
  /\boverlay\b/i,
  /\bbackdrop\b/i,
  /\blightbox\b/i,
  /\bpopup\b/i,
  /\bdrawer\b/i,
];

const DROPDOWN_PATTERNS = [
  /\bdropdown\b/i,
  /\bmenu\b/i,
  /\bpopover\b/i,
  /\btooltip\b/i,
  /\bautocomplete\b/i,
  /\bselect-options\b/i,
  /\blistbox\b/i,
];

const TAB_PATTERNS = [
  /\btab\b/i,
  /\btabs\b/i,
  /\btab-panel\b/i,
  /\btabpanel\b/i,
];

const ACCORDION_PATTERNS = [
  /\baccordion\b/i,
  /\bcollapse\b/i,
  /\bexpand\b/i,
];

const NOTIFICATION_PATTERNS = [
  /\btoast\b/i,
  /\bsnackbar\b/i,
  /\bnotification\b/i,
  /\balert\b/i,
  /\bbanner\b/i,
];

export class StateChangeClassifier {
  classify(
    triggerEvent: UserEvent,
    mutations: Mutation[],
    beforeSnapshot: DOMSnapshot | null,
    afterSnapshot: DOMSnapshot | null,
    metrics: CorrelationMetrics
  ): ClassificationResult {
    const signals: ClassificationSignal[] = [];

    // Signal 1: URL Change (strongest signal for page transition)
    if (metrics.hasUrlChange) {
      signals.push({
        type: "page_transition",
        weight: 0.9,
        reason: "URL changed",
      });
    }

    // Signal 2: History API change
    if (metrics.hasHistoryChange && !metrics.hasUrlChange) {
      signals.push({
        type: "page_transition",
        weight: 0.8,
        reason: "History state changed (SPA navigation)",
      });
    }

    // Signal 3: Content change ratio
    if (metrics.contentChangeRatio > 0.5) {
      signals.push({
        type: "page_transition",
        weight: metrics.contentChangeRatio * 0.7,
        reason: `${Math.round(metrics.contentChangeRatio * 100)}% content changed`,
      });
    } else if (metrics.contentChangeRatio < 0.1 && mutations.length > 0) {
      signals.push({
        type: "minor_update",
        weight: 0.6,
        reason: "Minimal content change",
      });
    }

    // Signal 4: Modal/overlay detection
    const modalSignal = this.detectModalPattern(mutations);
    if (modalSignal) {
      signals.push(modalSignal);
    }

    // Signal 5: Dropdown/menu detection
    const dropdownSignal = this.detectDropdownPattern(triggerEvent, mutations);
    if (dropdownSignal) {
      signals.push(dropdownSignal);
    }

    // Signal 6: Tab pattern detection
    const tabSignal = this.detectTabPattern(triggerEvent, mutations);
    if (tabSignal) {
      signals.push(tabSignal);
    }

    // Signal 7: Accordion pattern detection
    const accordionSignal = this.detectAccordionPattern(mutations);
    if (accordionSignal) {
      signals.push(accordionSignal);
    }

    // Signal 8: Notification pattern detection
    const notificationSignal = this.detectNotificationPattern(mutations);
    if (notificationSignal) {
      signals.push(notificationSignal);
    }

    // Signal 9: Overlay area detection
    if (metrics.affectedArea.isOverlay) {
      signals.push({
        type: "modal_open",
        weight: 0.7,
        reason: "Overlay element detected",
      });
    }

    // Signal 10: Full page vs localized change
    if (metrics.affectedArea.isFullPage && !metrics.hasUrlChange) {
      signals.push({
        type: "content_load",
        weight: 0.6,
        reason: "Full page content changed without URL change",
      });
    } else if (metrics.affectedArea.isLocalized) {
      signals.push({
        type: "minor_update",
        weight: 0.5,
        reason: "Localized DOM change",
      });
    }

    // Signal 11: Form validation detection
    const formValidationSignal = this.detectFormValidation(mutations, triggerEvent);
    if (formValidationSignal) {
      signals.push(formValidationSignal);
    }

    return this.aggregateSignals(signals);
  }

  private detectModalPattern(mutations: Mutation[]): ClassificationSignal | null {
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes && mutation.addedNodes.length > 0) {
        // Check if the mutation target or new value suggests a modal
        const targetString = String(mutation.target).toLowerCase();
        for (const pattern of MODAL_PATTERNS) {
          if (pattern.test(targetString)) {
            return {
              type: "modal_open",
              weight: 0.85,
              reason: `Modal pattern detected: ${pattern.source}`,
            };
          }
        }
      }

      if (mutation.type === "attributes") {
        const attrName = mutation.attributeName?.toLowerCase() ?? "";
        const newValue = mutation.newValue?.toLowerCase() ?? "";

        if (attrName === "class" || attrName === "style") {
          for (const pattern of MODAL_PATTERNS) {
            if (pattern.test(newValue)) {
              return {
                type: "modal_open",
                weight: 0.85,
                reason: `Modal class/style detected: ${newValue.substring(0, 50)}`,
              };
            }
          }

          // Check for visibility changes that indicate modal
          if (
            newValue.includes("display: block") ||
            newValue.includes("visibility: visible") ||
            newValue.includes("opacity: 1")
          ) {
            // Only count if it also matches modal patterns
            for (const pattern of MODAL_PATTERNS) {
              if (pattern.test(newValue)) {
                return {
                  type: "modal_open",
                  weight: 0.8,
                  reason: "Modal visibility change detected",
                };
              }
            }
          }
        }

        // ARIA attributes
        if (attrName === "aria-hidden" && newValue === "false") {
          return {
            type: "modal_open",
            weight: 0.7,
            reason: "aria-hidden changed to false",
          };
        }

        if (attrName === "aria-modal" && newValue === "true") {
          return {
            type: "modal_open",
            weight: 0.9,
            reason: "aria-modal set to true",
          };
        }
      }
    }

    return null;
  }

  private detectDropdownPattern(
    event: UserEvent,
    mutations: Mutation[]
  ): ClassificationSignal | null {
    if (event.type !== "click") return null;

    // Check if the clicked element or mutations suggest a dropdown
    const targetSelector = event.target.selector.toLowerCase();
    const targetClass = event.target.className?.toLowerCase() ?? "";

    // Check trigger element
    for (const pattern of DROPDOWN_PATTERNS) {
      if (pattern.test(targetSelector) || pattern.test(targetClass)) {
        return {
          type: "dropdown_open",
          weight: 0.8,
          reason: `Dropdown trigger clicked: ${pattern.source}`,
        };
      }
    }

    // Check mutations for dropdown content appearing
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const attrName = mutation.attributeName?.toLowerCase() ?? "";
        const newValue = mutation.newValue?.toLowerCase() ?? "";

        if (attrName === "class" || attrName === "aria-expanded") {
          for (const pattern of DROPDOWN_PATTERNS) {
            if (pattern.test(newValue)) {
              return {
                type: "dropdown_open",
                weight: 0.8,
                reason: `Dropdown content appeared: ${pattern.source}`,
              };
            }
          }

          if (attrName === "aria-expanded" && newValue === "true") {
            return {
              type: "dropdown_open",
              weight: 0.85,
              reason: "aria-expanded changed to true",
            };
          }
        }
      }
    }

    return null;
  }

  private detectTabPattern(
    event: UserEvent,
    mutations: Mutation[]
  ): ClassificationSignal | null {
    if (event.type !== "click") return null;

    const targetSelector = event.target.selector.toLowerCase();
    const targetClass = event.target.className?.toLowerCase() ?? "";

    // Check if clicked element is a tab
    for (const pattern of TAB_PATTERNS) {
      if (pattern.test(targetSelector) || pattern.test(targetClass)) {
        return {
          type: "tab_switch",
          weight: 0.75,
          reason: `Tab element clicked: ${pattern.source}`,
        };
      }
    }

    // Check ARIA role
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const attrName = mutation.attributeName?.toLowerCase() ?? "";
        const newValue = mutation.newValue?.toLowerCase() ?? "";

        if (attrName === "aria-selected" && newValue === "true") {
          return {
            type: "tab_switch",
            weight: 0.85,
            reason: "Tab selected (aria-selected)",
          };
        }

        if (attrName === "role" && (newValue === "tab" || newValue === "tabpanel")) {
          return {
            type: "tab_switch",
            weight: 0.7,
            reason: `Tab role detected: ${newValue}`,
          };
        }
      }
    }

    return null;
  }

  private detectAccordionPattern(mutations: Mutation[]): ClassificationSignal | null {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const attrName = mutation.attributeName?.toLowerCase() ?? "";
        const newValue = mutation.newValue?.toLowerCase() ?? "";

        if (attrName === "class") {
          for (const pattern of ACCORDION_PATTERNS) {
            if (pattern.test(newValue)) {
              return {
                type: "accordion_toggle",
                weight: 0.75,
                reason: `Accordion pattern detected: ${pattern.source}`,
              };
            }
          }
        }

        // Check for height/max-height changes (common accordion animation)
        if (attrName === "style") {
          if (
            newValue.includes("height:") ||
            newValue.includes("max-height:")
          ) {
            for (const pattern of ACCORDION_PATTERNS) {
              if (pattern.test(mutation.target)) {
                return {
                  type: "accordion_toggle",
                  weight: 0.7,
                  reason: "Accordion height animation detected",
                };
              }
            }
          }
        }
      }
    }

    return null;
  }

  private detectNotificationPattern(mutations: Mutation[]): ClassificationSignal | null {
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes && mutation.addedNodes.length > 0) {
        // Check target for notification patterns
        const targetString = String(mutation.target).toLowerCase();
        for (const pattern of NOTIFICATION_PATTERNS) {
          if (pattern.test(targetString)) {
            return {
              type: "notification",
              weight: 0.8,
              reason: `Notification pattern detected: ${pattern.source}`,
            };
          }
        }
      }

      if (mutation.type === "attributes") {
        const newValue = mutation.newValue?.toLowerCase() ?? "";
        for (const pattern of NOTIFICATION_PATTERNS) {
          if (pattern.test(newValue)) {
            return {
              type: "notification",
              weight: 0.75,
              reason: `Notification class detected: ${newValue.substring(0, 50)}`,
            };
          }
        }
      }
    }

    return null;
  }

  private detectFormValidation(
    mutations: Mutation[],
    event: UserEvent
  ): ClassificationSignal | null {
    // Check if this looks like form validation feedback
    const isInputRelated =
      event.type === "input" ||
      (event.type === "click" &&
        ["BUTTON", "INPUT", "SUBMIT"].includes(event.target.tagName.toUpperCase()));

    if (!isInputRelated) return null;

    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const attrName = mutation.attributeName?.toLowerCase() ?? "";
        const newValue = mutation.newValue?.toLowerCase() ?? "";

        // Common validation class patterns
        if (attrName === "class") {
          if (
            newValue.includes("error") ||
            newValue.includes("invalid") ||
            newValue.includes("valid") ||
            newValue.includes("success") ||
            newValue.includes("warning")
          ) {
            return {
              type: "form_validation",
              weight: 0.8,
              reason: "Form validation state change detected",
            };
          }
        }

        // ARIA validation attributes
        if (
          attrName === "aria-invalid" ||
          attrName === "aria-errormessage" ||
          attrName === "aria-describedby"
        ) {
          return {
            type: "form_validation",
            weight: 0.85,
            reason: "ARIA validation attribute changed",
          };
        }
      }
    }

    return null;
  }

  private aggregateSignals(signals: ClassificationSignal[]): ClassificationResult {
    if (signals.length === 0) {
      return {
        type: "minor_update",
        confidence: 0.5,
        reasoning: ["No specific pattern detected"],
      };
    }

    // Group signals by type and sum weights
    const typeScores = new Map<UIStateChangeType, number>();
    const typeReasons = new Map<UIStateChangeType, string[]>();

    for (const signal of signals) {
      const currentScore = typeScores.get(signal.type) ?? 0;
      typeScores.set(signal.type, currentScore + signal.weight);

      const reasons = typeReasons.get(signal.type) ?? [];
      reasons.push(signal.reason);
      typeReasons.set(signal.type, reasons);
    }

    // Find the highest scoring type
    let bestType: UIStateChangeType = "minor_update";
    let bestScore = 0;

    for (const [type, score] of typeScores) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    // Normalize confidence to 0-1 range
    // Score of 2.0 or more = 100% confidence
    const confidence = Math.min(bestScore / 2, 1);

    return {
      type: bestType,
      confidence,
      reasoning: typeReasons.get(bestType) ?? [],
    };
  }
}

export const createStateChangeClassifier = (): StateChangeClassifier => {
  return new StateChangeClassifier();
};
