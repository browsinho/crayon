import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve to apps/web/data — the canonical data directory written by the web app
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../web/data");

export interface McpServerAppConfig {
  port: number;
  host: string;
  dataDir: string;
  logLevel: string;
}

export function loadConfig(): McpServerAppConfig {
  return {
    port: parseInt(process.env.MCP_PORT || "3002", 10),
    host: process.env.MCP_HOST || "0.0.0.0",
    dataDir: process.env.DATA_DIR || DEFAULT_DATA_DIR,
    logLevel: process.env.LOG_LEVEL || "info",
  };
}
