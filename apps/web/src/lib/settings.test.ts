import { describe, it, expect } from "vitest";
import {
  SettingsSchema,
  ApiKeysSchema,
  GenerationDefaultsSchema,
  StorageSettingsSchema,
  AppearanceSettingsSchema,
  DockerSettingsSchema,
  StorageUsageSchema,
  DockerStatusSchema,
  ApiKeyTestResultSchema,
  formatBytes,
} from "./settings";

describe("Settings Schemas", () => {
  describe("ApiKeysSchema", () => {
    it("should accept empty object", () => {
      const result = ApiKeysSchema.parse({});
      expect(result).toEqual({});
    });

    it("should accept valid API keys", () => {
      const result = ApiKeysSchema.parse({
        anchorBrowser: "key1",
        openai: "key2",
        anthropic: "key3",
      });
      expect(result.anchorBrowser).toBe("key1");
      expect(result.openai).toBe("key2");
      expect(result.anthropic).toBe("key3");
    });

    it("should accept partial keys", () => {
      const result = ApiKeysSchema.parse({
        openai: "key2",
      });
      expect(result.openai).toBe("key2");
      expect(result.anchorBrowser).toBeUndefined();
    });
  });

  describe("GenerationDefaultsSchema", () => {
    it("should use defaults when empty", () => {
      const result = GenerationDefaultsSchema.parse({});
      expect(result.frontend).toBe("nextjs");
      expect(result.styling).toBe("tailwind");
      expect(result.backend).toBe("express");
      expect(result.database).toBe("sqlite");
      expect(result.includeSampleData).toBe(true);
      expect(result.downloadAssets).toBe(true);
    });

    it("should accept valid values", () => {
      const result = GenerationDefaultsSchema.parse({
        frontend: "vue",
        styling: "css-modules",
        backend: "hono",
        database: "postgres",
        includeSampleData: false,
        downloadAssets: false,
      });
      expect(result.frontend).toBe("vue");
      expect(result.styling).toBe("css-modules");
      expect(result.backend).toBe("hono");
      expect(result.database).toBe("postgres");
      expect(result.includeSampleData).toBe(false);
      expect(result.downloadAssets).toBe(false);
    });

    it("should reject invalid framework", () => {
      expect(() =>
        GenerationDefaultsSchema.parse({ frontend: "invalid" })
      ).toThrow();
    });
  });

  describe("StorageSettingsSchema", () => {
    it("should use defaults when empty", () => {
      const result = StorageSettingsSchema.parse({});
      expect(result.projectsDir).toBe("./data/projects");
      expect(result.recordingsDir).toBe("./data/recordings");
      expect(result.sandboxesDir).toBe("./data/sandboxes");
      expect(result.cacheDir).toBe("./data/cache");
    });

    it("should accept custom paths", () => {
      const result = StorageSettingsSchema.parse({
        projectsDir: "/custom/projects",
        recordingsDir: "/custom/recordings",
        sandboxesDir: "/custom/sandboxes",
        cacheDir: "/custom/cache",
      });
      expect(result.projectsDir).toBe("/custom/projects");
    });
  });

  describe("AppearanceSettingsSchema", () => {
    it("should default to system theme", () => {
      const result = AppearanceSettingsSchema.parse({});
      expect(result.theme).toBe("system");
    });

    it("should accept valid themes", () => {
      expect(AppearanceSettingsSchema.parse({ theme: "light" }).theme).toBe("light");
      expect(AppearanceSettingsSchema.parse({ theme: "dark" }).theme).toBe("dark");
      expect(AppearanceSettingsSchema.parse({ theme: "system" }).theme).toBe("system");
    });

    it("should reject invalid theme", () => {
      expect(() => AppearanceSettingsSchema.parse({ theme: "invalid" })).toThrow();
    });
  });

  describe("DockerSettingsSchema", () => {
    it("should use default docker host", () => {
      const result = DockerSettingsSchema.parse({});
      expect(result.host).toBe("unix:///var/run/docker.sock");
    });

    it("should accept custom host", () => {
      const result = DockerSettingsSchema.parse({
        host: "tcp://localhost:2375",
      });
      expect(result.host).toBe("tcp://localhost:2375");
    });
  });

  describe("SettingsSchema", () => {
    it("should use all defaults when empty", () => {
      const result = SettingsSchema.parse({});
      expect(result.apiKeys).toEqual({});
      expect(result.generation.frontend).toBe("nextjs");
      expect(result.storage.projectsDir).toBe("./data/projects");
      expect(result.appearance.theme).toBe("system");
      expect(result.docker.host).toBe("unix:///var/run/docker.sock");
    });

    it("should merge partial settings", () => {
      const result = SettingsSchema.parse({
        apiKeys: { openai: "key" },
        generation: { frontend: "react" },
      });
      expect(result.apiKeys.openai).toBe("key");
      expect(result.generation.frontend).toBe("react");
      expect(result.generation.backend).toBe("express"); // default
    });
  });

  describe("StorageUsageSchema", () => {
    it("should accept valid storage usage", () => {
      const result = StorageUsageSchema.parse({
        total: 10737418240,
        used: 1073741824,
        projects: 536870912,
        recordings: 268435456,
        sandboxes: 134217728,
        cache: 134217728,
      });
      expect(result.total).toBe(10737418240);
      expect(result.used).toBe(1073741824);
    });
  });

  describe("DockerStatusSchema", () => {
    it("should accept running status", () => {
      const result = DockerStatusSchema.parse({
        running: true,
        version: "24.0.0",
        containers: 5,
        images: 10,
      });
      expect(result.running).toBe(true);
      expect(result.version).toBe("24.0.0");
    });

    it("should accept not running status", () => {
      const result = DockerStatusSchema.parse({
        running: false,
      });
      expect(result.running).toBe(false);
      expect(result.containers).toBe(0);
      expect(result.images).toBe(0);
    });
  });

  describe("ApiKeyTestResultSchema", () => {
    it("should accept success result", () => {
      const result = ApiKeyTestResultSchema.parse({ success: true });
      expect(result.success).toBe(true);
    });

    it("should accept failure result with error", () => {
      const result = ApiKeyTestResultSchema.parse({
        success: false,
        error: "Invalid key",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid key");
    });
  });
});

describe("formatBytes", () => {
  it("should format 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("should format bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });

  it("should format gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
    expect(formatBytes(10737418240)).toBe("10 GB");
  });

  it("should format terabytes", () => {
    expect(formatBytes(1099511627776)).toBe("1 TB");
  });
});
