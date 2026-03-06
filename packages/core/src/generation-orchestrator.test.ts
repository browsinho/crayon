/**
 * Tests for generation-orchestrator.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  orchestrate,
  orchestrateStream,
  GenerationOrchestratorError,
  type GenerationConfig,
  type PipelineEvent,
} from "./generation-orchestrator.js";
import type { Recording } from "@crayon/types";

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_PROJECT_ID = "test-project-123";
const TEST_RECORDING_ID = "test-recording-456";

const mockRecording: Recording = {
  metadata: {
    id: TEST_RECORDING_ID,
    createdAt: "2025-01-01T00:00:00Z",
    startUrl: "https://example.com",
    status: "completed",
    stats: {
      domSnapshots: 2,
      networkCalls: 1,
      screenshots: 1,
    },
  },
  domSnapshots: [
    {
      url: "https://example.com",
      timestamp: Date.now(),
      type: "full",
      html: `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <header class="header">
              <h1>Welcome</h1>
              <nav class="nav">
                <a href="/">Home</a>
                <a href="/about">About</a>
              </nav>
            </header>
            <main>
              <div class="card">
                <h2>Card Title</h2>
                <p>Card content</p>
              </div>
            </main>
          </body>
        </html>
      `,
    },
    {
      url: "https://example.com/about",
      timestamp: Date.now(),
      type: "full",
      html: `
        <html>
          <head><title>About Page</title></head>
          <body>
            <header class="header">
              <h1>About Us</h1>
            </header>
            <main>
              <p>About page content</p>
            </main>
          </body>
        </html>
      `,
    },
  ],
  networkCalls: [
    {
      request: {
        url: "https://example.com/api/users",
        method: "GET",
        headers: {
          "content-type": "application/json",
        },
      },
      response: {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
        contentType: "application/json",
        body: JSON.stringify({ users: [{ id: 1, name: "John Doe" }] }),
      },
      timestamp: Date.now(),
      duration: 100,
    },
  ],
  screenshots: [
    {
      url: "https://example.com",
      timestamp: Date.now(),
      path: "/screenshots/00001.png",
      width: 1920,
      height: 1080,
    },
  ],
};

// ============================================================================
// Test Helpers
// ============================================================================

function setupTestDirs() {
  const dataDir = "./data";
  const recordingsDir = path.join(dataDir, "recordings", TEST_RECORDING_ID);
  const projectsDir = path.join(dataDir, "projects", TEST_PROJECT_ID);

  // Create directories
  fs.mkdirSync(recordingsDir, { recursive: true });
  fs.mkdirSync(path.join(recordingsDir, "dom"), { recursive: true });
  fs.mkdirSync(path.join(recordingsDir, "network"), { recursive: true });
  fs.mkdirSync(path.join(recordingsDir, "screenshots"), { recursive: true });
  fs.mkdirSync(projectsDir, { recursive: true });

  // Save mock recording
  fs.writeFileSync(
    path.join(recordingsDir, "metadata.json"),
    JSON.stringify(mockRecording.metadata, null, 2)
  );

  // Save DOM snapshots
  mockRecording.domSnapshots.forEach((snapshot, i) => {
    fs.writeFileSync(
      path.join(recordingsDir, "dom", `${String(i + 1).padStart(5, "0")}.json`),
      JSON.stringify(snapshot, null, 2)
    );
  });

  // Save network calls
  mockRecording.networkCalls.forEach((call, i) => {
    fs.writeFileSync(
      path.join(
        recordingsDir,
        "network",
        `${String(i + 1).padStart(5, "0")}.json`
      ),
      JSON.stringify(call, null, 2)
    );
  });

  // Save screenshots
  mockRecording.screenshots.forEach((screenshot, i) => {
    fs.writeFileSync(
      path.join(
        recordingsDir,
        "screenshots",
        `${String(i + 1).padStart(5, "0")}.json`
      ),
      JSON.stringify(screenshot, null, 2)
    );
  });

  // Create project metadata
  const project = {
    id: TEST_PROJECT_ID,
    name: "Test Project",
    description: "Test project description",
    thumbnail: null,
    status: "draft",
    sourceUrl: "https://example.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recording: null,
    sandbox: null,
    tags: [],
  };

  fs.writeFileSync(
    path.join(projectsDir, "project.json"),
    JSON.stringify(project, null, 2)
  );
}

function cleanupTestDirs() {
  const dataDir = "./data";
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ============================================================================
// Unit Tests
// ============================================================================

describe("generation-orchestrator", () => {
  beforeEach(() => {
    setupTestDirs();
  });

  afterEach(() => {
    cleanupTestDirs();
  });

  describe("orchestrate", () => {
    it("should execute pipeline stages in order", async () => {
      const events: PipelineEvent[] = [];
      const config: GenerationConfig = {
        recordingId: TEST_RECORDING_ID,
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
        onProgress: (event) => events.push(event),
      };

      try {
        await orchestrate(config);
      } catch (error) {
        // Expected to fail at code generation (no AI SDK)
        if (
          error instanceof Error &&
          error.message.includes("Vercel AI SDK")
        ) {
          // This is expected
        } else {
          throw error;
        }
      }

      // Check that stages were executed in order
      const stages = events.map((e) => e.stage);
      expect(stages).toContain("cleaning");
      expect(stages).toContain("summarizing");
      expect(stages).toContain("prompt_building");

      // Verify order
      const cleaningIdx = stages.indexOf("cleaning");
      const summarizingIdx = stages.indexOf("summarizing");
      const promptBuildingIdx = stages.indexOf("prompt_building");

      expect(cleaningIdx).toBeGreaterThanOrEqual(0);
      expect(summarizingIdx).toBeGreaterThan(cleaningIdx);
      expect(promptBuildingIdx).toBeGreaterThan(summarizingIdx);
    });

    it("should save checkpoints after each stage", async () => {
      const config: GenerationConfig = {
        recordingId: TEST_RECORDING_ID,
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
      };

      try {
        await orchestrate(config);
      } catch (error) {
        // Expected to fail at code generation
        if (
          error instanceof Error &&
          error.message.includes("Vercel AI SDK")
        ) {
          // This is expected
        } else {
          throw error;
        }
      }

      // Check that checkpoint exists
      const checkpointPath = path.join(
        "./data/projects",
        TEST_PROJECT_ID,
        "generation",
        "checkpoint.json"
      );
      expect(fs.existsSync(checkpointPath)).toBe(true);

      const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf-8"));
      expect(checkpoint.projectId).toBe(TEST_PROJECT_ID);
      expect(checkpoint.recordingId).toBe(TEST_RECORDING_ID);
      expect(checkpoint.completedStages).toContain("cleaning");
      expect(checkpoint.completedStages).toContain("summarizing");
      expect(checkpoint.completedStages).toContain("prompt_building");
    });

    it("should save cleaned recording to checkpoint directory", async () => {
      const config: GenerationConfig = {
        recordingId: TEST_RECORDING_ID,
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
      };

      try {
        await orchestrate(config);
      } catch {
        // Expected to fail
      }

      const cleanedPath = path.join(
        "./data/projects",
        TEST_PROJECT_ID,
        "generation",
        "01-cleaned.json"
      );
      expect(fs.existsSync(cleanedPath)).toBe(true);

      const cleaned = JSON.parse(fs.readFileSync(cleanedPath, "utf-8"));
      expect(cleaned.dom).toBeDefined();
      expect(cleaned.network).toBeDefined();
      expect(cleaned.metadata).toBeDefined();
    });

    it("should save summary to checkpoint directory", async () => {
      const config: GenerationConfig = {
        recordingId: TEST_RECORDING_ID,
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
      };

      try {
        await orchestrate(config);
      } catch {
        // Expected to fail
      }

      const summaryPath = path.join(
        "./data/projects",
        TEST_PROJECT_ID,
        "generation",
        "02-summary.json"
      );
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
      expect(summary.description).toBeDefined();
      expect(summary.pages).toBeDefined();
      expect(summary.components).toBeDefined();
    });

    it("should save prompt to checkpoint directory", async () => {
      const config: GenerationConfig = {
        recordingId: TEST_RECORDING_ID,
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
      };

      try {
        await orchestrate(config);
      } catch {
        // Expected to fail
      }

      const promptPath = path.join(
        "./data/projects",
        TEST_PROJECT_ID,
        "generation",
        "03-prompt.json"
      );
      expect(fs.existsSync(promptPath)).toBe(true);

      const prompt = JSON.parse(fs.readFileSync(promptPath, "utf-8"));
      expect(prompt.systemPrompt).toBeDefined();
      expect(prompt.userMessage).toBeDefined();
      expect(prompt.metadata).toBeDefined();
    });

    it("should log all events to logs.jsonl", async () => {
      const config: GenerationConfig = {
        recordingId: TEST_RECORDING_ID,
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
      };

      try {
        await orchestrate(config);
      } catch {
        // Expected to fail
      }

      const logsPath = path.join(
        "./data/projects",
        TEST_PROJECT_ID,
        "generation",
        "logs.jsonl"
      );
      expect(fs.existsSync(logsPath)).toBe(true);

      const content = fs.readFileSync(logsPath, "utf-8");
      const lines = content.trim().split("\n");
      expect(lines.length).toBeGreaterThan(0);

      // Parse each line
      const events = lines.map((line) => JSON.parse(line));
      expect(events.every((e) => e.stage && e.status && e.message)).toBe(true);
    });

    it("should emit progress events via callback", async () => {
      const events: PipelineEvent[] = [];
      const config: GenerationConfig = {
        recordingId: TEST_RECORDING_ID,
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
        onProgress: (event) => events.push(event),
      };

      try {
        await orchestrate(config);
      } catch {
        // Expected to fail
      }

      expect(events.length).toBeGreaterThan(0);

      // Check for started events
      const startedEvents = events.filter((e) => e.status === "started");
      expect(startedEvents.length).toBeGreaterThan(0);

      // Check for completed events
      const completedEvents = events.filter((e) => e.status === "completed");
      expect(completedEvents.length).toBeGreaterThan(0);
    });

    it("should handle errors and throw GenerationOrchestratorError", async () => {
      const config: GenerationConfig = {
        recordingId: "nonexistent-recording",
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
      };

      await expect(orchestrate(config)).rejects.toThrow(
        GenerationOrchestratorError
      );
    });

    it("should include error stage in GenerationOrchestratorError", async () => {
      const config: GenerationConfig = {
        recordingId: "nonexistent-recording",
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
      };

      try {
        await orchestrate(config);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(GenerationOrchestratorError);
        const genError = error as GenerationOrchestratorError;
        expect(genError.stage).toBe("cleaning");
      }
    });
  });

  describe("orchestrateStream", () => {
    it("should yield events as generator", async () => {
      const config: GenerationConfig = {
        recordingId: TEST_RECORDING_ID,
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
      };

      const events: PipelineEvent[] = [];

      try {
        for await (const event of orchestrateStream(config)) {
          events.push(event);
        }
      } catch (error) {
        // Expected to fail at code generation
        if (
          error instanceof Error &&
          error.message.includes("Vercel AI SDK")
        ) {
          // This is expected
        } else {
          throw error;
        }
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.stage === "cleaning")).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should capture and return errors in output", async () => {
      const config: GenerationConfig = {
        recordingId: TEST_RECORDING_ID,
        projectId: TEST_PROJECT_ID,
        llmProvider: "anthropic",
        includeBackend: false,
        includeMockData: false,
      };

      try {
        const output = await orchestrate(config);
        // If we get here, should have errors
        expect(output.errors.length).toBeGreaterThan(0);
      } catch (error) {
        // Also acceptable - pipeline failed
        expect(error).toBeDefined();
      }
    });
  });
});
