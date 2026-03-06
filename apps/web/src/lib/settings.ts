import * as fs from "fs/promises";
import * as path from "path";

// Re-export all shared types and utilities (client-safe)
export * from "./settings-shared";

// Import what we need from shared for this file
import {
  SettingsSchema,
  type Settings,
  type ApiKeys,
  type StorageUsage,
  type DockerStatus,
  type ApiKeyTestResult,
} from "./settings-shared";

// Settings file path
const SETTINGS_FILE = "./data/settings.json";

// Get settings from file
export async function getSettings(): Promise<Settings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return SettingsSchema.parse(parsed);
  } catch {
    // Return defaults if file doesn't exist or is invalid
    return SettingsSchema.parse({});
  }
}

// Update settings
export async function updateSettings(
  updates: Partial<Settings>
): Promise<Settings> {
  const current = await getSettings();
  const merged = {
    ...current,
    ...updates,
    apiKeys: { ...current.apiKeys, ...updates.apiKeys },
    generation: { ...current.generation, ...updates.generation },
    storage: { ...current.storage, ...updates.storage },
    appearance: { ...current.appearance, ...updates.appearance },
    docker: { ...current.docker, ...updates.docker },
  };

  const validated = SettingsSchema.parse(merged);

  // Ensure directory exists
  const dir = path.dirname(SETTINGS_FILE);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(SETTINGS_FILE, JSON.stringify(validated, null, 2));
  return validated;
}

// Update a single API key
export async function updateApiKey(
  service: keyof ApiKeys,
  value: string
): Promise<Settings> {
  const current = await getSettings();
  return updateSettings({
    apiKeys: {
      ...current.apiKeys,
      [service]: value,
    },
  });
}

// Calculate directory size
async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return stats.size;
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let totalSize = 0;

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(entryPath);
      } else {
        const entryStats = await fs.stat(entryPath);
        totalSize += entryStats.size;
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

// Get storage usage
export async function getStorageUsage(): Promise<StorageUsage> {
  const settings = await getSettings();

  const [projects, recordings, sandboxes, cache] = await Promise.all([
    getDirectorySize(settings.storage.projectsDir),
    getDirectorySize(settings.storage.recordingsDir),
    getDirectorySize(settings.storage.sandboxesDir),
    getDirectorySize(settings.storage.cacheDir),
  ]);

  const used = projects + recordings + sandboxes + cache;

  // Assume 10GB total for now (can be made configurable)
  const total = 10 * 1024 * 1024 * 1024;

  return {
    total,
    used,
    projects,
    recordings,
    sandboxes,
    cache,
  };
}

// Clear cache
export async function clearCache(): Promise<void> {
  const settings = await getSettings();
  try {
    await fs.rm(settings.storage.cacheDir, { recursive: true, force: true });
    await fs.mkdir(settings.storage.cacheDir, { recursive: true });
  } catch {
    // Ignore errors
  }
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const settings = await getSettings();
  await Promise.all([
    fs
      .rm(settings.storage.projectsDir, { recursive: true, force: true })
      .catch(() => {}),
    fs
      .rm(settings.storage.recordingsDir, { recursive: true, force: true })
      .catch(() => {}),
    fs
      .rm(settings.storage.sandboxesDir, { recursive: true, force: true })
      .catch(() => {}),
    fs
      .rm(settings.storage.cacheDir, { recursive: true, force: true })
      .catch(() => {}),
  ]);

  // Recreate directories
  await Promise.all([
    fs.mkdir(settings.storage.projectsDir, { recursive: true }),
    fs.mkdir(settings.storage.recordingsDir, { recursive: true }),
    fs.mkdir(settings.storage.sandboxesDir, { recursive: true }),
    fs.mkdir(settings.storage.cacheDir, { recursive: true }),
  ]);
}

// Test API key
export async function testApiKey(
  service: keyof ApiKeys,
  key: string
): Promise<ApiKeyTestResult> {
  try {
    switch (service) {
      case "anchorBrowser": {
        // Test AnchorBrowser API key
        const response = await fetch("https://api.anchorbrowser.io/v1/status", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${key}`,
          },
        });
        if (!response.ok) {
          return { success: false, error: "Invalid API key" };
        }
        return { success: true };
      }

      case "openai": {
        // Test OpenAI API key
        const response = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${key}`,
          },
        });
        if (!response.ok) {
          return { success: false, error: "Invalid API key" };
        }
        return { success: true };
      }

      case "anthropic": {
        // Test Anthropic API key by listing models
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1,
            messages: [{ role: "user", content: "Hi" }],
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            success: false,
            error:
              (data as { error?: { message?: string } }).error?.message ||
              "Invalid API key",
          };
        }
        return { success: true };
      }

      default:
        return { success: false, error: "Unknown service" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

// Get Docker status
export async function getDockerStatus(): Promise<DockerStatus> {
  try {
    // Try to get Docker info via the daemon socket
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      const { stdout: versionOutput } = await execAsync(
        "docker version --format '{{.Server.Version}}'"
      );
      const version = versionOutput.trim();

      const { stdout: containersOutput } = await execAsync(
        "docker ps -q | wc -l"
      );
      const containers = parseInt(containersOutput.trim(), 10) || 0;

      const { stdout: imagesOutput } = await execAsync("docker images -q | wc -l");
      const images = parseInt(imagesOutput.trim(), 10) || 0;

      return {
        running: true,
        version,
        containers,
        images,
      };
    } catch {
      return {
        running: false,
        containers: 0,
        images: 0,
      };
    }
  } catch {
    return {
      running: false,
      containers: 0,
      images: 0,
    };
  }
}

// Stop all Docker containers
export async function stopAllContainers(): Promise<void> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    await execAsync("docker stop $(docker ps -q)");
  } catch {
    // Ignore errors (e.g., no containers running)
  }
}

// Prune Docker resources
export async function pruneDocker(): Promise<void> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    await execAsync("docker system prune -f");
  } catch {
    // Ignore errors
  }
}
