/**
 * Lovable Adapter - Integrates open-lovable's AI code generation into Crayon
 *
 * Adapts open-lovable's code generation components to work with Crayon's
 * recording-based inputs instead of Firecrawl scraping.
 */

import { z } from "zod";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";

// ============================================================================
// Schemas & Types
// ============================================================================

export const GenerationEventSchema = z.object({
  type: z.enum(["status", "component", "package", "file", "complete"]),
  data: z.unknown(),
  timestamp: z.number(),
});
export type GenerationEvent = z.infer<typeof GenerationEventSchema>;

export const GenerationOptionsSchema = z.object({
  prompt: z.any(), // GenerationPrompt
  provider: z.enum(["anthropic", "openai", "google", "groq"]),
  model: z.string().optional(),
  apiKey: z.string(),
  onProgress: z.function().args(GenerationEventSchema).returns(z.void()).optional(),
  buildReducedPrompt: z.function().returns(z.promise(z.any())).optional(),
  buildMinimalPrompt: z.function().returns(z.promise(z.any())).optional(),
});
export type GenerationOptions = z.infer<typeof GenerationOptionsSchema>;

export const GenerationFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});
export type GenerationFile = z.infer<typeof GenerationFileSchema>;

export const GenerationMetadataSchema = z.object({
  provider: z.string(),
  model: z.string(),
  tokensUsed: z.number(),
  durationMs: z.number(),
});
export type GenerationMetadata = z.infer<typeof GenerationMetadataSchema>;

export const GenerationResultSchema = z.object({
  files: z.array(GenerationFileSchema),
  packages: z.array(z.string()),
  components: z.array(z.string()),
  warnings: z.array(z.string()),
  metadata: GenerationMetadataSchema,
});
export type GenerationResult = z.infer<typeof GenerationResultSchema>;

// ============================================================================
// Provider Management
// ============================================================================

type ProviderName = "anthropic" | "openai" | "google" | "groq";

/**
 * Get default model for a provider
 */
function getDefaultModel(provider: ProviderName): string {
  switch (provider) {
    case "anthropic":
      return "claude-sonnet-4-5-20250929";
    case "openai":
      return "gpt-4-turbo";
    case "google":
      return "gemini-1.5-pro";
    case "groq":
      return "llama-3.3-70b-versatile";
  }
}

/**
 * Create a provider client for the AI SDK
 */
function createProviderClient(provider: ProviderName, apiKey: string) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey });
    case "openai":
      return createOpenAI({ apiKey });
    case "google":
      return createGoogleGenerativeAI({ apiKey });
    case "groq":
      return createGroq({ apiKey });
  }
}

// ============================================================================
// File Parser
// ============================================================================

/**
 * Parse files from XML tags in LLM response
 */
export function parseFiles(content: string): GenerationFile[] {
  const files: GenerationFile[] = [];
  const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;

  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    const path = match[1];
    const fileContent = match[2].trim();

    if (path && fileContent) {
      files.push({ path, content: fileContent });
    }
  }

  return files;
}

/**
 * Parse package dependencies from LLM response
 */
export function parsePackages(content: string): string[] {
  const packages = new Set<string>();

  // Parse <package> tags
  const packageRegex = /<package>([^<]+)<\/package>/g;
  let match;
  while ((match = packageRegex.exec(content)) !== null) {
    const pkg = match[1].trim();
    if (pkg && !pkg.startsWith(".") && !pkg.startsWith("/")) {
      packages.add(pkg);
    }
  }

  // Parse <packages> tag with comma-separated values
  const packagesRegex = /<packages>([^<]+)<\/packages>/g;
  while ((match = packagesRegex.exec(content)) !== null) {
    const pkgList = match[1].split(",");
    for (const pkg of pkgList) {
      const trimmed = pkg.trim();
      if (trimmed && !trimmed.startsWith(".") && !trimmed.startsWith("/")) {
        packages.add(trimmed);
      }
    }
  }

  // Also scan import statements
  const importRegex = /import\s+.+\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    // Only include external packages (not relative imports)
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      // Skip Node built-ins
      if (!["fs", "path", "http", "https", "util", "crypto"].includes(importPath)) {
        // Extract package name (handle scoped packages)
        const pkgName = importPath.startsWith("@")
          ? importPath.split("/").slice(0, 2).join("/")
          : importPath.split("/")[0];

        // Skip React built-ins
        if (!["react", "react-dom", "react/jsx-runtime"].includes(pkgName)) {
          packages.add(pkgName);
        }
      }
    }
  }

  return Array.from(packages).sort();
}

/**
 * Extract component names from generated files
 */
export function parseComponents(files: GenerationFile[]): string[] {
  const components = new Set<string>();

  for (const file of files) {
    // Match React component exports
    const exportRegex = /export\s+(?:default\s+)?(?:function|const)\s+([A-Z][a-zA-Z0-9]*)/g;
    let match;
    while ((match = exportRegex.exec(file.content)) !== null) {
      components.add(match[1]);
    }
  }

  return Array.from(components).sort();
}

