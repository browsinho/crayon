/**
 * @crayon/core - Core functionality for the Crayon sandbox builder
 *
 * This package provides the main implementation modules:
 * - recording: Browser session management, DOM/network/screenshot capture
 * - analysis: Framework detection, API route extraction, schema inference
 * - generation: Frontend/backend code generation, asset downloading
 * - sandbox: Container management and checkpointing
 */

// Re-export types for convenience
export * from "@crayon/types";

// Browser session management
export {
  BrowserSessionManager,
  BrowserSessionError,
  createSession,
} from "./browser-session.js";
export type { BrowserSessionConfig } from "./browser-session.js";

// DOM capture
export { DOMCapture, DOMCaptureError, createDOMCapture } from "./dom-capture.js";
export type { CDPSession, DOMCaptureConfig } from "./dom-capture.js";

// Network capture
export {
  NetworkCapture,
  NetworkCaptureError,
  createNetworkCapture,
} from "./network-capture.js";
export type { NetworkCaptureConfig } from "./network-capture.js";

// Screenshot capture
export {
  ScreenshotCapture,
  ScreenshotCaptureError,
  createScreenshotCapture,
} from "./screenshot-capture.js";
export type { ScreenshotCaptureConfig } from "./screenshot-capture.js";

// User event capture
export {
  UserEventCapture,
  UserEventCaptureError,
  createUserEventCapture,
} from "./user-event-capture.js";
export type { UserEventCaptureConfig } from "./user-event-capture.js";

// Event correlator
export {
  EventCorrelator,
  createEventCorrelator,
} from "./event-correlator.js";
export type { CorrelationConfig } from "./event-correlator.js";

// State change classifier
export {
  StateChangeClassifier,
  createStateChangeClassifier,
} from "./state-change-classifier.js";
export type { ClassificationResult } from "./state-change-classifier.js";

// Page detector
export {
  PageDetector,
  createPageDetector,
  detectPagesFromSnapshots,
} from "./page-detector.js";
export type { PageDetectorConfig } from "./page-detector.js";

// PII Anonymizer
export { anonymize, anonymizeJson, anonymizeDom, hasPii } from "./pii-anonymizer.js";

// Recording cleaner
export { clean as cleanRecording } from "./recording-cleaner.js";
export type {
  CleanedRecording,
  CleanedDOMSnapshot,
  CleanedNetworkRequest,
  CleanedRecordingMetadata,
} from "./recording-cleaner.js";

// Recording summarizer
export { summarize as summarizeRecording } from "./recording-summarizer.js";

// Prompt builder
export { build as buildPrompt } from "./prompt-builder.js";
export type {
  GenerationPrompt,
  GenerationPromptContext,
  GenerationPromptMetadata,
} from "./prompt-builder.js";

// Framework detector
export { detect as detectFramework } from "./framework-detector.js";

// Recording storage
export {
  RecordingStorage,
  RecordingStorageError,
  createRecordingStorage,
} from "./recording-storage.js";
export type { RecordingStorageConfig } from "./recording-storage.js";

// API route extractor
export { extract as extractApiRoutes, parameterizePath } from "./api-route-extractor.js";

// Schema inferrer
export { infer as inferSchemas } from "./schema-inferrer.js";

// Auth detector
export { detect as detectAuth } from "./auth-detector.js";

// Widget detector
export { detect as detectWidgets } from "./widget-detector.js";

// Frontend generator
export { generate as generateFrontend } from "./frontend-generator.js";
export type {
  GeneratedFile,
  GeneratedFrontend,
  GeneratedRoute,
} from "./frontend-generator.js";

// Backend generator
export { generate as generateBackend } from "./backend-generator.js";
export type {
  GeneratedBackend,
  GeneratedBackendFile,
} from "./backend-generator.js";

// Data generator
export { generate as generateData, generateAll as generateAllData } from "./data-generator.js";
export type { GenerationRequest } from "./data-generator.js";

// Asset downloader
export { download as downloadAssets, rewriteUrls } from "./asset-downloader.js";
export type { AssetManifest, AssetEntry, AssetType } from "./asset-downloader.js";

