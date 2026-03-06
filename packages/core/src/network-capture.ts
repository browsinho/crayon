import type { NetworkCall } from "@crayon/types";
import { EventEmitter } from "events";

export interface CDPSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: (params: unknown) => void): void;
  off(event: string, handler: (params: unknown) => void): void;
}

export interface NetworkCaptureConfig {
  maxBodySize?: number;
  includePatterns?: RegExp[];
  excludePatterns?: RegExp[];
}

interface CDPRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
}

interface CDPResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  mimeType: string;
}

interface CDPRequestWillBeSentParams {
  requestId: string;
  request: CDPRequest;
  timestamp: number;
  type?: string;
}

interface CDPResponseReceivedParams {
  requestId: string;
  response: CDPResponse;
  timestamp: number;
  type?: string;
}

interface CDPLoadingFinishedParams {
  requestId: string;
  encodedDataLength: number;
}

interface CDPLoadingFailedParams {
  requestId: string;
  errorText: string;
}

interface CDPGetResponseBodyResult {
  body: string;
  base64Encoded: boolean;
}

interface PendingRequest {
  id: string;
  timestamp: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  responseReceived: boolean;
  response?: {
    status: number;
    headers: Record<string, string>;
    contentType: string;
  };
  encodedDataLength?: number;
}

const DEFAULT_CONFIG: Required<NetworkCaptureConfig> = {
  maxBodySize: 5 * 1024 * 1024, // 5MB
  includePatterns: [
    /\/api\//i,
    /\.json(\?|$)/i,
    /\/graphql/i,
  ],
  excludePatterns: [
    /\.(png|jpg|jpeg|gif|webp|svg|ico)(\?|$)/i,
    /\.(woff|woff2|ttf|eot|otf)(\?|$)/i,
    /\.(css)(\?|$)/i,
    /\/analytics\//i,
    /google-analytics\.com/i,
    /googletagmanager\.com/i,
    /facebook\.net/i,
    /twitter\.com\/i/i,
    /doubleclick\.net/i,
  ],
};

export class NetworkCapture extends EventEmitter {
  private cdpSession: CDPSession | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private completedCalls: NetworkCall[] = [];
  private config: Required<NetworkCaptureConfig>;
  private isAttached: boolean = false;

  private boundHandlers = {
    requestWillBeSent: this.handleRequestWillBeSent.bind(this),
    responseReceived: this.handleResponseReceived.bind(this),
    loadingFinished: this.handleLoadingFinished.bind(this),
    loadingFailed: this.handleLoadingFailed.bind(this),
  };

  constructor(config: NetworkCaptureConfig = {}) {
    super();
    this.config = {
      maxBodySize: config.maxBodySize ?? DEFAULT_CONFIG.maxBodySize,
      includePatterns: config.includePatterns ?? DEFAULT_CONFIG.includePatterns,
      excludePatterns: config.excludePatterns ?? DEFAULT_CONFIG.excludePatterns,
    };
  }

  async attach(cdpSession: CDPSession): Promise<void> {
    if (this.isAttached) {
      throw new NetworkCaptureError("Already attached to a CDP session");
    }

    this.cdpSession = cdpSession;
    this.isAttached = true;
    this.pendingRequests.clear();
    this.completedCalls = [];

    await this.cdpSession.send("Network.enable", {
      maxPostDataSize: this.config.maxBodySize,
    });

    this.cdpSession.on("Network.requestWillBeSent", this.boundHandlers.requestWillBeSent);
    this.cdpSession.on("Network.responseReceived", this.boundHandlers.responseReceived);
    this.cdpSession.on("Network.loadingFinished", this.boundHandlers.loadingFinished);
    this.cdpSession.on("Network.loadingFailed", this.boundHandlers.loadingFailed);
  }

