import { describe, it, expect } from "vitest";
import { build } from "./prompt-builder.js";
import type { RecordingSummary } from "@crayon/types";
import type { CleanedRecording } from "./recording-cleaner.js";

describe("prompt-builder", () => {
  const mockSummary: RecordingSummary = {
    description: "A task management dashboard with kanban boards",
    domain: "productivity",
    pages: [
      {
        url: "https://example.com/",
        title: "Dashboard",
        pageType: "landing",
        keyElements: ["header with logo", "sidebar navigation", "kanban board"],
      },
      {
        url: "https://example.com/tasks",
        title: "Tasks",
        pageType: "dashboard",
        keyElements: ["task list", "filters", "search"],
      },
      {
        url: "https://example.com/task/123",
        title: "Task Detail",
        pageType: "detail",
        keyElements: ["task form", "comments", "activity log"],
      },
    ],
    components: [
      {
        type: "button",
        variants: 3,
        examples: ['<button class="btn-primary">Click</button>'],
      },
      {
        type: "modal",
        variants: 2,
        examples: ['<div class="modal">Modal content</div>'],
      },
      {
        type: "card",
        variants: 1,
        examples: ['<div class="card">Card content</div>'],
      },
    ],
    brandStyle: {
      colors: ["#3b82f6", "#1e40af", "#ffffff"],
      fonts: ["Inter", "system-ui"],
      styleKeywords: ["modern", "minimal", "professional"],
    },
    framework: {
      framework: "react",
      confidence: 0.95,
      signals: ["React", "ReactDOM", "jsx"],
    },
    interactions: [
      {
        type: "click",
        description: "Click on task card",
        frequency: 15,
      },
      {
        type: "navigation",
        description: "Navigate between pages",
        frequency: 8,
      },
    ],
  };

  const mockCleanedRecording: CleanedRecording = {
    dom: [
      {
        url: "https://example.com/",
        timestamp: Date.now(),
        html: '<div class="container"><header class="header"><h1>Dashboard</h1></header><main class="content"><div class="kanban-board"><div class="column"><h2>Todo</h2><div class="card">Task 1</div></div></div></main></div>',
        structure: "div > header > h1 main > div > div > h2 div",
      },
      {
        url: "https://example.com/tasks",
        timestamp: Date.now(),
        html: '<div class="container"><header class="header"><h1>Tasks</h1></header><main class="content"><div class="task-list"><div class="task-item">Task 1</div></div></main></div>',
        structure: "div > header > h1 main > div > div",
      },
      {
        url: "https://example.com/task/123",
        timestamp: Date.now(),
        html: '<div class="container"><header class="header"><h1>Task Detail</h1></header><main class="content"><form class="task-form"><input type="text"><button>Save</button></form></main></div>',
        structure: "div > header > h1 main > form > input button",
      },
    ],
    network: [
      {
        method: "GET",
        url: "https://example.com/api/tasks",
        headers: { "content-type": "application/json" },
        response: [
          { id: 1, title: "Task 1", status: "todo" },
          { id: 2, title: "Task 2", status: "done" },
        ],
      },
      {
        method: "POST",
        url: "https://example.com/api/tasks",
        headers: { "content-type": "application/json" },
        body: { title: "New Task", status: "todo" },
        response: { id: 3, title: "New Task", status: "todo" },
      },
      {
        method: "GET",
        url: "https://example.com/api/tasks/123",
        headers: { "content-type": "application/json" },
        response: { id: 123, title: "Task 123", status: "in-progress" },
      },
      {
        method: "GET",
        url: "https://google-analytics.com/collect",
        headers: {},
        response: {},
      },
    ],
    metadata: {
      originalTokenCount: 50000,
      cleanedTokenCount: 25000,
      elementsRemoved: 150,
      requestsFiltered: 10,
    },
  };

  describe("build", () => {
    it("should generate a complete prompt", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt).toBeDefined();
      expect(prompt.systemPrompt).toBeDefined();
      expect(prompt.userMessage).toBeDefined();
      expect(prompt.context).toBeDefined();
      expect(prompt.metadata).toBeDefined();
    });

    it("should include all required rules in system prompt", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.systemPrompt).toContain("Vite + React + TypeScript");
      expect(prompt.systemPrompt).toContain("Tailwind CSS");
      expect(prompt.systemPrompt).toContain("NO truncation");
      expect(prompt.systemPrompt).toContain("NO placeholders");
      expect(prompt.systemPrompt).toContain("OUTPUT FORMAT:");
      expect(prompt.systemPrompt).toContain("<file path=");
      expect(prompt.systemPrompt).toContain("<package>");
      expect(prompt.systemPrompt).toContain("DO NOT add features");
      expect(prompt.systemPrompt).toContain("DO NOT use external APIs");
    });

    it("should include recording summary in user message", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.userMessage).toContain(mockSummary.description);
      expect(prompt.userMessage).toContain(mockSummary.domain);
      expect(prompt.userMessage).toContain("react");
    });

    it("should include pages in user message", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.userMessage).toContain("PAGES:");
      expect(prompt.userMessage).toContain("Dashboard");
      expect(prompt.userMessage).toContain("Tasks");
      expect(prompt.userMessage).toContain("Task Detail");
    });

    it("should include components in user message", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.userMessage).toContain("COMPONENTS:");
      expect(prompt.userMessage).toContain("button");
      expect(prompt.userMessage).toContain("modal");
      expect(prompt.userMessage).toContain("card");
    });

    it("should include brand style in user message", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.userMessage).toContain("BRAND STYLE:");
      expect(prompt.userMessage).toContain("#3b82f6");
      expect(prompt.userMessage).toContain("Inter");
      expect(prompt.userMessage).toContain("modern");
    });

    it("should include DOM samples in user message", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.userMessage).toContain("DOM STRUCTURE");
      expect(prompt.context.domSamples.length).toBeGreaterThan(0);
      expect(prompt.context.domSamples.length).toBeLessThanOrEqual(8);
    });

    it("should extract and include API routes", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.context.apiRoutes.length).toBeGreaterThan(0);
      expect(prompt.context.apiRoutes).toContain("GET /api/tasks");
      expect(prompt.context.apiRoutes).toContain("POST /api/tasks");
      expect(prompt.context.apiRoutes).toContain("GET /api/tasks/:id");
      expect(prompt.userMessage).toContain("API ROUTES:");
    });

    it("should normalize API route parameters", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      // /api/tasks/123 should be normalized to /api/tasks/:id
      expect(prompt.context.apiRoutes).toContain("GET /api/tasks/:id");
      expect(prompt.context.apiRoutes).not.toContain("GET /api/tasks/123");
    });

    it("should extract framework and libraries", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.context.framework).toBe("react");
      expect(prompt.context.libraries).toContain("react");
      expect(prompt.context.libraries).toContain("react-dom");
      expect(prompt.context.libraries).toContain("react-router-dom");
    });

    it("should detect UI libraries based on components", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      // Should detect modal component and include @radix-ui/react-dialog
      expect(prompt.context.libraries).toContain("@radix-ui/react-dialog");
    });

    it("should calculate token count", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.metadata.totalTokens).toBeGreaterThan(0);
      // Should be under budget (60K tokens)
      expect(prompt.metadata.totalTokens).toBeLessThan(60000);
    });

    it("should calculate estimated cost", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.metadata.estimatedCost).toBeGreaterThan(0);
      // Cost should be reasonable (less than $0.20 for < 60K tokens)
      expect(prompt.metadata.estimatedCost).toBeLessThan(0.2);
    });

    it("should select diverse DOM samples", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      // Should select samples from different page types
      expect(prompt.context.domSamples.length).toBeGreaterThan(0);

      // Should prioritize homepage
      const hasHomepage = prompt.context.domSamples.some((sample) =>
        sample.includes("Dashboard")
      );
      expect(hasHomepage).toBe(true);
    });

    it("should limit DOM samples to max 8 pages", async () => {
      // Create a recording with many pages
      const manyPages: CleanedRecording = {
        ...mockCleanedRecording,
        dom: Array.from({ length: 20 }, (_, i) => ({
          url: `https://example.com/page${i}`,
          timestamp: Date.now(),
          html: `<div class="page${i}">Content ${i}</div>`.repeat(100),
          structure: `div > div${i}`,
        })),
      };

      const prompt = await build(manyPages, mockSummary);

      expect(prompt.context.domSamples.length).toBeLessThanOrEqual(8);
    });

    it("should handle optional screenshots", async () => {
      const screenshots = ["data:image/png;base64,abc123", "data:image/png;base64,def456"];
      const prompt = await build(mockCleanedRecording, mockSummary, screenshots);

      expect(prompt.context.screenshots).toEqual(screenshots);
      expect(prompt.userMessage).toContain("SCREENSHOTS:");
      expect(prompt.userMessage).toContain("2 screenshots");
    });

    it("should work without screenshots", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.context.screenshots).toBeUndefined();
    });

    it("should respect token budget for DOM samples", async () => {
      // Create a recording with very large DOM samples
      const largePages: CleanedRecording = {
        ...mockCleanedRecording,
        dom: Array.from({ length: 10 }, (_, i) => ({
          url: `https://example.com/page${i}`,
          timestamp: Date.now(),
          html: "<div>Large content</div>".repeat(5000), // ~100K characters each
          structure: "div".repeat(100),
        })),
      };

      const prompt = await build(largePages, mockSummary);

      // Total tokens should still be under budget
      expect(prompt.metadata.totalTokens).toBeLessThan(60000);
    });

    it("should include goal statement in user message", async () => {
      const prompt = await build(mockCleanedRecording, mockSummary);

      expect(prompt.userMessage).toContain("GOAL:");
      expect(prompt.userMessage).toContain("pixel-perfect clone");
      expect(prompt.userMessage).toContain("compiles and runs locally");
    });
  });
});