/**
 * Detect if response is truncated
 */
export function detectTruncation(content: string, files: GenerationFile[]): string[] {
  const warnings: string[] = [];

  // Check for unclosed file tags
  const openTags = (content.match(/<file/g) || []).length;
  const closeTags = (content.match(/<\/file>/g) || []).length;
  if (openTags > closeTags) {
    warnings.push("Response contains unclosed file tags - may be truncated");
  }

  // Check for incomplete files
  for (const file of files) {
    // Count braces and brackets
    const openBraces = (file.content.match(/{/g) || []).length;
    const closeBraces = (file.content.match(/}/g) || []).length;
    const openBrackets = (file.content.match(/\[/g) || []).length;
    const closeBrackets = (file.content.match(/]/g) || []).length;

    if (openBraces !== closeBraces) {
      warnings.push(`File ${file.path} has mismatched braces (${openBraces} open, ${closeBraces} close)`);
    }
    if (openBrackets !== closeBrackets) {
      warnings.push(`File ${file.path} has mismatched brackets (${openBrackets} open, ${closeBrackets} close)`);
    }

    // Check if file is suspiciously short
    if (file.content.length < 50 && !file.path.includes("config")) {
      warnings.push(`File ${file.path} is suspiciously short (${file.content.length} chars)`);
    }

    // Check for ellipsis or placeholder comments
    if (file.content.includes("...") || file.content.includes("// ...")) {
      warnings.push(`File ${file.path} contains ellipsis - may be incomplete`);
    }
  }

  return warnings;
}

/**
 * Resolve a relative import path from a directory
 */
function resolveRelativePath(fromDir: string, importPath: string): string {
  // Remove file extension from import if present
  const cleanPath = importPath.replace(/\.(tsx?|jsx?)$/, "");

  // Split paths into segments
  const fromParts = fromDir ? fromDir.split("/") : [];
  const importParts = cleanPath.split("/");

  // Process each part of the import path
  const resultParts = [...fromParts];
  for (const part of importParts) {
    if (part === "..") {
      resultParts.pop();
    } else if (part !== ".") {
      resultParts.push(part);
    }
  }

  return resultParts.join("/");
}

/**
 * Validate that all relative imports in generated files resolve to other generated files
 * Returns array of unresolved import errors
 */
export function validateRelativeImports(
  files: { path: string; content: string }[]
): string[] {
  const errors: string[] = [];

  // Build a set of all generated file paths (normalized)
  const generatedPaths = new Set<string>();
  for (const file of files) {
    // Add path and path without extension
    generatedPaths.add(file.path);
    generatedPaths.add(file.path.replace(/\.(tsx?|jsx?)$/, ""));
  }

  // Check each file for relative imports
  for (const file of files) {
    // Match import statements with relative paths
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?["'](\.[^"']+)["']/g;
    let match;

    while ((match = importRegex.exec(file.content)) !== null) {
      const importPath = match[1];

      // Resolve the import path relative to the file's directory
      const fileDir = file.path.includes("/")
        ? file.path.substring(0, file.path.lastIndexOf("/"))
        : "";

      const resolvedPath = resolveRelativePath(fileDir, importPath);

      // Check if the resolved path exists in generated files
      // Try with and without common extensions
      const extensions = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
      const found = extensions.some(ext => generatedPaths.has(resolvedPath + ext));

      if (!found) {
        errors.push(
          `Unresolved import in ${file.path}: "${importPath}" (resolved to "${resolvedPath}")`
        );
      }
    }
  }

  return errors;
}

// ============================================================================
// Generation Functions
// ============================================================================

/**
 * Generate code from prompt (non-streaming)
 *
 * Uses the Vercel AI SDK to call the configured LLM provider and parse
 * the response into files, packages, and components.
 *
 * Includes retry logic: if the generation is incomplete (unresolved imports),
 * it will retry with a reduced prompt to give the LLM more output space.
 */
