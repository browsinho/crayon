import type { UserEvent, ClickEvent, InputEvent, ScrollEvent, KeyboardEvent, FocusEvent } from "@crayon/types";
import { EventEmitter } from "events";

export interface CDPSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: (params: unknown) => void): void;
  off(event: string, handler: (params: unknown) => void): void;
}

export interface UserEventCaptureConfig {
  scrollThrottleMs?: number;
  captureHover?: boolean;
  redactPasswords?: boolean;
}

const DEFAULT_CONFIG: Required<UserEventCaptureConfig> = {
  scrollThrottleMs: 200,
  captureHover: false,
  redactPasswords: true,
};

interface CDPBindingCalledParams {
  name: string;
  payload: string;
}

interface CDPNavigatedWithinDocumentParams {
  frameId: string;
  url: string;
}

interface RawEventData {
  type: string;
  timestamp: number;
  target: {
    selector: string;
    tagName: string;
    className?: string;
    id?: string;
    textContent?: string;
  };
  viewport: {
    x: number;
    y: number;
  };
  button?: number;
  clickCount?: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  inputType?: string;
  value?: string;
  previousValue?: string;
  scrollTop?: number;
  scrollLeft?: number;
  scrollHeight?: number;
  scrollWidth?: number;
  scrollDirection?: string;
  key?: string;
  code?: string;
  focusType?: string;
}

const CAPTURE_SCRIPT = `
(function() {
  if (window.__crayonEventCapture) return;
  window.__crayonEventCapture = true;

  let lastScrollTime = 0;
  let lastScrollTop = 0;
  const SCROLL_THROTTLE = {{SCROLL_THROTTLE}};

  function getCSSSelector(el) {
    if (!el || el === document.documentElement) return 'html';
    if (!el.tagName) return '';

    if (el.id) return '#' + el.id;

    let selector = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\\s+/).slice(0, 3);
      if (classes.length > 0 && classes[0]) {
        selector += '.' + classes.join('.');
      }
    }

    const parent = el.parentElement;
    if (parent && parent !== document.documentElement) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(el) + 1;
        selector += ':nth-of-type(' + index + ')';
      }
      return getCSSSelector(parent) + ' > ' + selector;
    }

    return selector;
  }

  function reportEvent(event) {
    try {
      window.__crayonReportEvent(JSON.stringify(event));
    } catch (e) {
      console.error('[Crayon] Failed to report event:', e);
    }
  }

  function getInputType(el) {
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'textarea') return 'textarea';
    if (tagName === 'select') return 'select';
    if (tagName === 'input') {
      const type = el.type?.toLowerCase() || 'text';
      if (['text', 'password', 'email', 'number', 'checkbox', 'radio'].includes(type)) {
        return type;
      }
      return 'other';
    }
    return 'other';
  }

  // Click events
  document.addEventListener('click', function(e) {
    reportEvent({
      type: 'click',
      timestamp: Date.now(),
      target: {
        selector: getCSSSelector(e.target),
        tagName: e.target.tagName || '',
        className: e.target.className || '',
        id: e.target.id || '',
        textContent: (e.target.textContent || '').substring(0, 100).trim()
      },
      viewport: { x: e.clientX, y: e.clientY },
      button: e.button,
      clickCount: e.detail,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey
    });
  }, true);

  // Input events
  document.addEventListener('input', function(e) {
    const inputType = getInputType(e.target);
    let value = e.target.value;

    // Redact password fields
    if (inputType === 'password') {
      value = '[REDACTED]';
    }

    reportEvent({
      type: 'input',
      timestamp: Date.now(),
      target: {
        selector: getCSSSelector(e.target),
        tagName: e.target.tagName || '',
        className: e.target.className || '',
        id: e.target.id || '',
        textContent: ''
      },
      viewport: { x: 0, y: 0 },
      inputType: inputType,
      value: value
    });
  }, true);

  // Scroll events (throttled)
  document.addEventListener('scroll', function(e) {
    const now = Date.now();
    if (now - lastScrollTime < SCROLL_THROTTLE) return;

    const target = e.target === document ? document.documentElement : e.target;
    const scrollTop = target.scrollTop || window.scrollY;
    const scrollLeft = target.scrollLeft || window.scrollX;
    const scrollHeight = target.scrollHeight || document.documentElement.scrollHeight;
    const scrollWidth = target.scrollWidth || document.documentElement.scrollWidth;

    const direction = scrollTop > lastScrollTop ? 'down' : 'up';
    lastScrollTop = scrollTop;
    lastScrollTime = now;

    reportEvent({
      type: 'scroll',
      timestamp: now,
      target: {
        selector: getCSSSelector(target),
        tagName: target.tagName || 'document',
        className: '',
        id: '',
        textContent: ''
      },
      viewport: { x: 0, y: 0 },
      scrollTop: scrollTop,
      scrollLeft: scrollLeft,
      scrollHeight: scrollHeight,
      scrollWidth: scrollWidth,
      scrollDirection: direction
    });
  }, true);

  // Keyboard events
  document.addEventListener('keydown', function(e) {
    // Only capture for shortcuts (with modifiers) or special keys
    const isModified = e.ctrlKey || e.altKey || e.metaKey;
    const isSpecialKey = ['Enter', 'Escape', 'Tab', 'Backspace', 'Delete'].includes(e.key);

    if (!isModified && !isSpecialKey) return;

    reportEvent({
      type: 'keyboard',
      timestamp: Date.now(),
      target: {
        selector: getCSSSelector(e.target),
        tagName: e.target.tagName || '',
        className: e.target.className || '',
        id: e.target.id || '',
        textContent: ''
      },
      viewport: { x: 0, y: 0 },
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey
    });
  }, true);

  // Focus events
  document.addEventListener('focusin', function(e) {
    reportEvent({
      type: 'focus',
      timestamp: Date.now(),
      target: {
        selector: getCSSSelector(e.target),
        tagName: e.target.tagName || '',
        className: e.target.className || '',
        id: e.target.id || '',
        textContent: ''
      },
      viewport: { x: 0, y: 0 },
      focusType: 'focus'
    });
  }, true);

  document.addEventListener('focusout', function(e) {
    reportEvent({
      type: 'focus',
      timestamp: Date.now(),
      target: {
        selector: getCSSSelector(e.target),
        tagName: e.target.tagName || '',
        className: e.target.className || '',
        id: e.target.id || '',
        textContent: ''
      },
      viewport: { x: 0, y: 0 },
      focusType: 'blur'
    });
  }, true);
})();
`;

