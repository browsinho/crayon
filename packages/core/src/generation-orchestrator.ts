/**
 * Generation Orchestrator - End-to-end orchestration of recording-to-website pipeline
 *
 * Coordinates all generation steps:
 * 1. Load recording
 * 2. Clean recording
 * 3. Summarize recording
 * 4. Build prompt
 * 5. Generate code (frontend)
 * 6. Write files to disk
 * 7. Build Docker image (optional)
 * 8. Deploy sandbox (optional)
 */

import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { ProjectStorage } from "./project-storage.js";
import { clean, type CleanedRecording } from "./recording-cleaner.js";
import { summarize, type RecordingSummary } from "./recording-summarizer.js";
import { build, type GenerationPrompt } from "./prompt-builder.js";
import { generate, type GenerationResult } from "./lovable-adapter.js";

// ============================================================================
// Schemas & Types
// ============================================================================

export const PipelineStageSchema = z.enum([
  "cleaning",
  "summarizing",
  "prompt_building",
  "code_generation",
  "validation",
  "file_writing",
  "backend_generation",
  "data_generation",
  "docker_build",
  "deployment",
]);
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const PipelineEventStatusSchema = z.enum([
  "started",
  "progress",
  "completed",
  "failed",
]);
export type PipelineEventStatus = z.infer<typeof PipelineEventStatusSchema>;

export const PipelineEventSchema = z.object({
  stage: PipelineStageSchema,
  status: PipelineEventStatusSchema,
  message: z.string(),
  progress: z.number().min(0).max(100).optional(),
  timestamp: z.number(),
});
export type PipelineEvent = z.infer<typeof PipelineEventSchema>;

export const GenerationConfigSchema = z.object({
  recordingId: z.string(),
  projectId: z.string(),
  llmProvider: z.enum(["anthropic", "openai", "google", "groq"]),
  llmModel: z.string().optional(),
  apiKey: z.string(),
  includeBackend: z.boolean().default(false),
  includeMockData: z.boolean().default(false),
  onProgress: z
    .function()
    .args(PipelineEventSchema)
    .returns(z.void())
    .optional(),
});
export type GenerationConfig = z.infer<typeof GenerationConfigSchema>;

export const GenerationOutputSchema = z.object({
  projectId: z.string(),
  sandboxPath: z.string(),
  dockerImageId: z.string().optional(),
  url: z.string().optional(),
  logs: z.array(PipelineEventSchema),
  errors: z.array(z.string()),
});
export type GenerationOutput = z.infer<typeof GenerationOutputSchema>;