export async function generate(options: GenerationOptions): Promise<GenerationResult> {
  const { prompt, provider, model, apiKey, onProgress, buildReducedPrompt, buildMinimalPrompt } = options;
  const MAX_RETRIES = 2; // 3 total attempts: normal → reduced → minimal

  let lastResult: GenerationResult | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isRetry = attempt > 0;
    const startTime = Date.now();

    // On retry, request reduced/minimal prompt based on attempt number
    let effectivePrompt = prompt;
    if (attempt === 1 && buildReducedPrompt) {
      effectivePrompt = await buildReducedPrompt();
    } else if (attempt === 2 && buildMinimalPrompt) {
      effectivePrompt = await buildMinimalPrompt();
    } else if (attempt === 2 && buildReducedPrompt) {
      // Fallback to reduced if minimal not available
      effectivePrompt = await buildReducedPrompt();
    }

    // Console logging for debugging
    console.log(`[LovableAdapter] Attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
    console.log(`[LovableAdapter] Prompt tokens: ~${effectivePrompt.metadata?.totalTokens ?? 'unknown'}`);

    if (isRetry) {
      const retryMode = attempt === 1 ? 'reduced' : 'minimal';
      onProgress?.({
        type: "status",
        data: { message: `Retrying with ${retryMode} prompt (attempt ${attempt + 1})...` },
        timestamp: Date.now(),
      });
    }

    // Emit initial status
    onProgress?.({
      type: "status",
      data: { message: `Initializing ${provider} provider...` },
      timestamp: Date.now(),
    });

    // Create provider client
    const providerClient = createProviderClient(provider, apiKey);
    const modelId = model || getDefaultModel(provider);

    onProgress?.({
      type: "status",
      data: { message: `Calling ${modelId}...` },
      timestamp: Date.now(),
    });

    // Call LLM
    // Claude Sonnet 4/4.5 supports up to 64K output tokens per request
    // Tier 2+ accounts have 90K output tokens/min rate limit
    const { text, usage } = await generateText({
      model: providerClient(modelId),
      system: effectivePrompt.systemPrompt,
      prompt: effectivePrompt.userMessage,
      maxTokens: 16384,
    });

    onProgress?.({
      type: "status",
      data: { message: "Parsing response..." },
      timestamp: Date.now(),
    });

    // Parse response
    const files = parseFiles(text);
    const packages = parsePackages(text);
    const components = parseComponents(files);
    const warnings = detectTruncation(text, files);

    // Validate relative imports resolve to generated files
    const importErrors = validateRelativeImports(files);

    // Console logging for debugging
    console.log(`[LovableAdapter] Generated ${files.length} files, ${importErrors.length} unresolved imports`);

    // Emit file events
    for (const file of files) {
      onProgress?.({
        type: "file",
        data: file.path,
        timestamp: Date.now(),
      });
    }

    // Emit package events
    for (const pkg of packages) {
      onProgress?.({
        type: "package",
        data: pkg,
        timestamp: Date.now(),
      });
    }

    // Emit component events
    for (const component of components) {
      onProgress?.({
        type: "component",
        data: component,
        timestamp: Date.now(),
      });
    }

    const result: GenerationResult = {
      files,
      packages,
      components,
      warnings,
      metadata: {
        provider,
        model: modelId,
        tokensUsed: usage?.totalTokens ?? 0,
        durationMs: Date.now() - startTime,
      },
    };

    // Check if generation is complete (no unresolved imports)
    if (importErrors.length === 0) {
      onProgress?.({
        type: "complete",
        data: result,
        timestamp: Date.now(),
      });

      return result; // Success - all imports resolve
    }

    // Generation incomplete
    const hasRetryCallback = (attempt === 0 && buildReducedPrompt) || (attempt === 1 && (buildMinimalPrompt || buildReducedPrompt));
    if (attempt < MAX_RETRIES && hasRetryCallback) {
      const nextMode = attempt === 0 ? 'reduced' : 'minimal';
      console.log(`[LovableAdapter] Incomplete generation, retrying with ${nextMode} prompt...`);
      onProgress?.({
        type: "status",
        data: {
          message: `Incomplete generation detected (${importErrors.length} unresolved imports), retrying with ${nextMode} prompt...`,
          unresolved: importErrors,
        },
        timestamp: Date.now(),
      });
      lastResult = result;
      continue;
    }

    // Final attempt failed or no reduced prompt available - return with warnings
    result.warnings.push(...importErrors);

    onProgress?.({
      type: "complete",
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }

  // This should never be reached, but return last result just in case
  return lastResult!;
}

/**
 * Generate code from prompt (streaming)
 *
 * For now, this delegates to the non-streaming generate function and yields
 * events through the onProgress callback. True streaming can be implemented
 * later using streamText() from the AI SDK.
 */
export async function* generateStream(options: GenerationOptions): AsyncGenerator<GenerationEvent> {
  const events: GenerationEvent[] = [];
  let isComplete = false;
  let error: Error | null = null;

  // Run generation with progress callback that captures events
  const generatePromise = generate({
    ...options,
    onProgress: (event) => {
      events.push(event);
      options.onProgress?.(event);
    },
  })
    .then(() => {
      isComplete = true;
    })
    .catch((e) => {
      error = e instanceof Error ? e : new Error(String(e));
      isComplete = true;
    });

  // Yield events as they come in
  while (!isComplete || events.length > 0) {
    if (events.length > 0) {
      yield events.shift()!;
    } else {
      // Small delay to allow events to accumulate
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  // Wait for generation to complete
  await generatePromise;

  // Rethrow any error
  if (error) {
    throw error;
  }
}