export class UserEventCapture extends EventEmitter {
  private cdpSession: CDPSession | null = null;
  private events: UserEvent[] = [];
  private isAttached: boolean = false;
  private config: Required<UserEventCaptureConfig>;

  private boundHandlers = {
    bindingCalled: this.handleBindingCalled.bind(this),
    navigatedWithinDocument: this.handleNavigatedWithinDocument.bind(this),
  };

  constructor(config: UserEventCaptureConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async attach(cdpSession: CDPSession): Promise<void> {
    if (this.isAttached) {
      throw new UserEventCaptureError("Already attached to a CDP session");
    }

    this.cdpSession = cdpSession;
    this.isAttached = true;
    this.events = [];

    await this.cdpSession.send("Runtime.enable");
    await this.cdpSession.send("Page.enable");

    await this.cdpSession.send("Runtime.addBinding", {
      name: "__crayonReportEvent",
    });

    this.cdpSession.on("Runtime.bindingCalled", this.boundHandlers.bindingCalled);
    this.cdpSession.on("Page.navigatedWithinDocument", this.boundHandlers.navigatedWithinDocument);

    const script = CAPTURE_SCRIPT.replace(
      "{{SCROLL_THROTTLE}}",
      String(this.config.scrollThrottleMs)
    );

    await this.cdpSession.send("Page.addScriptToEvaluateOnNewDocument", {
      source: script,
    });

    await this.cdpSession.send("Runtime.evaluate", {
      expression: script,
    });
  }

  stop(): void {
    if (!this.isAttached || !this.cdpSession) {
      return;
    }

    this.cdpSession.off("Runtime.bindingCalled", this.boundHandlers.bindingCalled);
    this.cdpSession.off("Page.navigatedWithinDocument", this.boundHandlers.navigatedWithinDocument);

    this.isAttached = false;
    this.cdpSession = null;
  }

  getEvents(): UserEvent[] {
    return [...this.events];
  }

  private handleBindingCalled(params: unknown): void {
    const typedParams = params as CDPBindingCalledParams;
    if (typedParams.name !== "__crayonReportEvent") {
      return;
    }

    try {
      const rawEvent = JSON.parse(typedParams.payload) as RawEventData;
      const event = this.createUserEvent(rawEvent);
      if (event) {
        this.events.push(event);
        this.emit("event", event);
      }
    } catch (error) {
      // Invalid event data, skip
    }
  }

  private handleNavigatedWithinDocument(params: unknown): void {
    const typedParams = params as CDPNavigatedWithinDocumentParams;
    this.emit("spaNavigation", {
      url: typedParams.url,
      timestamp: Date.now(),
    });
  }

  private createUserEvent(raw: RawEventData): UserEvent | null {
    const baseEvent = {
      id: this.generateId(),
      timestamp: raw.timestamp,
      target: {
        selector: raw.target.selector,
        tagName: raw.target.tagName,
        className: raw.target.className,
        id: raw.target.id,
        textContent: raw.target.textContent,
      },
      viewport: raw.viewport,
    };

    switch (raw.type) {
      case "click":
        return {
          ...baseEvent,
          type: "click",
          button: this.mapButton(raw.button ?? 0),
          clickCount: raw.clickCount ?? 1,
          modifiers: {
            ctrl: raw.ctrlKey ?? false,
            shift: raw.shiftKey ?? false,
            alt: raw.altKey ?? false,
            meta: raw.metaKey ?? false,
          },
        } as ClickEvent;

      case "input":
        return {
          ...baseEvent,
          type: "input",
          inputType: this.mapInputType(raw.inputType),
          value: raw.value,
          previousValue: raw.previousValue,
        } as InputEvent;

      case "scroll":
        return {
          ...baseEvent,
          type: "scroll",
          scrollTop: raw.scrollTop ?? 0,
          scrollLeft: raw.scrollLeft ?? 0,
          scrollHeight: raw.scrollHeight ?? 0,
          scrollWidth: raw.scrollWidth ?? 0,
          direction: this.mapScrollDirection(raw.scrollDirection),
        } as ScrollEvent;

      case "keyboard":
        return {
          ...baseEvent,
          type: "keyboard",
          key: raw.key ?? "",
          code: raw.code ?? "",
          modifiers: {
            ctrl: raw.ctrlKey ?? false,
            shift: raw.shiftKey ?? false,
            alt: raw.altKey ?? false,
            meta: raw.metaKey ?? false,
          },
        } as KeyboardEvent;

      case "focus":
        return {
          ...baseEvent,
          type: "focus",
          focusType: raw.focusType === "blur" ? "blur" : "focus",
        } as FocusEvent;

      default:
        return null;
    }
  }

  private mapButton(button: number): "left" | "middle" | "right" {
    switch (button) {
      case 1:
        return "middle";
      case 2:
        return "right";
      default:
        return "left";
    }
  }

  private mapInputType(
    inputType: string | undefined
  ): "text" | "password" | "email" | "number" | "checkbox" | "radio" | "select" | "textarea" | "other" {
    const validTypes = ["text", "password", "email", "number", "checkbox", "radio", "select", "textarea", "other"];
    if (inputType && validTypes.includes(inputType)) {
      return inputType as "text" | "password" | "email" | "number" | "checkbox" | "radio" | "select" | "textarea" | "other";
    }
    return "other";
  }

  private mapScrollDirection(direction: string | undefined): "up" | "down" | "left" | "right" {
    if (direction === "up" || direction === "down" || direction === "left" || direction === "right") {
      return direction;
    }
    return "down";
  }

  private generateId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export class UserEventCaptureError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "UserEventCaptureError";
    this.cause = cause;
  }
}

export const createUserEventCapture = (config?: UserEventCaptureConfig): UserEventCapture => {
  return new UserEventCapture(config);
};
