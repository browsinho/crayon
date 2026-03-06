import type {
  Project,
  ProjectListFilters,
  ProjectSort,
  CreateProjectData,
  UpdateProjectData,
  Recording,
  Sandbox,
} from "@crayon/types";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as archiver from "archiver";
import * as unzipper from "unzipper";

export interface ProjectStorageConfig {
  baseDir?: string;
}

const DEFAULT_CONFIG: Required<ProjectStorageConfig> = {
  baseDir: "./projects",
};

export type ProjectStorageErrorCode =
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "IO_ERROR"
  | "INVALID_DATA"
  | "EXPORT_ERROR"
  | "IMPORT_ERROR";

export class ProjectStorageError extends Error {
  public readonly code: ProjectStorageErrorCode;
  public readonly cause?: unknown;

  constructor(message: string, code: ProjectStorageErrorCode, cause?: unknown) {
    super(message);
    this.name = "ProjectStorageError";
    this.code = code;
    this.cause = cause;
  }
}

export class ProjectStorage {
  private config: Required<ProjectStorageConfig>;

  constructor(config: ProjectStorageConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureBaseDir();
  }

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.config.baseDir)) {
      fs.mkdirSync(this.config.baseDir, { recursive: true });
    }
  }

  private getProjectDir(id: string): string {
    return path.join(this.config.baseDir, id);
  }

  private getProjectMetadataPath(id: string): string {
    return path.join(this.getProjectDir(id), "project.json");
  }

  private getRecordingPath(id: string): string {
    return path.join(this.getProjectDir(id), "recording.json");
  }

  private getSandboxPath(id: string): string {
    return path.join(this.getProjectDir(id), "sandbox.json");
  }

  private getThumbnailPath(id: string): string {
    return path.join(this.getProjectDir(id), "thumbnail.png");
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  async list(filters?: ProjectListFilters, sort?: ProjectSort): Promise<Project[]> {
    const entries = fs.existsSync(this.config.baseDir)
      ? fs.readdirSync(this.config.baseDir, { withFileTypes: true })
      : [];

    const projects: Project[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectPath = this.getProjectMetadataPath(entry.name);
      if (!fs.existsSync(projectPath)) continue;

      try {
        const content = fs.readFileSync(projectPath, "utf-8");
        const project = JSON.parse(content) as Project;
        projects.push(project);
      } catch {
        // Skip corrupted projects
        continue;
      }
    }

    // Apply filters
    let filtered = this.applyFilters(projects, filters);

    // Apply sort
    filtered = this.applySort(filtered, sort);

    return filtered;
  }

  private applyFilters(projects: Project[], filters?: ProjectListFilters): Project[] {
    if (!filters) return projects;

    let result = [...projects];

    if (filters.status && filters.status.length > 0) {
      result = result.filter((p) => filters.status!.includes(p.status));
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.description && p.description.toLowerCase().includes(searchLower))
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      result = result.filter((p) =>
        filters.tags!.some((tag) => p.tags.includes(tag))
      );
    }

    if (filters.dateRange) {
      const start = new Date(filters.dateRange.start).getTime();
      const end = new Date(filters.dateRange.end).getTime();
      result = result.filter((p) => {
        const created = new Date(p.createdAt).getTime();
        return created >= start && created <= end;
      });
    }

    return result;
  }

  private applySort(projects: Project[], sort?: ProjectSort): Project[] {
    if (!sort) {
      // Default sort: most recently updated first
      return projects.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    const { field, order } = sort;
    const multiplier = order === "asc" ? 1 : -1;

    return projects.sort((a, b) => {
      switch (field) {
        case "name":
          return multiplier * a.name.localeCompare(b.name);
        case "createdAt":
          return (
            multiplier *
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          );
        case "updatedAt":
          return (
            multiplier *
            (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
          );
        case "status":
          return multiplier * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }

  async get(id: string): Promise<Project | null> {
    const projectPath = this.getProjectMetadataPath(id);
    if (!fs.existsSync(projectPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(projectPath, "utf-8");
      return JSON.parse(content) as Project;
    } catch (error) {
      throw new ProjectStorageError(
        `Failed to read project: ${id}`,
        "IO_ERROR",
        error
      );
    }
  }

  async create(data: CreateProjectData): Promise<Project> {
    const id = this.generateId();
    const projectDir = this.getProjectDir(id);

    if (fs.existsSync(projectDir)) {
      throw new ProjectStorageError(
        `Project directory already exists: ${id}`,
        "ALREADY_EXISTS"
      );
    }

    fs.mkdirSync(projectDir, { recursive: true });

    const now = new Date().toISOString();
    const project: Project = {
      id,
      name: data.name,
      description: data.description,
      thumbnail: null,
      status: "draft",
      sourceUrl: data.sourceUrl,
      createdAt: now,
      updatedAt: now,
      recording: null,
      sandbox: null,
      tags: data.tags ?? [],
    };

    await this.saveProject(project);
    return project;
  }

  async update(id: string, data: UpdateProjectData): Promise<Project> {
    const project = await this.get(id);
    if (!project) {
      throw new ProjectStorageError(`Project not found: ${id}`, "NOT_FOUND");
    }

    const updatedProject: Project = {
      ...project,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await this.saveProject(updatedProject);
    return updatedProject;
  }

  async delete(id: string): Promise<void> {
    const projectDir = this.getProjectDir(id);
    if (!fs.existsSync(projectDir)) {
      throw new ProjectStorageError(`Project not found: ${id}`, "NOT_FOUND");
    }

    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch (error) {
      throw new ProjectStorageError(
        `Failed to delete project: ${id}`,
        "IO_ERROR",
        error
      );
    }
  }

  async getRecording(projectId: string): Promise<Recording | null> {
    const recordingPath = this.getRecordingPath(projectId);
    if (!fs.existsSync(recordingPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(recordingPath, "utf-8");
      return JSON.parse(content) as Recording;
    } catch (error) {
      throw new ProjectStorageError(
        `Failed to read recording for project: ${projectId}`,
        "IO_ERROR",
        error
      );
    }
  }

  async saveRecording(projectId: string, recording: Recording): Promise<void> {
    const project = await this.get(projectId);
    if (!project) {
      throw new ProjectStorageError(
        `Project not found: ${projectId}`,
        "NOT_FOUND"
      );
    }

    const recordingPath = this.getRecordingPath(projectId);
    try {
      fs.writeFileSync(recordingPath, JSON.stringify(recording, null, 2));

      // Update project with recording metadata
      await this.update(projectId, {
        status: "recorded",
      });

      // Also update the recording reference in project
      const updatedProject = await this.get(projectId);
      if (updatedProject) {
        updatedProject.recording = recording.metadata;
        await this.saveProject(updatedProject);
      }
    } catch (error) {
      throw new ProjectStorageError(
        `Failed to save recording for project: ${projectId}`,
        "IO_ERROR",
        error
      );
    }
  }

  async getSandbox(projectId: string): Promise<Sandbox | null> {
    const sandboxPath = this.getSandboxPath(projectId);
    if (!fs.existsSync(sandboxPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(sandboxPath, "utf-8");
      return JSON.parse(content) as Sandbox;
    } catch (error) {
      throw new ProjectStorageError(
        `Failed to read sandbox for project: ${projectId}`,
        "IO_ERROR",
        error
      );
    }
  }

  async saveSandbox(projectId: string, sandbox: Sandbox): Promise<void> {
    const project = await this.get(projectId);
    if (!project) {
      throw new ProjectStorageError(
        `Project not found: ${projectId}`,
        "NOT_FOUND"
      );
    }

    const sandboxPath = this.getSandboxPath(projectId);
    try {
      fs.writeFileSync(sandboxPath, JSON.stringify(sandbox, null, 2));

      // Update project with sandbox reference
      const updatedProject = await this.get(projectId);
      if (updatedProject) {
        updatedProject.sandbox = sandbox;
        updatedProject.status = "ready";
        await this.saveProject(updatedProject);
      }
    } catch (error) {
      throw new ProjectStorageError(
        `Failed to save sandbox for project: ${projectId}`,
        "IO_ERROR",
        error
      );
    }
  }

  async saveThumbnail(projectId: string, imageBuffer: Buffer): Promise<void> {
    const project = await this.get(projectId);
    if (!project) {
      throw new ProjectStorageError(
        `Project not found: ${projectId}`,
        "NOT_FOUND"
      );
    }

    const thumbnailPath = this.getThumbnailPath(projectId);
    try {
      fs.writeFileSync(thumbnailPath, imageBuffer);
      await this.update(projectId, { thumbnail: thumbnailPath });
    } catch (error) {
      throw new ProjectStorageError(
        `Failed to save thumbnail for project: ${projectId}`,
        "IO_ERROR",
        error
      );
    }
  }

  async getThumbnail(projectId: string): Promise<Buffer | null> {
    const thumbnailPath = this.getThumbnailPath(projectId);
    if (!fs.existsSync(thumbnailPath)) {
      return null;
    }

    try {
      return fs.readFileSync(thumbnailPath);
    } catch (error) {
      throw new ProjectStorageError(
        `Failed to read thumbnail for project: ${projectId}`,
        "IO_ERROR",
        error
      );
    }
  }

  async export(projectId: string): Promise<Buffer> {
    const project = await this.get(projectId);
    if (!project) {
      throw new ProjectStorageError(
        `Project not found: ${projectId}`,
        "NOT_FOUND"
      );
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver.default("zip", { zlib: { level: 9 } });

      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", (err: Error) =>
        reject(new ProjectStorageError("Failed to export project", "EXPORT_ERROR", err))
      );

      const projectDir = this.getProjectDir(projectId);
      archive.directory(projectDir, false);
      archive.finalize();
    });
  }

  async import(data: Buffer): Promise<Project> {
    const tempId = `import-${this.generateId()}`;
    const tempDir = path.join(this.config.baseDir, tempId);

    try {
      // Create temp directory and extract
      fs.mkdirSync(tempDir, { recursive: true });

      await new Promise<void>((resolve, reject) => {
        const stream = unzipper.Extract({ path: tempDir });
        stream.on("close", resolve);
        stream.on("error", reject);
        stream.end(data);
      });

      // Read project metadata
      const projectPath = path.join(tempDir, "project.json");
      if (!fs.existsSync(projectPath)) {
        throw new ProjectStorageError(
          "Invalid project archive: missing project.json",
          "INVALID_DATA"
        );
      }

      const content = fs.readFileSync(projectPath, "utf-8");
      const importedProject = JSON.parse(content) as Project;

      // Generate new ID to avoid conflicts
      const newId = this.generateId();
      const newProjectDir = this.getProjectDir(newId);

      // Rename temp directory to new project directory
      fs.renameSync(tempDir, newProjectDir);

      // Update project with new ID
      const now = new Date().toISOString();
      const project: Project = {
        ...importedProject,
        id: newId,
        createdAt: now,
        updatedAt: now,
      };

      await this.saveProject(project);
      return project;
    } catch (error) {
      // Clean up temp directory on error
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      if (error instanceof ProjectStorageError) {
        throw error;
      }

      throw new ProjectStorageError(
        "Failed to import project",
        "IMPORT_ERROR",
        error
      );
    }
  }

  private async saveProject(project: Project): Promise<void> {
    const projectPath = this.getProjectMetadataPath(project.id);
    try {
      fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));
    } catch (error) {
      throw new ProjectStorageError(
        `Failed to save project: ${project.id}`,
        "IO_ERROR",
        error
      );
    }
  }
}

export const createProjectStorage = (
  config?: ProjectStorageConfig
): ProjectStorage => {
  return new ProjectStorage(config);
};