export const CheckpointSchema = z.object({
  projectId: z.string(),
  recordingId: z.string(),
  currentStage: PipelineStageSchema,
  completedStages: z.array(PipelineStageSchema),
  timestamp: z.number(),
  metadata: z.record(z.unknown()),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a generation directory structure
 */
function createGenerationDir(projectId: string): string {
  const baseDir = "./data/projects";
  const projectDir = path.join(baseDir, projectId);
  const genDir = path.join(projectDir, "generation");

  if (!fs.existsSync(genDir)) {
    fs.mkdirSync(genDir, { recursive: true });
  }

  return genDir;
}

/**
 * Save checkpoint to disk
 */
function saveCheckpoint(checkpoint: Checkpoint): void {
  const genDir = createGenerationDir(checkpoint.projectId);
  const checkpointPath = path.join(genDir, "checkpoint.json");
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

/**
 * Load checkpoint from disk (reserved for future resume functionality)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _loadCheckpoint(projectId: string): Checkpoint | null {
  const genDir = createGenerationDir(projectId);
  const checkpointPath = path.join(genDir, "checkpoint.json");

  if (!fs.existsSync(checkpointPath)) {
    return null;
  }

  const content = fs.readFileSync(checkpointPath, "utf-8");
  return JSON.parse(content) as Checkpoint;
}

/**
 * Save cleaned recording to checkpoint directory
 */
function saveCleanedRecording(
  projectId: string,
  cleaned: CleanedRecording
): void {
  const genDir = createGenerationDir(projectId);
  const cleanedPath = path.join(genDir, "01-cleaned.json");
  fs.writeFileSync(cleanedPath, JSON.stringify(cleaned, null, 2));
}

/**
 * Load cleaned recording from checkpoint directory (reserved for future resume functionality)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _loadCleanedRecording(projectId: string): CleanedRecording | null {
  const genDir = createGenerationDir(projectId);
  const cleanedPath = path.join(genDir, "01-cleaned.json");

  if (!fs.existsSync(cleanedPath)) {
    return null;
  }

  const content = fs.readFileSync(cleanedPath, "utf-8");
  return JSON.parse(content) as CleanedRecording;
}

/**
 * Save recording summary to checkpoint directory
 */
function saveSummary(projectId: string, summary: RecordingSummary): void {
  const genDir = createGenerationDir(projectId);
  const summaryPath = path.join(genDir, "02-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
}

/**
 * Load recording summary from checkpoint directory (reserved for future resume functionality)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _loadSummary(projectId: string): RecordingSummary | null {
  const genDir = createGenerationDir(projectId);
  const summaryPath = path.join(genDir, "02-summary.json");

  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  const content = fs.readFileSync(summaryPath, "utf-8");
  return JSON.parse(content) as RecordingSummary;
}

/**
 * Save generation prompt to checkpoint directory
 */
function savePrompt(projectId: string, prompt: GenerationPrompt): void {
  const genDir = createGenerationDir(projectId);
  const promptPath = path.join(genDir, "03-prompt.json");
  fs.writeFileSync(promptPath, JSON.stringify(prompt, null, 2));
}

/**
 * Load generation prompt from checkpoint directory (reserved for future resume functionality)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _loadPrompt(projectId: string): GenerationPrompt | null {
  const genDir = createGenerationDir(projectId);
  const promptPath = path.join(genDir, "03-prompt.json");

  if (!fs.existsSync(promptPath)) {
    return null;
  }

  const content = fs.readFileSync(promptPath, "utf-8");
  return JSON.parse(content) as GenerationPrompt;
}

/**
 * Save generated code to checkpoint directory
 */
function saveGeneratedCode(projectId: string, result: GenerationResult): void {
  const genDir = createGenerationDir(projectId);
  const codeDir = path.join(genDir, "04-code");

  if (!fs.existsSync(codeDir)) {
    fs.mkdirSync(codeDir, { recursive: true });
  }

  // Save all generated files
  for (const file of result.files) {
    const filePath = path.join(codeDir, file.path);
    const fileDir = path.dirname(filePath);

    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    fs.writeFileSync(filePath, file.content);
  }

  // Save metadata
  const metadataPath = path.join(codeDir, "metadata.json");
  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        packages: result.packages,
        components: result.components,
        warnings: result.warnings,
        metadata: result.metadata,
      },
      null,
      2
    )
  );
}

/**
 * Append event to logs file
 */
function appendLog(projectId: string, event: PipelineEvent): void {
  const genDir = createGenerationDir(projectId);
  const logsPath = path.join(genDir, "logs.jsonl");
  fs.appendFileSync(logsPath, JSON.stringify(event) + "\n");
}

/**
 * Load all logs from logs file (reserved for future debugging/analysis features)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _loadLogs(projectId: string): PipelineEvent[] {
  const genDir = createGenerationDir(projectId);
  const logsPath = path.join(genDir, "logs.jsonl");

  if (!fs.existsSync(logsPath)) {
    return [];
  }

  const content = fs.readFileSync(logsPath, "utf-8");
  const lines = content.trim().split("\n");
  return lines
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as PipelineEvent);
}

/**
 * Write generated files to project sandbox directory
 */
function writeFilesToSandbox(
  projectId: string,
  files: GenerationResult["files"]
): string {
  const baseDir = "./data/projects";
  const sandboxDir = path.join(baseDir, projectId, "sandbox");

  // Clean existing sandbox directory
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }

  fs.mkdirSync(sandboxDir, { recursive: true });

  // Write all files
  for (const file of files) {
    const filePath = path.join(sandboxDir, file.path);
    const fileDir = path.dirname(filePath);

    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    fs.writeFileSync(filePath, file.content);
  }

  return sandboxDir;
}

/**
 * Create package.json for the generated project
 */