// Docker builder
export {
  build as buildDockerImage,
  generateDockerfile,
  generateCompose,
  startContainer,
  stopContainer,
  removeContainer,
  isDockerAvailable,
  getContainerStatus,
  DockerConfigSchema,
} from "./docker-builder.js";
export type { DockerConfig, BuildResult, ContainerInfo } from "./docker-builder.js";

// Sandbox manager
export {
  SandboxManager,
  SandboxManagerError,
  createSandboxManager,
} from "./sandbox-manager.js";
export type { SandboxManagerConfig, SandboxMode } from "./sandbox-manager.js";

// Sandbox dev container
export {
  DevContainerManagerImpl,
  createDevContainerManager,
  DevContainerConfigSchema,
} from "./sandbox-dev-container.js";
export type {
  DevContainerManager,
  DevContainerConfig,
  DevContainerStatus,
  DevContainerInfo,
  LogEntry,
} from "./sandbox-dev-container.js";

// Sandbox hosting
export {
  SandboxHosting,
  SandboxHostingError,
  createSandboxHosting,
} from "./sandbox-hosting.js";
export type { SandboxHostingConfig } from "./sandbox-hosting.js";

// Checkpoint manager
export {
  CheckpointManager,
  CheckpointManagerError,
  createCheckpointManager,
} from "./checkpoint-manager.js";
export type {
  CheckpointManagerConfig,
  BrowserStateProvider,
  DatabaseProvider,
} from "./checkpoint-manager.js";

// MCP server
export {
  McpServer,
  McpServerError,
  createMcpServer,
} from "./mcp-server.js";
export type {
  McpServerConfig,
  McpServerErrorCode,
  SandboxState,
} from "./mcp-server.js";

// MCP HTTP transport
export { createMcpRouter } from "./mcp-http-transport.js";
export type {
  HttpTransportConfig,
  SandboxInfo,
  ToolCallEvent,
} from "./mcp-http-transport.js";

// MCP tool registry
export { createToolRegistry } from "./mcp-tool-registry.js";
export type { ToolRegistry, ToolDefinition } from "./mcp-tool-registry.js";

// MCP API keys
export { validateApiKey, generateApiKey, getOrCreateApiKey } from "./mcp-api-keys.js";

// MCP code tools
export {
  readFile as mcpReadFile,
  writeFile as mcpWriteFile,
  editFile as mcpEditFile,
  listFiles as mcpListFiles,
  runBuild as mcpRunBuild,
  CODE_TOOL_DEFINITIONS,
  SecurityError as McpSecurityError,
} from "./mcp-code-tools.js";
export type { CodeToolContext, ToolResult as McpToolResult } from "./mcp-code-tools.js";

// Prompt modifier
export {
  process as processPrompt,
  parseCommand,
  parseValue,
  validateCommand,
  generateRecord,
  createMockDataProvider,
  PromptModifierError,
} from "./prompt-modifier.js";
export type {
  PromptResult,
  PromptChange,
  DataProvider,
  EntitySchema,
  PromptModifierErrorCode,
} from "./prompt-modifier.js";

// Project storage
export {
  ProjectStorage,
  ProjectStorageError,
  createProjectStorage,
} from "./project-storage.js";
export type {
  ProjectStorageConfig,
  ProjectStorageErrorCode,
} from "./project-storage.js";

// Lovable adapter
export {
  generate as generateCode,
  generateStream as generateCodeStream,
  parseFiles,
  parsePackages,
  parseComponents,
  detectTruncation,
} from "./lovable-adapter.js";
export type {
  GenerationOptions,
  GenerationEvent,
  GenerationResult,
  GenerationFile,
  GenerationMetadata,
} from "./lovable-adapter.js";

// Generation orchestrator
export {
  orchestrate,
  orchestrateStream,
  GenerationOrchestratorError,
} from "./generation-orchestrator.js";
export type {
  GenerationConfig,
  GenerationOutput,
  PipelineEvent,
  PipelineStage,
  PipelineEventStatus,
  Checkpoint,
} from "./generation-orchestrator.js";

// Code agent
export {
  createCodeAgent,
  validatePath,
  SecurityError,
} from "./code-agent.js";
export type {
  CodeAgent,
  CodeAgentConfig,
  AgentEvent,
  AgentEventType,
  CompileError,
  ChatMessage,
  ToolCall,
  ToolResult,
  AgentResult,
} from "./code-agent.js";
