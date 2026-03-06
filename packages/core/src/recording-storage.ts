import type {
  DOMSnapshot,
  NetworkCall,
  Recording,
  RecordingMetadata,
  Screenshot,
} from "@crayon/types";
import * as fs from "fs";
import * as path from "path";

export interface RecordingStorageConfig {
  baseDir?: string;
}

const DEFAULT_CONFIG: Required<RecordingStorageConfig> = {
  baseDir: "./recordings",
};

export class RecordingStorage {
  private config: Required<RecordingStorageConfig>;
  private counters: Map<string, { dom: number; network: number; screenshot: number }> = new Map();

  constructor(config: RecordingStorageConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async create(id: string, startUrl: string): Promise<void> {
    const recordingDir = this.getRecordingDir(id);

    if (fs.existsSync(recordingDir)) {
      throw new RecordingStorageError(`Recording directory already exists: ${id}`);
    }

    fs.mkdirSync(recordingDir, { recursive: true });
    fs.mkdirSync(path.join(recordingDir, "dom"), { recursive: true });
    fs.mkdirSync(path.join(recordingDir, "network"), { recursive: true });
    fs.mkdirSync(path.join(recordingDir, "screenshots"), { recursive: true });

    const metadata: RecordingMetadata = {
      id,
      createdAt: new Date().toISOString(),
      startUrl,
      status: "recording",
      stats: {
        domSnapshots: 0,
        networkCalls: 0,
        screenshots: 0,
      },
    };

    this.counters.set(id, { dom: 0, network: 0, screenshot: 0 });
    await this.saveMetadata(id, metadata);
  }

  async saveDomSnapshot(id: string, snapshot: DOMSnapshot): Promise<void> {
    await this.ensureRecordingExists(id);

    const counter = this.getCounter(id);
    counter.dom++;

    const filename = this.formatFilename(counter.dom, "json");
    const filePath = path.join(this.getRecordingDir(id), "dom", filename);

    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
    await this.updateStats(id);
  }

  async saveNetworkCall(id: string, call: NetworkCall): Promise<void> {
    await this.ensureRecordingExists(id);

    const counter = this.getCounter(id);
    counter.network++;

    const filename = this.formatFilename(counter.network, "json");
    const filePath = path.join(this.getRecordingDir(id), "network", filename);

    fs.writeFileSync(filePath, JSON.stringify(call, null, 2));
    await this.updateStats(id);
  }

  async saveScreenshot(
    id: string,
    screenshot: Buffer,
    meta: Screenshot
  ): Promise<void> {
    await this.ensureRecordingExists(id);

    const counter = this.getCounter(id);
    counter.screenshot++;

    const filename = this.formatFilename(counter.screenshot, "png");
    const filePath = path.join(this.getRecordingDir(id), "screenshots", filename);

    fs.writeFileSync(filePath, screenshot);

    const metaFilename = this.formatFilename(counter.screenshot, "json");
    const metaPath = path.join(this.getRecordingDir(id), "screenshots", metaFilename);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    await this.updateStats(id);
  }

  async finalize(id: string): Promise<RecordingMetadata> {
    await this.ensureRecordingExists(id);

    const metadata = await this.loadMetadata(id);
    metadata.status = "completed";

    await this.saveMetadata(id, metadata);
    return metadata;
  }

  async load(id: string): Promise<Recording> {
    await this.ensureRecordingExists(id);

    const metadata = await this.loadMetadata(id);
    const domSnapshots = await this.loadDomSnapshots(id);
    const networkCalls = await this.loadNetworkCalls(id);
    const screenshots = await this.loadScreenshots(id);

    return {
      metadata,
      domSnapshots,
      networkCalls,
      screenshots,
    };
  }

  private getRecordingDir(id: string): string {
    return path.join(this.config.baseDir, id);
  }

  private getMetadataPath(id: string): string {
    return path.join(this.getRecordingDir(id), "metadata.json");
  }

  private async ensureRecordingExists(id: string): Promise<void> {
    const recordingDir = this.getRecordingDir(id);
    if (!fs.existsSync(recordingDir)) {
      throw new RecordingStorageError(`Recording not found: ${id}`);
    }
  }

  private getCounter(id: string): { dom: number; network: number; screenshot: number } {
    let counter = this.counters.get(id);
    if (!counter) {
      counter = { dom: 0, network: 0, screenshot: 0 };
      this.counters.set(id, counter);
    }
    return counter;
  }

  private formatFilename(count: number, extension: string): string {
    return `${count.toString().padStart(5, "0")}.${extension}`;
  }

  private async saveMetadata(id: string, metadata: RecordingMetadata): Promise<void> {
    const metadataPath = this.getMetadataPath(id);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async loadMetadata(id: string): Promise<RecordingMetadata> {
    const metadataPath = this.getMetadataPath(id);
    if (!fs.existsSync(metadataPath)) {
      throw new RecordingStorageError(`Metadata not found for recording: ${id}`);
    }
    const content = fs.readFileSync(metadataPath, "utf-8");
    return JSON.parse(content) as RecordingMetadata;
  }

  private async updateStats(id: string): Promise<void> {
    const metadata = await this.loadMetadata(id);
    const counter = this.getCounter(id);

    metadata.stats = {
      domSnapshots: counter.dom,
      networkCalls: counter.network,
      screenshots: counter.screenshot,
    };

    await this.saveMetadata(id, metadata);
  }

  private async loadDomSnapshots(id: string): Promise<DOMSnapshot[]> {
    const domDir = path.join(this.getRecordingDir(id), "dom");
    return this.loadJsonFiles<DOMSnapshot>(domDir);
  }

  private async loadNetworkCalls(id: string): Promise<NetworkCall[]> {
    const networkDir = path.join(this.getRecordingDir(id), "network");
    return this.loadJsonFiles<NetworkCall>(networkDir);
  }

  private async loadScreenshots(id: string): Promise<Screenshot[]> {
    const screenshotsDir = path.join(this.getRecordingDir(id), "screenshots");
    const files = fs.existsSync(screenshotsDir)
      ? fs.readdirSync(screenshotsDir).filter((f) => f.endsWith(".json")).sort()
      : [];

    return files.map((file) => {
      const content = fs.readFileSync(path.join(screenshotsDir, file), "utf-8");
      return JSON.parse(content) as Screenshot;
    });
  }

  private loadJsonFiles<T>(dir: string): T[] {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    return files.map((file) => {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      return JSON.parse(content) as T;
    });
  }
}

export class RecordingStorageError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RecordingStorageError";
    this.cause = cause;
  }
}

export const createRecordingStorage = (
  config?: RecordingStorageConfig
): RecordingStorage => {
  return new RecordingStorage(config);
};
