import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  ProjectStorage,
  ProjectStorageError,
  createProjectStorage,
} from "./project-storage.js";
import type { Project, CreateProjectData, UpdateProjectData } from "@crayon/types";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  rmSync: vi.fn(),
  renameSync: vi.fn(),
}));

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-12345"),
}));

import * as fs from "fs";
import * as crypto from "crypto";

function createMockProject(overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return {
    id: "proj-001",
    name: "Test Project",
    description: "A test project",
    thumbnail: null,
    status: "draft",
    sourceUrl: "https://example.com",
    createdAt: now,
    updatedAt: now,
    recording: null,
    sandbox: null,
    tags: [],
    ...overrides,
  };
}

describe("ProjectStorage", () => {
  let storage: ProjectStorage;
  const testBaseDir = "./test-projects";
  let mockProjects: Record<string, string>;
  let mockDirents: { name: string; isDirectory: () => boolean }[];

  beforeEach(() => {
    storage = new ProjectStorage({ baseDir: testBaseDir });
    mockProjects = {};
    mockDirents = [];

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.rmSync).mockReturnValue(undefined);
    vi.mocked(fs.renameSync).mockReturnValue(undefined);

    vi.mocked(fs.writeFileSync).mockImplementation((filePath, content) => {
      const pathStr = filePath.toString();
      if (pathStr.includes("project.json")) {
        const parts = pathStr.split("/");
        const id = parts[parts.length - 2];
        mockProjects[id] = content as string;
      }
    });

    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      const pathStr = filePath.toString();
      if (pathStr.includes("project.json")) {
        const parts = pathStr.split("/");
        const id = parts[parts.length - 2];
        return mockProjects[id] || "";
      }
      return "";
    });

    vi.mocked(fs.readdirSync).mockImplementation(() => {
      return mockDirents as unknown as ReturnType<typeof fs.readdirSync>;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates a new project with generated ID", async () => {
      const data: CreateProjectData = {
        name: "New Project",
        sourceUrl: "https://example.com",
      };

      const project = await storage.create(data);

      expect(project.id).toBe("test-uuid-12345");
      expect(project.name).toBe("New Project");
      expect(project.sourceUrl).toBe("https://example.com");
      expect(project.status).toBe("draft");
      expect(project.thumbnail).toBeNull();
      expect(project.recording).toBeNull();
      expect(project.sandbox).toBeNull();
      expect(project.tags).toEqual([]);
    });

    it("creates project directory", async () => {
      const data: CreateProjectData = {
        name: "New Project",
        sourceUrl: "https://example.com",
      };

      await storage.create(data);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("test-uuid-12345"),
        { recursive: true }
      );
    });

    it("saves project metadata to disk", async () => {
      const data: CreateProjectData = {
        name: "New Project",
        sourceUrl: "https://example.com",
      };

      await storage.create(data);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("project.json"),
        expect.any(String)
      );
    });

    it("includes optional description and tags", async () => {
      const data: CreateProjectData = {
        name: "New Project",
        description: "A description",
        sourceUrl: "https://example.com",
        tags: ["tag1", "tag2"],
      };

      const project = await storage.create(data);

      expect(project.description).toBe("A description");
      expect(project.tags).toEqual(["tag1", "tag2"]);
    });

    it("throws if project directory already exists", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("test-uuid-12345") && !pathStr.includes("project.json");
      });

      const data: CreateProjectData = {
        name: "New Project",
        sourceUrl: "https://example.com",
      };

      await expect(storage.create(data)).rejects.toThrow(ProjectStorageError);
      await expect(storage.create(data)).rejects.toThrow("already exists");
    });
  });

  describe("get", () => {
    beforeEach(() => {
      const mockProject = createMockProject({ id: "proj-001" });
      mockProjects["proj-001"] = JSON.stringify(mockProject);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("proj-001") && pathStr.includes("project.json");
      });
    });

    it("returns project when found", async () => {
      const project = await storage.get("proj-001");

      expect(project).not.toBeNull();
      expect(project?.id).toBe("proj-001");
      expect(project?.name).toBe("Test Project");
    });

    it("returns null when project not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const project = await storage.get("nonexistent");

      expect(project).toBeNull();
    });
  });

  describe("list", () => {
    beforeEach(() => {
      const project1 = createMockProject({
        id: "proj-001",
        name: "Alpha Project",
        status: "ready",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-15T00:00:00.000Z",
      });
      const project2 = createMockProject({
        id: "proj-002",
        name: "Beta Project",
        status: "draft",
        createdAt: "2024-01-10T00:00:00.000Z",
        updatedAt: "2024-01-20T00:00:00.000Z",
        tags: ["important"],
      });
      const project3 = createMockProject({
        id: "proj-003",
        name: "Gamma Project",
        status: "recording",
        createdAt: "2024-01-05T00:00:00.000Z",
        updatedAt: "2024-01-10T00:00:00.000Z",
      });

      mockProjects["proj-001"] = JSON.stringify(project1);
      mockProjects["proj-002"] = JSON.stringify(project2);
      mockProjects["proj-003"] = JSON.stringify(project3);

      mockDirents = [
        { name: "proj-001", isDirectory: () => true },
        { name: "proj-002", isDirectory: () => true },
        { name: "proj-003", isDirectory: () => true },
      ];

      vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    it("returns all projects", async () => {
      const projects = await storage.list();

      expect(projects).toHaveLength(3);
    });

    it("sorts by updatedAt descending by default", async () => {
      const projects = await storage.list();

      expect(projects[0].id).toBe("proj-002");
      expect(projects[1].id).toBe("proj-001");
      expect(projects[2].id).toBe("proj-003");
    });

    it("filters by status", async () => {
      const projects = await storage.list({ status: ["ready"] });

      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe("proj-001");
    });

    it("filters by multiple statuses", async () => {
      const projects = await storage.list({ status: ["ready", "draft"] });

      expect(projects).toHaveLength(2);
    });

    it("filters by search term", async () => {
      const projects = await storage.list({ search: "beta" });

      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe("proj-002");
    });

    it("filters by tags", async () => {
      const projects = await storage.list({ tags: ["important"] });

      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe("proj-002");
    });

    it("sorts by name ascending", async () => {
      const projects = await storage.list(undefined, {
        field: "name",
        order: "asc",
      });

      expect(projects[0].name).toBe("Alpha Project");
      expect(projects[1].name).toBe("Beta Project");
      expect(projects[2].name).toBe("Gamma Project");
    });

    it("sorts by name descending", async () => {
      const projects = await storage.list(undefined, {
        field: "name",
        order: "desc",
      });

      expect(projects[0].name).toBe("Gamma Project");
      expect(projects[1].name).toBe("Beta Project");
      expect(projects[2].name).toBe("Alpha Project");
    });

    it("sorts by createdAt", async () => {
      const projects = await storage.list(undefined, {
        field: "createdAt",
        order: "asc",
      });

      expect(projects[0].id).toBe("proj-001");
      expect(projects[1].id).toBe("proj-003");
      expect(projects[2].id).toBe("proj-002");
    });

    it("returns empty array when no projects exist", async () => {
      mockDirents = [];

      const projects = await storage.list();

      expect(projects).toEqual([]);
    });
  });

  describe("update", () => {
    beforeEach(() => {
      const mockProject = createMockProject({ id: "proj-001" });
      mockProjects["proj-001"] = JSON.stringify(mockProject);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("proj-001");
      });
    });

    it("updates project name", async () => {
      const updated = await storage.update("proj-001", { name: "Updated Name" });

      expect(updated.name).toBe("Updated Name");
    });

    it("updates project description", async () => {
      const updated = await storage.update("proj-001", {
        description: "New description",
      });

      expect(updated.description).toBe("New description");
    });

    it("updates project status", async () => {
      const updated = await storage.update("proj-001", { status: "ready" });

      expect(updated.status).toBe("ready");
    });

    it("updates project tags", async () => {
      const updated = await storage.update("proj-001", {
        tags: ["new-tag"],
      });

      expect(updated.tags).toEqual(["new-tag"]);
    });

    it("updates updatedAt timestamp", async () => {
      const original = JSON.parse(mockProjects["proj-001"]) as Project;
      const updated = await storage.update("proj-001", { name: "Updated" });

      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.updatedAt).getTime()
      );
    });

    it("throws if project not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        storage.update("nonexistent", { name: "Test" })
      ).rejects.toThrow(ProjectStorageError);
      await expect(
        storage.update("nonexistent", { name: "Test" })
      ).rejects.toThrow("not found");
    });
  });

  describe("delete", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("proj-001");
      });
    });

    it("deletes project directory", async () => {
      await storage.delete("proj-001");

      expect(fs.rmSync).toHaveBeenCalledWith(
        expect.stringContaining("proj-001"),
        { recursive: true, force: true }
      );
    });

    it("throws if project not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(storage.delete("nonexistent")).rejects.toThrow(
        ProjectStorageError
      );
      await expect(storage.delete("nonexistent")).rejects.toThrow("not found");
    });
  });

  describe("saveRecording", () => {
    beforeEach(() => {
      const mockProject = createMockProject({ id: "proj-001" });
      mockProjects["proj-001"] = JSON.stringify(mockProject);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("proj-001");
      });
    });

    it("saves recording and updates project status", async () => {
      const recording = {
        metadata: {
          id: "rec-001",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed" as const,
          stats: { domSnapshots: 5, networkCalls: 10, screenshots: 3 },
        },
        domSnapshots: [],
        networkCalls: [],
        screenshots: [],
      };

      await storage.saveRecording("proj-001", recording);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("recording.json"),
        expect.any(String)
      );
    });

    it("throws if project not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const recording = {
        metadata: {
          id: "rec-001",
          createdAt: new Date().toISOString(),
          startUrl: "https://example.com",
          status: "completed" as const,
          stats: { domSnapshots: 0, networkCalls: 0, screenshots: 0 },
        },
        domSnapshots: [],
        networkCalls: [],
        screenshots: [],
      };

      await expect(
        storage.saveRecording("nonexistent", recording)
      ).rejects.toThrow(ProjectStorageError);
    });
  });

  describe("saveSandbox", () => {
    beforeEach(() => {
      const mockProject = createMockProject({ id: "proj-001" });
      mockProjects["proj-001"] = JSON.stringify(mockProject);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("proj-001");
      });
    });

    it("saves sandbox and updates project status to ready", async () => {
      const sandbox = {
        id: "sandbox-001",
        status: "running" as const,
        ports: { frontend: 3000, backend: 8080 },
        url: "http://localhost:3000",
      };

      await storage.saveSandbox("proj-001", sandbox);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("sandbox.json"),
        expect.any(String)
      );
    });

    it("throws if project not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const sandbox = {
        id: "sandbox-001",
        status: "running" as const,
        ports: { frontend: 3000, backend: 8080 },
      };

      await expect(
        storage.saveSandbox("nonexistent", sandbox)
      ).rejects.toThrow(ProjectStorageError);
    });
  });

  describe("saveThumbnail", () => {
    beforeEach(() => {
      const mockProject = createMockProject({ id: "proj-001" });
      mockProjects["proj-001"] = JSON.stringify(mockProject);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = p.toString();
        return pathStr.includes("proj-001");
      });
    });

    it("saves thumbnail and updates project", async () => {
      const buffer = Buffer.from("fake-image-data");

      await storage.saveThumbnail("proj-001", buffer);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("thumbnail.png"),
        buffer
      );
    });

    it("throws if project not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        storage.saveThumbnail("nonexistent", Buffer.from("data"))
      ).rejects.toThrow(ProjectStorageError);
    });
  });
});

describe("ProjectStorageError", () => {
  it("creates error with message and code", () => {
    const error = new ProjectStorageError("Test error", "NOT_FOUND");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.name).toBe("ProjectStorageError");
  });

  it("creates error with cause", () => {
    const cause = new Error("Original error");
    const error = new ProjectStorageError("Test error", "IO_ERROR", cause);

    expect(error.cause).toBe(cause);
  });
});

describe("createProjectStorage helper", () => {
  it("creates ProjectStorage instance", () => {
    const storage = createProjectStorage();
    expect(storage).toBeInstanceOf(ProjectStorage);
  });

  it("passes config to ProjectStorage", () => {
    const storage = createProjectStorage({ baseDir: "./custom-dir" });
    expect(storage).toBeInstanceOf(ProjectStorage);
  });
});
