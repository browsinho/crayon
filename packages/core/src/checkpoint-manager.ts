/**
 * Checkpoint Manager - Saves and restores sandbox state for quick reset
 *
 * Provides methods to create, restore, list, and delete checkpoints.
 * Snapshots SQLite database and browser storage (localStorage, cookies).
 */

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import type { Checkpoint, BrowserState, Cookie } from "@crayon/types";

export interface CheckpointManagerConfig {
  baseDir?: string;
}

const DEFAULT_CONFIG: Required<CheckpointManagerConfig> = {
  baseDir: "./checkpoints",
};

export class CheckpointManagerError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "ALREADY_EXISTS" | "IO_ERROR" | "INVALID_STATE"
  ) {
    super(message);
    this.name = "CheckpointManagerError";
  }
}

export interface BrowserStateProvider {
  getLocalStorage(): Promise<Record<string, string>>;
  getCookies(): Promise<Cookie[]>;
  setLocalStorage(data: Record<string, string>): Promise<void>;
  setCookies(cookies: Cookie[]): Promise<void>;
  clearLocalStorage(): Promise<void>;
  clearCookies(): Promise<void>;
}

export interface DatabaseProvider {
  getPath(): string;
}

/**
 * Create a Checkpoint Manager instance
 */
export function createCheckpointManager(
  config: CheckpointManagerConfig = {}
): CheckpointManager {
  return new CheckpointManager(config);
}

export class CheckpointManager {
  private readonly config: Required<CheckpointManagerConfig>;

