import express from "express";
import cors from "cors";
import { createMcpRouter, createToolRegistry, createSandboxManager } from "@crayon/core";
import { loadConfig } from "./config.js";
import { resolveSandbox } from "./sandbox-resolver.js";
import { validateApiKey } from "./api-keys.js";

async function main() {
  const config = loadConfig();
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // Initialize sandbox manager
  const sandboxManager = createSandboxManager();

  // Create tool registry
  const toolRegistry = createToolRegistry();

  // MCP routes
  const mcpRouter = createMcpRouter({
    sandboxResolver: (sandboxId) =>
      resolveSandbox(sandboxId, config.dataDir, sandboxManager),
    apiKeyValidator: (key) => validateApiKey(key, config.dataDir),
    toolRegistry,
    onToolCall: (event) => {
      console.log(
        `[MCP] ${event.timestamp.toISOString()} - ${event.toolName} (${event.sandboxId})`
      );
    },
  });

  app.use("/mcp", mcpRouter);

  // Start server
  const server = app.listen(config.port, config.host, () => {
    console.log(`MCP Server running at http://${config.host}:${config.port}`);
    console.log(`Health: http://localhost:${config.port}/health`);
    console.log(`MCP endpoint: http://localhost:${config.port}/mcp/{sandboxId}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("Shutting down...");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