function createPackageJson(
  sandboxDir: string,
  packages: string[],
  projectName: string
): void {
  const packageJson = {
    name: projectName,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      ...Object.fromEntries(packages.map((pkg) => [pkg, "latest"])),
    },
    devDependencies: {
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
      "@vitejs/plugin-react": "^4.3.4",
      autoprefixer: "^10.4.20",
      postcss: "^8.4.49",
      tailwindcss: "^3.4.17",
      typescript: "^5.7.3",
      vite: "^6.0.5",
    },
  };

  const packageJsonPath = path.join(sandboxDir, "package.json");
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

/**
 * Create basic Vite config files
 */
function createViteConfig(sandboxDir: string): void {
  // vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
})
`;

  fs.writeFileSync(path.join(sandboxDir, "vite.config.ts"), viteConfig);

  // tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: "ES2020",
      useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
    },
    include: ["src"],
  };

  fs.writeFileSync(
    path.join(sandboxDir, "tsconfig.json"),
    JSON.stringify(tsConfig, null, 2)
  );

  // tailwind.config.js
  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;

  fs.writeFileSync(path.join(sandboxDir, "tailwind.config.js"), tailwindConfig);

  // postcss.config.js
  const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

  fs.writeFileSync(path.join(sandboxDir, "postcss.config.js"), postcssConfig);

  // index.html
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated Website</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  fs.writeFileSync(path.join(sandboxDir, "index.html"), indexHtml);
}

/**
 * Create the ImageWithFallback utility component for handling missing/broken images
 */
function createImageWithFallback(sandboxDir: string): void {
  const componentDir = path.join(sandboxDir, "src", "components", "ui");
  if (!fs.existsSync(componentDir)) {
    fs.mkdirSync(componentDir, { recursive: true });
  }

  const componentContent = `import { useState, useCallback } from 'react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
}

