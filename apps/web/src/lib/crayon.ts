import * as crypto from "crypto";
import type {
  Project,
  ProjectListFilters,
  ProjectSort,
  CreateProjectData,
  UpdateProjectData,
  Recording,
  RecordingV2,
  Sandbox,
  UserEvent,
  CorrelatedEventGroup,
  Page,
} from "@crayon/types";

export interface CrayonServiceConfig {
  projectsDir?: string;
  recordingsDir?: string;
}

const DEFAULT_CONFIG: Required<CrayonServiceConfig> = {
  projectsDir: process.env.CRAYON_PROJECTS_DIR ?? "./data/projects",
  recordingsDir: process.env.CRAYON_RECORDINGS_DIR ?? "./data/recordings",
};

// Dynamic import helpers to avoid bundling native modules
async function getProjectStorage(baseDir: string) {
  const { createProjectStorage } = await import("@crayon/core");
  return createProjectStorage({ baseDir });
}

async function getRecordingStorage(baseDir: string) {
  const { createRecordingStorage } = await import("@crayon/core");
  return createRecordingStorage({ baseDir });
}

async function createBrowserSession() {
  const { createSession } = await import("@crayon/core");
  const apiKey = process.env.ANCHOR_BROWSER_API_KEY ?? "";
  return createSession({ apiKey });
}

async function getSandboxManager() {
  const { createSandboxManager } = await import("@crayon/core");
  return createSandboxManager();
}

async function createDOMCaptureInstance() {
  const { createDOMCapture } = await import("@crayon/core");
  return createDOMCapture();
}

async function createNetworkCaptureInstance() {
  const { createNetworkCapture } = await import("@crayon/core");
  return createNetworkCapture();
}

async function createScreenshotCaptureInstance() {
  const { createScreenshotCapture } = await import("@crayon/core");
  return createScreenshotCapture();
}

async function createUserEventCaptureInstance() {
  const { createUserEventCapture } = await import("@crayon/core");
  return createUserEventCapture();
}

async function createEventCorrelatorInstance() {
  const { createEventCorrelator } = await import("@crayon/core");
  return createEventCorrelator();
}

async function createPageDetectorInstance() {
  const { createPageDetector } = await import("@crayon/core");
  return createPageDetector();
}

async function getDetectPagesFromSnapshots() {
  const { detectPagesFromSnapshots } = await import("@crayon/core");
  return detectPagesFromSnapshots;
}

// We use a type-only import for the manager types
type ProjectStorage = Awaited<ReturnType<typeof getProjectStorage>>;
type RecordingStorage = Awaited<ReturnType<typeof getRecordingStorage>>;
type BrowserSessionResult = Awaited<ReturnType<typeof createBrowserSession>>;
type SandboxManagerType = Awaited<ReturnType<typeof getSandboxManager>>;
type DOMCaptureType = Awaited<ReturnType<typeof createDOMCaptureInstance>>;
type NetworkCaptureType = Awaited<ReturnType<typeof createNetworkCaptureInstance>>;
type ScreenshotCaptureType = Awaited<ReturnType<typeof createScreenshotCaptureInstance>>;
type UserEventCaptureType = Awaited<ReturnType<typeof createUserEventCaptureInstance>>;
type EventCorrelatorType = Awaited<ReturnType<typeof createEventCorrelatorInstance>>;
type PageDetectorType = Awaited<ReturnType<typeof createPageDetectorInstance>>;

interface ActiveSession {
  manager: BrowserSessionResult["manager"];
  sessionId: string;
  liveViewUrl: string;
  projectId: string;
  startUrl: string;
  startTime: number;
  // Capture instances for recording DOM, network, and screenshots
  domCapture?: DOMCaptureType;
  networkCapture?: NetworkCaptureType;
  screenshotCapture?: ScreenshotCaptureType;
  // Multi-page recording modules
  userEventCapture?: UserEventCaptureType;
  eventCorrelator?: EventCorrelatorType;
  pageDetector?: PageDetectorType;
}

export class CrayonService {
  private config: Required<CrayonServiceConfig>;
  private projectStorage: ProjectStorage | null = null;
  private recordingStorage: RecordingStorage | null = null;
  private activeSessions: Map<string, ActiveSession> = new Map();
  private sandboxManager: SandboxManagerType | null = null;
  private eventListeners: Map<string, Set<(event: unknown) => void>> = new Map();