  constructor(config: CheckpointManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a checkpoint from current sandbox state
   */
  async create(
    sandboxId: string,
    name: string,
    browserStateProvider: BrowserStateProvider,
    databaseProvider: DatabaseProvider
  ): Promise<Checkpoint> {
    const checkpointDir = this.getCheckpointDir(sandboxId, name);

    // Check if checkpoint already exists
    if (fs.existsSync(checkpointDir)) {
      throw new CheckpointManagerError(
        `Checkpoint '${name}' already exists for sandbox '${sandboxId}'`,
        "ALREADY_EXISTS"
      );
    }

    try {
      // Create checkpoint directory
      fs.mkdirSync(checkpointDir, { recursive: true });

      // Snapshot the database
      const sourceDatabasePath = databaseProvider.getPath();
      const snapshotDatabasePath = path.join(checkpointDir, "data.sqlite");

      if (fs.existsSync(sourceDatabasePath)) {
        fs.copyFileSync(sourceDatabasePath, snapshotDatabasePath);
      } else {
        // Create empty file if source doesn't exist
        fs.writeFileSync(snapshotDatabasePath, "");
      }

      // Capture browser state
      const localStorage = await browserStateProvider.getLocalStorage();
      const cookies = await browserStateProvider.getCookies();

      const browserState: BrowserState = {
        localStorage,
        cookies,
      };

      // Create checkpoint metadata
      const checkpoint: Checkpoint = {
        id: randomUUID(),
        name,
        createdAt: new Date(),
        databasePath: snapshotDatabasePath,
        browserState,
      };

      // Save state.json
      const statePath = path.join(checkpointDir, "state.json");
      fs.writeFileSync(statePath, JSON.stringify(checkpoint, null, 2));

      return checkpoint;
    } catch (error) {
      // Clean up on failure
      if (fs.existsSync(checkpointDir)) {
        fs.rmSync(checkpointDir, { recursive: true, force: true });
      }

      if (error instanceof CheckpointManagerError) {
        throw error;
      }

      throw new CheckpointManagerError(
        `Failed to create checkpoint: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR"
      );
    }
  }

  /**
   * Restore sandbox state from a checkpoint
   */
  async restore(
    sandboxId: string,
    checkpointId: string,
    browserStateProvider: BrowserStateProvider,
    databaseProvider: DatabaseProvider
  ): Promise<void> {
    // Find the checkpoint
    const checkpoint = await this.findCheckpointById(sandboxId, checkpointId);

    if (!checkpoint) {
      throw new CheckpointManagerError(
        `Checkpoint '${checkpointId}' not found for sandbox '${sandboxId}'`,
        "NOT_FOUND"
      );
    }

    const checkpointDir = this.getCheckpointDir(sandboxId, checkpoint.name);
    const snapshotDatabasePath = path.join(checkpointDir, "data.sqlite");

    try {
      // Restore database
      const targetDatabasePath = databaseProvider.getPath();
      if (fs.existsSync(snapshotDatabasePath)) {
        // Ensure parent directory exists
        const targetDir = path.dirname(targetDatabasePath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.copyFileSync(snapshotDatabasePath, targetDatabasePath);
      }

      // Clear and restore browser state
      await browserStateProvider.clearLocalStorage();
      await browserStateProvider.clearCookies();

      await browserStateProvider.setLocalStorage(checkpoint.browserState.localStorage);
      await browserStateProvider.setCookies(checkpoint.browserState.cookies);
    } catch (error) {
      if (error instanceof CheckpointManagerError) {
        throw error;
      }

      throw new CheckpointManagerError(
        `Failed to restore checkpoint: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR"
      );
    }
  }

  /**
   * List all checkpoints for a sandbox
   */
  async list(sandboxId: string): Promise<Checkpoint[]> {
    const sandboxDir = this.getSandboxDir(sandboxId);

    if (!fs.existsSync(sandboxDir)) {
      return [];
    }

    try {
      const entries = fs.readdirSync(sandboxDir, { withFileTypes: true });
      const checkpoints: Checkpoint[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const statePath = path.join(sandboxDir, entry.name, "state.json");
        if (!fs.existsSync(statePath)) {
          continue;
        }

        try {
          const content = fs.readFileSync(statePath, "utf-8");
          const checkpoint = JSON.parse(content) as Checkpoint;
          // Ensure createdAt is a Date object
          checkpoint.createdAt = new Date(checkpoint.createdAt);
          checkpoints.push(checkpoint);
        } catch {
          // Skip invalid checkpoint files
          continue;
        }
      }

      // Sort by creation date (newest first)
      checkpoints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return checkpoints;
    } catch (error) {
      throw new CheckpointManagerError(
        `Failed to list checkpoints: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR"
      );
    }
  }

  /**
   * Delete a checkpoint
   */
  async delete(sandboxId: string, checkpointId: string): Promise<void> {
    // Find the checkpoint to get its name
    const checkpoint = await this.findCheckpointById(sandboxId, checkpointId);

    if (!checkpoint) {
      throw new CheckpointManagerError(
        `Checkpoint '${checkpointId}' not found`,
        "NOT_FOUND"
      );
    }

    const checkpointDir = this.getCheckpointDir(sandboxId, checkpoint.name);

    try {
      fs.rmSync(checkpointDir, { recursive: true, force: true });
    } catch (error) {
      throw new CheckpointManagerError(
        `Failed to delete checkpoint: ${error instanceof Error ? error.message : String(error)}`,
        "IO_ERROR"
      );
    }
  }

  /**
   * Get a checkpoint by name
   */
  async getByName(sandboxId: string, name: string): Promise<Checkpoint | null> {
    const checkpointDir = this.getCheckpointDir(sandboxId, name);
    const statePath = path.join(checkpointDir, "state.json");

    if (!fs.existsSync(statePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(statePath, "utf-8");
      const checkpoint = JSON.parse(content) as Checkpoint;
      checkpoint.createdAt = new Date(checkpoint.createdAt);
      return checkpoint;
    } catch {
      return null;
    }
  }

  /**
   * Create the initial checkpoint for a sandbox
   */
  async createInitial(
    sandboxId: string,
    browserStateProvider: BrowserStateProvider,
    databaseProvider: DatabaseProvider
  ): Promise<Checkpoint> {
    return this.create(sandboxId, "initial", browserStateProvider, databaseProvider);
  }

  /**
   * Restore to the initial checkpoint
   */
  async restoreInitial(
    sandboxId: string,
    browserStateProvider: BrowserStateProvider,
    databaseProvider: DatabaseProvider
  ): Promise<void> {
    const initialCheckpoint = await this.getByName(sandboxId, "initial");

    if (!initialCheckpoint) {
      throw new CheckpointManagerError(
        `Initial checkpoint not found for sandbox '${sandboxId}'`,
        "NOT_FOUND"
      );
    }

    return this.restore(sandboxId, initialCheckpoint.id, browserStateProvider, databaseProvider);
  }

  /**
   * Get the base directory for a sandbox's checkpoints
   */
  private getSandboxDir(sandboxId: string): string {
    return path.join(this.config.baseDir, sandboxId);
  }

  /**
   * Get the directory for a specific checkpoint
   */
  private getCheckpointDir(sandboxId: string, checkpointName: string): string {
    return path.join(this.getSandboxDir(sandboxId), checkpointName);
  }

  /**
   * Find a checkpoint by its ID
   */
  private async findCheckpointById(
    sandboxId: string,
    checkpointId: string
  ): Promise<Checkpoint | null> {
    const checkpoints = await this.list(sandboxId);
    return checkpoints.find((cp) => cp.id === checkpointId) ?? null;
  }
}