export function ImageWithFallback({
  src,
  alt = '',
  className = '',
  fallbackClassName = '',
  ...props
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const showPlaceholder = !src || hasError;

  if (showPlaceholder) {
    return (
      <div
        className={\`flex items-center justify-center bg-gray-100 \${className} \${fallbackClassName}\`}
        role="img"
        aria-label={alt || 'Image placeholder'}
      >
        <svg
          className="w-12 h-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      {...props}
    />
  );
}

export default ImageWithFallback;
`;

  fs.writeFileSync(
    path.join(componentDir, "ImageWithFallback.tsx"),
    componentContent
  );
}

// ============================================================================
// Main Orchestration Functions
// ============================================================================

/**
 * Orchestrate full generation pipeline
 */
export async function orchestrate(
  config: GenerationConfig
): Promise<GenerationOutput> {
  const logs: PipelineEvent[] = [];
  const errors: string[] = [];

  // Helper to emit and log events
  const emitEvent = (event: PipelineEvent) => {
    logs.push(event);
    appendLog(config.projectId, event);
    if (config.onProgress) {
      config.onProgress(event);
    }
  };

  // Initialize checkpoint
  const checkpoint: Checkpoint = {
    projectId: config.projectId,
    recordingId: config.recordingId,
    currentStage: "cleaning",
    completedStages: [],
    timestamp: Date.now(),
    metadata: {},
  };

  try {
    // ========================================================================
    // Stage 1: Load Recording
    // ========================================================================
    const projectStorage = new ProjectStorage({
      baseDir: "./data/projects",
    });
    const recording = await projectStorage.getRecording(config.projectId);
    if (!recording) {
      throw new GenerationOrchestratorError(
        `Recording not found for project: ${config.projectId}`,
        "cleaning"
      );
    }

    // ========================================================================
    // Stage 2: Clean Recording
    // ========================================================================
    emitEvent({
      stage: "cleaning",
      status: "started",
      message: "Cleaning recording data...",
      timestamp: Date.now(),
    });

    const cleanedRecording = await clean(recording);
    saveCleanedRecording(config.projectId, cleanedRecording);

    const reductionPct = Math.round(
      ((cleanedRecording.metadata.originalTokenCount -
        cleanedRecording.metadata.cleanedTokenCount) /
        cleanedRecording.metadata.originalTokenCount) *
        100
    );

    emitEvent({
      stage: "cleaning",
      status: "completed",
      message: `Recording cleaned: ${cleanedRecording.metadata.originalTokenCount} → ${cleanedRecording.metadata.cleanedTokenCount} tokens (${reductionPct}% reduction)`,
      progress: 100,
      timestamp: Date.now(),
    });

    checkpoint.completedStages.push("cleaning");
    checkpoint.currentStage = "summarizing";
    saveCheckpoint(checkpoint);

    // ========================================================================
    // Stage 3: Summarize Recording
    // ========================================================================
    emitEvent({
      stage: "summarizing",
      status: "started",
      message: "Analyzing recording and generating summary...",
      timestamp: Date.now(),
    });

    const summary = await summarize(recording);
    saveSummary(config.projectId, summary);

    emitEvent({
      stage: "summarizing",
      status: "completed",
      message: `Summary generated: ${summary.description}`,
      progress: 100,
      timestamp: Date.now(),
    });

    checkpoint.completedStages.push("summarizing");
    checkpoint.currentStage = "prompt_building";
    saveCheckpoint(checkpoint);

    // ========================================================================
    // Stage 4: Build Prompt
    // ========================================================================
    emitEvent({
      stage: "prompt_building",
      status: "started",
      message: "Building AI prompt...",
      timestamp: Date.now(),
    });

    const prompt = await build(cleanedRecording, summary);
    savePrompt(config.projectId, prompt);

    emitEvent({
      stage: "prompt_building",
      status: "completed",
      message: `Prompt built: ${prompt.metadata.totalTokens} tokens (~$${prompt.metadata.estimatedCost.toFixed(4)})`,
      progress: 100,
      timestamp: Date.now(),
    });

    checkpoint.completedStages.push("prompt_building");
    checkpoint.currentStage = "code_generation";
    saveCheckpoint(checkpoint);

    // ========================================================================
    // Stage 5: Generate Code
    // ========================================================================
    emitEvent({
      stage: "code_generation",
      status: "started",
      message: `Generating code using ${config.llmProvider}...`,
      timestamp: Date.now(),
    });

    const generationResult = await generate({
      prompt,
      provider: config.llmProvider,
      model: config.llmModel,
      apiKey: config.apiKey,
      onProgress: (event) => {
        if (event.type === "file") {
          emitEvent({
            stage: "code_generation",
            status: "progress",
            message: `Generated file: ${event.data}`,
            timestamp: Date.now(),
          });
        } else if (event.type === "status") {
          const data = event.data as { message: string };
          if (data.message.includes("Retrying") || data.message.includes("Incomplete")) {
            emitEvent({
              stage: "code_generation",
              status: "progress",
              message: data.message,
              timestamp: Date.now(),
            });
          }
        }
      },
      // Provide callbacks to build reduced/minimal prompts for retry attempts
      buildReducedPrompt: async () => {
        emitEvent({
          stage: "code_generation",
          status: "progress",
          message: "Building reduced prompt for retry...",
          timestamp: Date.now(),
        });
        return build(cleanedRecording, summary, undefined, { reductionLevel: 'reduced' });
      },
      buildMinimalPrompt: async () => {
        emitEvent({
          stage: "code_generation",
          status: "progress",
          message: "Building minimal prompt for retry...",
          timestamp: Date.now(),
        });
        return build(cleanedRecording, summary, undefined, { reductionLevel: 'minimal' });
      },
    });

    saveGeneratedCode(config.projectId, generationResult);

    // Check for critical warnings that prevent sandbox building
    // Fail fast here instead of letting broken files be written to sandbox
    const unresolvedImports = generationResult.warnings.filter((w) =>
      w.startsWith("Unresolved import")
    );

    if (unresolvedImports.length > 0) {
      const details = unresolvedImports.map((w) => `  - ${w}`).join("\n");
      throw new GenerationOrchestratorError(
        `Code generation incomplete after all retry attempts. ` +
          `The LLM did not generate all required files.\n${details}\n\n` +
          `Try recording a simpler version of the site with fewer pages.`,
        "code_generation"
      );
    }

    emitEvent({
      stage: "code_generation",
      status: "completed",
      message: `Code generation completed: ${generationResult.files.length} files, ${generationResult.packages.length} packages`,
      progress: 100,
      timestamp: Date.now(),
    });

    // Log warnings (non-critical ones only, since unresolved imports already handled above)
    for (const warning of generationResult.warnings) {
      errors.push(warning);
      emitEvent({
        stage: "code_generation",
        status: "progress",
        message: `Warning: ${warning}`,
        timestamp: Date.now(),
      });
    }

    checkpoint.completedStages.push("code_generation");
    checkpoint.currentStage = "validation";
    saveCheckpoint(checkpoint);

    // ========================================================================
    // Stage 6: Validation (basic)
    // ========================================================================
    emitEvent({
      stage: "validation",
      status: "started",
      message: "Validating generated code...",
      timestamp: Date.now(),
    });

    // Basic validation - check that we have at least one file
    if (generationResult.files.length === 0) {
      throw new Error("No files were generated");
    }

    emitEvent({
      stage: "validation",
      status: "completed",
      message: "Validation passed",
      progress: 100,
      timestamp: Date.now(),
    });

    checkpoint.completedStages.push("validation");
    checkpoint.currentStage = "file_writing";
    saveCheckpoint(checkpoint);

    // ========================================================================
    // Stage 7: Write Files to Disk
    // ========================================================================
    emitEvent({
      stage: "file_writing",
      status: "started",
      message: "Writing files to disk...",
      timestamp: Date.now(),
    });

    const sandboxPath = writeFilesToSandbox(
      config.projectId,
      generationResult.files
    );

    // Get project details for package.json
    const project = await projectStorage.get(config.projectId);
    const projectName = project?.name || "generated-website";

    // Create package.json and config files
    createPackageJson(sandboxPath, generationResult.packages, projectName);
    createViteConfig(sandboxPath);
    createImageWithFallback(sandboxPath);

    emitEvent({
      stage: "file_writing",
      status: "completed",
      message: `Files written to ${sandboxPath}`,
      progress: 100,
      timestamp: Date.now(),
    });

    checkpoint.completedStages.push("file_writing");
    saveCheckpoint(checkpoint);

    // ========================================================================
    // Final Output
    // ========================================================================
    // Docker build and deployment now happen on-demand when the user
    // clicks "Start Sandbox" in the UI, not during generation.
    return {
      projectId: config.projectId,
      sandboxPath,
      logs,
      errors,
    };
  } catch (error) {
    // Handle errors
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    emitEvent({
      stage: checkpoint.currentStage,
      status: "failed",
      message: `Error: ${errorMessage}`,
      timestamp: Date.now(),
    });

    // Save checkpoint on error
    saveCheckpoint(checkpoint);

    throw new GenerationOrchestratorError(
      `Pipeline failed at stage ${checkpoint.currentStage}: ${errorMessage}`,
      checkpoint.currentStage,
      error
    );
  }
}

/**
 * Stream version of orchestrate
 */
export async function* orchestrateStream(
  config: GenerationConfig
): AsyncGenerator<PipelineEvent> {
  // Create a modified config with onProgress that yields events
  const events: PipelineEvent[] = [];
  let orchestrationComplete = false;
  let orchestrationError: Error | null = null;

  const modifiedConfig: GenerationConfig = {
    ...config,
    onProgress: (event) => {
      events.push(event);
    },
  };

  // Run orchestration in the background
  const outputPromise = orchestrate(modifiedConfig)
    .then(() => {
      orchestrationComplete = true;
    })
    .catch((error) => {
      orchestrationError = error;
      orchestrationComplete = true;
    });

  try {
    // Yield events as they come in
    while (!orchestrationComplete || events.length > 0) {
      if (events.length > 0) {
        const event = events.shift()!;
        yield event;
      } else {
        // Small delay to allow events to accumulate
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    // Wait for orchestration to complete and check for errors
    await outputPromise;

    // If there was an error, throw it
    if (orchestrationError) {
      throw orchestrationError;
    }
  } catch (error) {
    // Yield any remaining events
    while (events.length > 0) {
      yield events.shift()!;
    }
    throw error;
  }
}

// ============================================================================
// Error Class
// ============================================================================

export class GenerationOrchestratorError extends Error {
  public readonly stage: PipelineStage;
  public readonly cause?: unknown;

  constructor(message: string, stage: PipelineStage, cause?: unknown) {
    super(message);
    this.name = "GenerationOrchestratorError";
    this.stage = stage;
    this.cause = cause;
  }
}