  constructor(config: CrayonServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async getProjectStorageInstance(): Promise<ProjectStorage> {
    if (!this.projectStorage) {
      this.projectStorage = await getProjectStorage(this.config.projectsDir);
    }
    return this.projectStorage;
  }

  private async getRecordingStorageInstance(): Promise<RecordingStorage> {
    if (!this.recordingStorage) {
      this.recordingStorage = await getRecordingStorage(this.config.recordingsDir);
    }
    return this.recordingStorage;
  }

  // Project operations
  async listProjects(
    filters?: ProjectListFilters,
    sort?: ProjectSort
  ): Promise<Project[]> {
    const storage = await this.getProjectStorageInstance();
    return storage.list(filters, sort);
  }

  async getProject(id: string): Promise<Project | null> {
    const storage = await this.getProjectStorageInstance();
    return storage.get(id);
  }

  async createProject(data: CreateProjectData): Promise<Project> {
    const storage = await this.getProjectStorageInstance();
    return storage.create(data);
  }

  async updateProject(id: string, data: UpdateProjectData): Promise<Project> {
    const storage = await this.getProjectStorageInstance();
    return storage.update(id, data);
  }

  async deleteProject(id: string): Promise<void> {
    // Clean up any active sessions or sandboxes
    const activeSession = this.activeSessions.get(id);
    if (activeSession) {
      await activeSession.manager.closeSession(activeSession.sessionId);
      this.activeSessions.delete(id);
    }

    // Try to stop sandbox if it exists
    try {
      await this.stopSandbox(id);
    } catch {
      // Sandbox might not exist, which is fine
    }

    const storage = await this.getProjectStorageInstance();
    return storage.delete(id);
  }

  // Recording operations
  async getRecording(projectId: string): Promise<Recording | null> {
    const storage = await this.getProjectStorageInstance();
    return storage.getRecording(projectId);
  }

  async startRecording(
    projectId: string,
    url: string
  ): Promise<{ sessionId: string; liveViewUrl: string }> {
    const storage = await this.getProjectStorageInstance();
    const project = await storage.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const result = await createBrowserSession();
    const manager = result.manager;
    const browserSessionId = result.session.id;
    const internalSessionId = `${projectId}-${Date.now()}`;

    // Use the live view URL from the API response, with fallback for safety
    const liveViewUrl = result.session.liveViewUrl
      ?? `https://live.anchorbrowser.io?sessionId=${browserSessionId}`;

    // Create capture instances (existing)
    const domCapture = await createDOMCaptureInstance();
    const networkCapture = await createNetworkCaptureInstance();
    const screenshotCapture = await createScreenshotCaptureInstance();
    
    // Create multi-page recording modules (NEW)
    const userEventCapture = await createUserEventCaptureInstance();
    const eventCorrelator = await createEventCorrelatorInstance();
    const pageDetector = await createPageDetectorInstance();

    // IMPORTANT: Attach captures BEFORE navigation to capture page load events
    try {
      const cdpSession = await manager.getCDPSession(browserSessionId);
      
      // Attach existing captures
      await domCapture.attach(cdpSession);
      await networkCapture.attach(cdpSession);
      screenshotCapture.attach(cdpSession);
      
      // Attach user event capture (captures clicks, inputs, scrolls, etc.)
      await userEventCapture.attach(cdpSession);
      
      // Wire up the multi-page event pipeline:
      // UserEventCapture -> EventCorrelator -> PageDetector
      // PageDetector also listens directly to DOMCapture snapshots and SPA navigation events
      eventCorrelator.attachCaptures(userEventCapture, domCapture, networkCapture);
      pageDetector.attachCaptures(eventCorrelator, domCapture, userEventCapture);
    } catch {
      // Continue without captures - live view will still work
    }

    // Navigate AFTER captures are attached
    await manager.navigate(browserSessionId, url);
    
    // Wait for page to fully load by listening for snapshot event with correct URL
    // The DOMCapture emits 'snapshot' on Page.loadEventFired
    await new Promise<void>((resolve) => {
      const checkSnapshot = () => {
        const snapshot = domCapture.getLatestSnapshot();
        if (snapshot && snapshot.url && !snapshot.url.includes('about:blank')) {
          pageDetector.initializeFirstPage(snapshot);
          resolve();
          return true;
        }
        return false;
      };
      
      // Check immediately
      if (checkSnapshot()) return;
      
      // Listen for snapshot events
      const onSnapshot = () => {
        if (checkSnapshot()) {
          domCapture.off("snapshot", onSnapshot);
        }
      };
      domCapture.on("snapshot", onSnapshot);
      
      // Timeout after 5 seconds - initialize with whatever we have
      setTimeout(() => {
        domCapture.off("snapshot", onSnapshot);
        const snapshot = domCapture.getLatestSnapshot();
        if (snapshot && !pageDetector.getCurrentPage()) {
          pageDetector.initializeFirstPage(snapshot);
        }
        resolve();
      }, 5000);
    });

    this.activeSessions.set(internalSessionId, {
      manager,
      sessionId: browserSessionId,
      liveViewUrl,
      projectId,
      startUrl: url,
      startTime: Date.now(),
      domCapture,
      networkCapture,
      screenshotCapture,
      userEventCapture,
      eventCorrelator,
      pageDetector,
    });

    return { sessionId: internalSessionId, liveViewUrl };
  }

  async stopRecording(internalSessionId: string): Promise<{
    startUrl: string;
    startTime: number;
    domSnapshots: ReturnType<DOMCaptureType["getSnapshots"]>;
    networkCalls: ReturnType<NetworkCaptureType["getCalls"]>;
    screenshots: ReturnType<ScreenshotCaptureType["getScreenshots"]>;
    userEvents: UserEvent[];
    correlatedGroups: CorrelatedEventGroup[];
    pages: Page[];
  } | null> {
    const activeSession = this.activeSessions.get(internalSessionId);
    if (!activeSession) {
      return null;
    }

    const { 
      startUrl, startTime, 
      domCapture, networkCapture, screenshotCapture,
      userEventCapture, eventCorrelator, pageDetector 
    } = activeSession;

    // Finalize page detector before stopping captures
    if (pageDetector) {
      pageDetector.finalize();
    }

    // Stop captures and collect data
    let domSnapshots: ReturnType<DOMCaptureType["getSnapshots"]> = [];
    let networkCalls: ReturnType<NetworkCaptureType["getCalls"]> = [];
    let screenshots: ReturnType<ScreenshotCaptureType["getScreenshots"]> = [];
    let userEvents: UserEvent[] = [];
    let correlatedGroups: CorrelatedEventGroup[] = [];
    let pages: Page[] = [];

    if (domCapture) {
      domCapture.stop();
      domSnapshots = domCapture.getSnapshots();
    }

    if (networkCapture) {
      networkCapture.stop();
      networkCalls = networkCapture.getCalls();
    }

    if (screenshotCapture) {
      screenshotCapture.stop();
      screenshots = screenshotCapture.getScreenshots();
    }

    // Collect multi-page data
    if (userEventCapture) {
      userEventCapture.stop();
      userEvents = userEventCapture.getEvents();
    }

    if (eventCorrelator) {
      eventCorrelator.detach();
      correlatedGroups = eventCorrelator.getGroups();
    }

    if (pageDetector) {
      pageDetector.detach();
      pages = pageDetector.getPages();
    }

    // Post-processing: Enhance/validate real-time detected pages with snapshot analysis
    // This catches any pages that were missed during real-time detection
    try {
      const detectPagesFromSnapshots = await getDetectPagesFromSnapshots();
      pages = detectPagesFromSnapshots(domSnapshots, pages);
    } catch {
      // Post-processing failed, continue with real-time pages
    }

    await activeSession.manager.closeSession(activeSession.sessionId);
    this.activeSessions.delete(internalSessionId);
    this.eventListeners.delete(internalSessionId);

    return { startUrl, startTime, domSnapshots, networkCalls, screenshots, userEvents, correlatedGroups, pages };
  }

  async saveRecordingForProject(
    projectId: string,
    options?: {
      startUrl?: string;
      startTime?: number;
      domSnapshots?: Recording["domSnapshots"];
      networkCalls?: Recording["networkCalls"];
      screenshots?: Recording["screenshots"];
      userEvents?: UserEvent[];
      correlatedGroups?: CorrelatedEventGroup[];
      pages?: Page[];
    }
  ): Promise<Recording | RecordingV2> {
    const storage = await this.getProjectStorageInstance();
    const project = await storage.get(projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const domSnapshots = options?.domSnapshots ?? [];
    const networkCalls = options?.networkCalls ?? [];
    const screenshots = options?.screenshots ?? [];
    const userEvents = options?.userEvents ?? [];
    const correlatedGroups = options?.correlatedGroups ?? [];
    const pages = options?.pages ?? [];

    // Use V2 format if we have multi-page data
    const hasMultiPageData = userEvents.length > 0 || pages.length > 0;

    if (hasMultiPageData) {
      const recordingV2: RecordingV2 = {
        metadata: {
          id: crypto.randomUUID(),
          createdAt: new Date(options?.startTime ?? Date.now()).toISOString(),
          startUrl: options?.startUrl ?? project.sourceUrl ?? "",
          status: "completed",
          version: 2,
          stats: {
            domSnapshots: domSnapshots.length,
            networkCalls: networkCalls.length,
            screenshots: screenshots.length,
            userEvents: userEvents.length,
            pages: pages.length,
          },
        },
        domSnapshots,
        networkCalls,
        screenshots,
        userEvents,
        correlatedGroups,
        pages,
      };

      await storage.saveRecording(projectId, recordingV2 as unknown as Recording);
      return recordingV2;
    }

    // Fall back to V1 format for backward compatibility
    const recording: Recording = {
      metadata: {
        id: crypto.randomUUID(),
        createdAt: new Date(options?.startTime ?? Date.now()).toISOString(),
        startUrl: options?.startUrl ?? project.sourceUrl ?? "",
        status: "completed",
        stats: {
          domSnapshots: domSnapshots.length,
          networkCalls: networkCalls.length,
          screenshots: screenshots.length,
        },
      },
      domSnapshots,
      networkCalls,
      screenshots,
    };

    await storage.saveRecording(projectId, recording);
    return recording;
  }

  onRecordingEvent(sessionId: string, callback: (event: unknown) => void): void {
    let listeners = this.eventListeners.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(sessionId, listeners);
    }
    listeners.add(callback);
  }

  offRecordingEvent(sessionId: string, callback: (event: unknown) => void): void {
    const listeners = this.eventListeners.get(sessionId);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private async getSandboxManagerInstance(): Promise<SandboxManagerType> {
    if (!this.sandboxManager) {
      this.sandboxManager = await getSandboxManager();
    }
    return this.sandboxManager;
  }

  // Sandbox operations
  async getSandbox(projectId: string): Promise<Sandbox | null> {
    try {
      const manager = await this.getSandboxManagerInstance();
      const status = await manager.getStatus(projectId);
      return status;
    } catch (error) {
      if (error instanceof Error && 'code' in error &&
          (error as { code: string }).code === "DOCKER_UNAVAILABLE") {
        throw error;
      }
      return null;
    }
  }

  async startSandbox(projectId: string): Promise<Sandbox> {
    const storage = await this.getProjectStorageInstance();
    const project = await storage.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const manager = await this.getSandboxManagerInstance();
    const sandbox = await manager.start(projectId);
    return sandbox;
  }

  async stopSandbox(projectId: string): Promise<void> {
    const manager = await this.getSandboxManagerInstance();
    await manager.stop(projectId);
  }

  async buildAndStartSandbox(projectId: string, sandboxPath: string): Promise<Sandbox> {
    const manager = await this.getSandboxManagerInstance();
    return manager.buildAndStart(projectId, sandboxPath);
  }

  async restartSandbox(projectId: string): Promise<Sandbox> {
    await this.stopSandbox(projectId);
    return this.startSandbox(projectId);
  }
}

// Use globalThis to persist instance across HMR reloads in development
const globalForCrayon = globalThis as unknown as {
  crayonService: CrayonService | undefined;
};

export function getCrayonService(config?: CrayonServiceConfig): CrayonService {
  if (!globalForCrayon.crayonService) {
    globalForCrayon.crayonService = new CrayonService(config);
  }
  return globalForCrayon.crayonService;
}
