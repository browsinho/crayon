import type { Screenshot } from "@crayon/types";
import * as fs from "fs";
import * as path from "path";

export interface CDPSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: (params: unknown) => void): void;
  off(event: string, handler: (params: unknown) => void): void;
}

interface CDPCaptureScreenshotResult {
  data: string;
}

interface CDPLayoutMetrics {
  visualViewport: {
    clientWidth: number;
    clientHeight: number;
  };
}

export interface ScreenshotCaptureConfig {
  outputDir?: string;
}

const DEFAULT_CONFIG: Required<ScreenshotCaptureConfig> = {
  outputDir: "./screenshots",
};

export class ScreenshotCapture {
  private cdpSession: CDPSession | null = null;
  private screenshots: Screenshot[] = [];
  private config: Required<ScreenshotCaptureConfig>;
  private isAttached: boolean = false;

  constructor(config: ScreenshotCaptureConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  attach(cdpSession: CDPSession): void {
    if (this.isAttached) {
      throw new ScreenshotCaptureError("Already attached to a CDP session");
    }

    this.cdpSession = cdpSession;
    this.isAttached = true;
    this.screenshots = [];
  }

  stop(): void {
    if (!this.isAttached || !this.cdpSession) {
      return;
    }

    this.isAttached = false;
    this.cdpSession = null;
  }

  async capture(domSnapshotId: string): Promise<Screenshot> {
    if (!this.cdpSession || !this.isAttached) {
      throw new ScreenshotCaptureError("Not attached to a CDP session");
    }

    try {
      const viewport = await this.getViewport();

      const result = (await this.cdpSession.send("Page.captureScreenshot", {
        format: "png",
      })) as CDPCaptureScreenshotResult;

      const buffer = Buffer.from(result.data, "base64");

      if (!this.isValidPNG(buffer)) {
        throw new ScreenshotCaptureError("Invalid PNG data received from CDP");
      }

      const screenshotId = this.generateId();
      const filename = `${screenshotId}.png`;
      const filePath = path.join(this.config.outputDir, filename);

      await this.ensureOutputDir();
      fs.writeFileSync(filePath, buffer);

      const screenshot: Screenshot = {
        id: screenshotId,
        domSnapshotId,
        timestamp: Date.now(),
        path: filePath,
        width: viewport.width,
        height: viewport.height,
      };

      this.screenshots.push(screenshot);

      return screenshot;
    } catch (error) {
      if (error instanceof ScreenshotCaptureError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new ScreenshotCaptureError(
        `Failed to capture screenshot: ${message}`,
        error
      );
    }
  }

  getScreenshots(): Screenshot[] {
    return [...this.screenshots];
  }

  private async getViewport(): Promise<{ width: number; height: number }> {
    if (!this.cdpSession) {
      return { width: 1280, height: 720 };
    }

    try {
      const metrics = (await this.cdpSession.send(
        "Page.getLayoutMetrics"
      )) as CDPLayoutMetrics;
      return {
        width: metrics.visualViewport.clientWidth,
        height: metrics.visualViewport.clientHeight,
      };
    } catch {
      return { width: 1280, height: 720 };
    }
  }

  private isValidPNG(buffer: Buffer): boolean {
    if (buffer.length < 8) {
      return false;
    }
    // PNG signature: 137 80 78 71 13 10 26 10
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) {
      if (buffer[i] !== pngSignature[i]) {
        return false;
      }
    }
    return true;
  }

  private async ensureOutputDir(): Promise<void> {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  private generateId(): string {
    return `screenshot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export class ScreenshotCaptureError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ScreenshotCaptureError";
    this.cause = cause;
  }
}

export const createScreenshotCapture = (
  config?: ScreenshotCaptureConfig
): ScreenshotCapture => {
  return new ScreenshotCapture(config);
};