  stop(): void {
    if (!this.isAttached || !this.cdpSession) {
      return;
    }

    this.cdpSession.off("Network.requestWillBeSent", this.boundHandlers.requestWillBeSent);
    this.cdpSession.off("Network.responseReceived", this.boundHandlers.responseReceived);
    this.cdpSession.off("Network.loadingFinished", this.boundHandlers.loadingFinished);
    this.cdpSession.off("Network.loadingFailed", this.boundHandlers.loadingFailed);

    this.isAttached = false;
    this.cdpSession = null;
  }

  getCalls(): NetworkCall[] {
    return [...this.completedCalls];
  }

  private shouldCaptureUrl(url: string): boolean {
    for (const pattern of this.config.excludePatterns) {
      if (pattern.test(url)) {
        return false;
      }
    }

    for (const pattern of this.config.includePatterns) {
      if (pattern.test(url)) {
        return true;
      }
    }

    return false;
  }

  private handleRequestWillBeSent(params: unknown): void {
    const typedParams = params as CDPRequestWillBeSentParams;
    const { requestId, request, timestamp } = typedParams;

    if (!this.shouldCaptureUrl(request.url)) {
      return;
    }

    const pendingRequest: PendingRequest = {
      id: requestId,
      timestamp: timestamp * 1000,
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.postData,
      },
      responseReceived: false,
    };

    this.pendingRequests.set(requestId, pendingRequest);

    // Emit request event for correlation
    this.emit("request", requestId, timestamp * 1000);
  }

  private handleResponseReceived(params: unknown): void {
    const typedParams = params as CDPResponseReceivedParams;
    const { requestId, response } = typedParams;

    const pendingRequest = this.pendingRequests.get(requestId);
    if (!pendingRequest) {
      return;
    }

    pendingRequest.responseReceived = true;
    pendingRequest.response = {
      status: response.status,
      headers: response.headers,
      contentType: response.mimeType || "application/octet-stream",
    };
  }

  private handleLoadingFinished(params: unknown): void {
    const typedParams = params as CDPLoadingFinishedParams;
    const { requestId, encodedDataLength } = typedParams;

    const pendingRequest = this.pendingRequests.get(requestId);
    if (!pendingRequest || !pendingRequest.responseReceived || !pendingRequest.response) {
      this.pendingRequests.delete(requestId);
      return;
    }

    pendingRequest.encodedDataLength = encodedDataLength;

    void this.completeRequest(pendingRequest);
  }

  private handleLoadingFailed(params: unknown): void {
    const typedParams = params as CDPLoadingFailedParams;
    const { requestId } = typedParams;

    this.pendingRequests.delete(requestId);
  }

  private async completeRequest(pendingRequest: PendingRequest): Promise<void> {
    const { id, timestamp, request, response, encodedDataLength } = pendingRequest;

    if (!response) {
      this.pendingRequests.delete(id);
      return;
    }

    let responseBody: string | undefined;

    if (encodedDataLength !== undefined && encodedDataLength <= this.config.maxBodySize) {
      responseBody = await this.getResponseBody(id);
    }

    const networkCall: NetworkCall = {
      id: this.generateId(),
      timestamp,
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
      },
      response: {
        status: response.status,
        headers: response.headers,
        body: responseBody,
        contentType: response.contentType,
      },
    };

    this.completedCalls.push(networkCall);
    this.pendingRequests.delete(id);
  }

  private async getResponseBody(requestId: string): Promise<string | undefined> {
    if (!this.cdpSession) {
      return undefined;
    }

    try {
      const result = await this.cdpSession.send("Network.getResponseBody", {
        requestId,
      }) as CDPGetResponseBodyResult;

      if (result.base64Encoded) {
        return Buffer.from(result.body, "base64").toString("utf-8");
      }

      return result.body;
    } catch {
      return undefined;
    }
  }

  private generateId(): string {
    return `net-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export class NetworkCaptureError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkCaptureError";
    this.cause = cause;
  }
}

export const createNetworkCapture = (config?: NetworkCaptureConfig): NetworkCapture => {
  return new NetworkCapture(config);
};
