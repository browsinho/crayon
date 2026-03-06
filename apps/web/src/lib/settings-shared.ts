import { z } from "zod";

// API Keys schema
export const ApiKeysSchema = z.object({
  anchorBrowser: z.string().optional(),
  openai: z.string().optional(),
  anthropic: z.string().optional(),
});

export type ApiKeys = z.infer<typeof ApiKeysSchema>;

// Generation defaults schema
export const GenerationDefaultsSchema = z.object({
  frontend: z.enum(["nextjs", "react", "vue"]).default("nextjs"),
  styling: z.enum(["tailwind", "css-modules"]).default("tailwind"),
  backend: z.enum(["express", "fastify", "hono"]).default("express"),
  database: z.enum(["sqlite", "postgres"]).default("sqlite"),
  includeSampleData: z.boolean().default(true),
  downloadAssets: z.boolean().default(true),
});

export type GenerationDefaults = z.infer<typeof GenerationDefaultsSchema>;

// Storage settings schema
export const StorageSettingsSchema = z.object({
  projectsDir: z.string().default("./data/projects"),
  recordingsDir: z.string().default("./data/recordings"),
  sandboxesDir: z.string().default("./data/sandboxes"),
  cacheDir: z.string().default("./data/cache"),
});

export type StorageSettings = z.infer<typeof StorageSettingsSchema>;

// Appearance settings schema
export const AppearanceSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
});

export type AppearanceSettings = z.infer<typeof AppearanceSettingsSchema>;

// Docker settings schema
export const DockerSettingsSchema = z.object({
  host: z.string().default("unix:///var/run/docker.sock"),
});

export type DockerSettings = z.infer<typeof DockerSettingsSchema>;

// Complete settings schema
export const SettingsSchema = z.object({
  apiKeys: ApiKeysSchema.default({}),
  generation: GenerationDefaultsSchema.default({}),
  storage: StorageSettingsSchema.default({}),
  appearance: AppearanceSettingsSchema.default({}),
  docker: DockerSettingsSchema.default({}),
});

export type Settings = z.infer<typeof SettingsSchema>;

// Storage usage schema
export const StorageUsageSchema = z.object({
  total: z.number(),
  used: z.number(),
  projects: z.number(),
  recordings: z.number(),
  sandboxes: z.number(),
  cache: z.number(),
});

export type StorageUsage = z.infer<typeof StorageUsageSchema>;

// Docker status schema
export const DockerStatusSchema = z.object({
  running: z.boolean(),
  version: z.string().optional(),
  containers: z.number().default(0),
  images: z.number().default(0),
});

export type DockerStatus = z.infer<typeof DockerStatusSchema>;

// API key test result schema
export const ApiKeyTestResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export type ApiKeyTestResult = z.infer<typeof ApiKeyTestResultSchema>;

// Format bytes to human-readable string (client-safe utility)
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}
