import AnchorClient from "anchorbrowser";
import type { BrowserSession, BrowserSessionStatus } from "@crayon/types";
import type { CDPSession } from "./dom-capture.js";

export interface BrowserSessionConfig {
  apiKey: string;
  recording?: boolean;
  proxy?: {
    active: boolean;
    type?: "anchor_residential" | "anchor_datacenter";
    countryCode?: string;
  };
  timeout?: {
    maxDuration?: number;
    idleTimeout?: number;
  };
}

interface SessionState {
  id: string;
  status: BrowserSessionStatus;
  cdpUrl: string;
  liveViewUrl?: string;
}

export class BrowserSessionManager {
  private client: AnchorClient;
  private sessions: Map<string, SessionState> = new Map();

  constructor(config: BrowserSessionConfig) {
    this.client = new AnchorClient({
      apiKey: config.apiKey,
    });
  }

  async createSession(options?: {
    initialUrl?: string;
    recording?: boolean;
    proxy?: {
      active: boolean;
      type?: "anchor_residential" | "anchor_datacenter";
      countryCode?: string;
    };
    timeout?: {
      maxDuration?: number;
      idleTimeout?: number;
    };
  }): Promise<BrowserSession> {
    try {
      // Always enable headful mode for live view support
      const sessionConfig: Record<string, unknown> = {
        browser: {
          headless: { active: false },
        },
      };

      if (options) {
        const sessionOptions: Record<string, unknown> = {};

        if (options.initialUrl !== undefined) {
          sessionOptions.initial_url = options.initialUrl;
        }

        if (options.recording !== undefined) {
          sessionOptions.recording = { active: options.recording };
        }

        if (options.proxy) {
          sessionOptions.proxy = {
            active: options.proxy.active,
            ...(options.proxy.type && { type: options.proxy.type }),
            ...(options.proxy.countryCode && {
              country_code: options.proxy.countryCode,
            }),
          };
        }

        if (options.timeout) {
          sessionOptions.timeout = {
            ...(options.timeout.maxDuration !== undefined && {
              max_duration: options.timeout.maxDuration,
            }),
            ...(options.timeout.idleTimeout !== undefined && {
              idle_timeout: options.timeout.idleTimeout,
            }),
          };
        }

        if (Object.keys(sessionOptions).length > 0) {
          sessionConfig.session = sessionOptions;
        }
      }

      const response = await this.client.sessions.create(
        Object.keys(sessionConfig).length > 0 ? sessionConfig : undefined
      );

      const sessionData = response.data;
      if (!sessionData || !sessionData.id || !sessionData.cdp_url) {
        throw new Error("Invalid session response from API");
      }

      const session: SessionState = {
        id: sessionData.id,
        status: "active",
        cdpUrl: sessionData.cdp_url,
        liveViewUrl: sessionData.live_view_url,
      };

      this.sessions.set(session.id, session);

      return {
        id: session.id,
        status: session.status,
        cdpUrl: session.cdpUrl,
        liveViewUrl: session.liveViewUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new BrowserSessionError(
        `Failed to create session: ${errorMessage}`,
        error
      );
    }
  }

  async navigate(sessionId: string, url: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new BrowserSessionError(`Session not found: ${sessionId}`);
    }

    if (session.status !== "active") {
      throw new BrowserSessionError(
        `Session is not active: ${sessionId} (status: ${session.status})`
      );
    }

    try {
      const browser = await this.client.browser.connect(sessionId);
      const contexts = browser.contexts();
      const context = contexts[0];
      if (!context) {
        throw new Error("No browser context available");
      }

      const pages = context.pages();
      let page = pages[0];
      if (!page) {
        page = await context.newPage();
      }

      await page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (error) {
      session.status = "error";
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new BrowserSessionError(
        `Failed to navigate: ${errorMessage}`,
        error
      );
    }
  }

  /**
   * Get a CDP session for the given browser session.
   * This allows direct Chrome DevTools Protocol access for DOM/network capture.
   */
  async getCDPSession(sessionId: string): Promise<CDPSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new BrowserSessionError(`Session not found: ${sessionId}`);
    }

    if (session.status !== "active") {
      throw new BrowserSessionError(
        `Session is not active: ${sessionId} (status: ${session.status})`
      );
    }

    try {
      const browser = await this.client.browser.connect(sessionId);
      const contexts = browser.contexts();
      const context = contexts[0];
      if (!context) {
        throw new Error("No browser context available");
      }

      const pages = context.pages();
      let page = pages[0];
      // Create a page if one doesn't exist yet (needed before navigation)
      if (!page) {
        page = await context.newPage();
      }

      // Get CDP session from the page's browser context
      const cdpSession = await context.newCDPSession(page);
      return cdpSession as unknown as CDPSession;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new BrowserSessionError(
        `Failed to get CDP session: ${errorMessage}`,
        error
      );
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new BrowserSessionError(`Session not found: ${sessionId}`);
    }

    try {
      await this.client.sessions.delete(sessionId);
      session.status = "stopped";
      this.sessions.delete(sessionId);
    } catch (error) {
      session.status = "error";
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new BrowserSessionError(
        `Failed to close session: ${errorMessage}`,
        error
      );
    }
  }

  getSession(sessionId: string): BrowserSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    return {
      id: session.id,
      status: session.status,
      cdpUrl: session.cdpUrl,
      liveViewUrl: session.liveViewUrl,
    };
  }

  async closeAllSessions(): Promise<void> {
    const errors: Error[] = [];

    for (const sessionId of this.sessions.keys()) {
      try {
        await this.closeSession(sessionId);
      } catch (error) {
        errors.push(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    if (errors.length > 0) {
      throw new BrowserSessionError(
        `Failed to close ${errors.length} session(s)`,
        errors
      );
    }
  }
}

export class BrowserSessionError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "BrowserSessionError";
    this.cause = cause;
  }
}

export const createSession = async (
  config: BrowserSessionConfig,
  options?: Parameters<BrowserSessionManager["createSession"]>[0]
): Promise<{ manager: BrowserSessionManager; session: BrowserSession }> => {
  const manager = new BrowserSessionManager(config);
  const session = await manager.createSession(options);
  return { manager, session };
};
