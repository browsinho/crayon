/**
 * Prompt Builder - Constructs comprehensive AI prompts for code generation
 *
 * Takes cleaned recording data, summary, and screenshots to build a structured prompt
 * that will be sent to the AI code generation engine (adapted from open-lovable).
 */

import { z } from "zod";
import type { RecordingSummary, PageMetadata } from "@crayon/types";
import type { CleanedRecording, CleanedDOMSnapshot } from "./recording-cleaner.js";

// Zod schemas
export const GenerationPromptContextSchema = z.object({
  summary: z.any(), // RecordingSummary
  domSamples: z.array(z.string()),
  apiRoutes: z.array(z.string()),
  screenshots: z.array(z.string()).optional(),
  framework: z.string(),
  libraries: z.array(z.string()),
});
export type GenerationPromptContext = z.infer<typeof GenerationPromptContextSchema>;

export const GenerationPromptMetadataSchema = z.object({
  totalTokens: z.number(),
  estimatedCost: z.number(),
});
export type GenerationPromptMetadata = z.infer<typeof GenerationPromptMetadataSchema>;

export const GenerationPromptSchema = z.object({
  systemPrompt: z.string(),
  userMessage: z.string(),
  context: GenerationPromptContextSchema,
  metadata: GenerationPromptMetadataSchema,
});
export type GenerationPrompt = z.infer<typeof GenerationPromptSchema>;

// Token budget constants
const TOKEN_BUDGET = {
  SYSTEM_PROMPT: 2000,
  USER_MESSAGE: 3000,
  DOM_SAMPLES: 40000,
  API_DATA: 10000,
  TOTAL_TARGET: 60000,
};

// Reduced budget for first retry attempt (cuts ~50% of content)
const TOKEN_BUDGET_REDUCED = {
  SYSTEM_PROMPT: 2000,
  USER_MESSAGE: 3000,
  DOM_SAMPLES: 20000, // Reduced from 40000
  API_DATA: 5000, // Reduced from 10000
  TOTAL_TARGET: 30000,
  MAX_DOM_PAGES: 4, // Reduced from 8
};

// Minimal budget for second retry attempt (cuts ~75% of content)
const TOKEN_BUDGET_MINIMAL = {
  SYSTEM_PROMPT: 2000,
  USER_MESSAGE: 3000,
  DOM_SAMPLES: 10000, // 75% reduction from original
  API_DATA: 2000, // 80% reduction from original
  TOTAL_TARGET: 15000,
  MAX_DOM_PAGES: 2, // Only homepage + 1 other page
};

// Pricing (Claude Sonnet 4.5 pricing as of 2025)
const COST_PER_1M_TOKENS = 3.0; // $3 per 1M input tokens

/**
 * Estimate token count for a string (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate estimated cost in USD
 */
function estimateCost(tokens: number): number {
  return (tokens / 1_000_000) * COST_PER_1M_TOKENS;
}

/**
 * Build the system prompt with rules and constraints
 */
function buildSystemPrompt(): string {
  return `You are an expert frontend developer tasked with cloning a website.

CONSTRAINTS:
- Use Vite + React + TypeScript
- Use Tailwind CSS for all styling (no custom CSS)
- Use standard Tailwind classes only (no arbitrary values)
- Output complete files (NO truncation, NO placeholders)
- Generate working, compiling code

OUTPUT FORMAT:
<file path="src/components/Header.tsx">
[complete file content]
</file>

<file path="src/App.tsx">
[complete file content]
</file>

<package>react-router-dom</package>
<package>@radix-ui/react-dialog</package>

RULES:
1. Study the provided DOM structure and recreate it faithfully
2. Infer component hierarchy from HTML nesting
3. Match the visual style using Tailwind classes
4. Use static data directly in components (no mock APIs, no fetch calls)
5. Preserve user interactions (forms, buttons, navigation)
6. DO NOT add features not present in the original
7. DO NOT use external APIs or services
8. DO NOT create mock API files or mock data providers
9. For ALL images, use the ImageWithFallback component:
   - Import: import { ImageWithFallback } from './components/ui/ImageWithFallback'
   - Usage: <ImageWithFallback src={imageUrl} alt="description" className="..." />
   - This handles missing/broken images automatically with a clean placeholder`;
}

/**
 * Extract API routes from cleaned network requests
 */
function extractApiRoutes(cleanedRecording: CleanedRecording): string[] {
  const routes = new Set<string>();

  for (const request of cleanedRecording.network) {
    try {
      const url = new URL(request.url);

      // Only include API-like paths
      if (
        url.pathname.includes("/api/") ||
        url.pathname.includes("/v1/") ||
        url.pathname.includes("/graphql") ||
        request.method !== "GET"
      ) {
        // Normalize path parameters (e.g., /api/users/123 -> /api/users/:id)
        let path = url.pathname;
        path = path.replace(/\/\d+(?=\/|$)/g, "/:id");
        path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, "/:id");

        routes.add(`${request.method} ${path}`);
      }
    } catch {
      // Skip invalid URLs
    }
  }

  return Array.from(routes).sort();
}

/**
 * Select representative DOM samples based on diversity and importance
 * Uses structural analysis instead of heuristic classifications
 */
function selectDomSamples(
  cleanedRecording: CleanedRecording,
  summary: RecordingSummary,
  maxTokens: number,
  maxPages: number = 8
): string[] {
  const samples: string[] = [];
  const selectedUrls = new Set<string>();
  const structures = new Set<string>();
  let totalTokens = 0;

  // Priority 1: Homepage/landing page (always include)
  const homepage = cleanedRecording.dom.find(
    (snapshot) =>
      snapshot.url === summary.pages[0]?.url ||
      snapshot.url.endsWith("/") ||
      snapshot.url.split("/").length <= 4
  );
  if (homepage && totalTokens < maxTokens) {
    const tokens = estimateTokens(homepage.html);
    if (totalTokens + tokens <= maxTokens) {
      samples.push(homepage.html);
      selectedUrls.add(homepage.url);
      structures.add(homepage.structure);
      totalTokens += tokens;
    }
  }

  // Priority 2: Include pages from the summary (detected via navigation)
  for (const page of summary.pages) {
    if (selectedUrls.has(page.url)) continue;
    if (samples.length >= maxPages) break;

    const snapshot = cleanedRecording.dom.find((s) => s.url === page.url);
    if (snapshot && totalTokens < maxTokens) {
      const tokens = estimateTokens(snapshot.html);
      if (totalTokens + tokens <= maxTokens) {
        samples.push(snapshot.html);
        selectedUrls.add(snapshot.url);
        structures.add(snapshot.structure);
        totalTokens += tokens;
      }
    }
  }

  // Priority 3: Add pages with unique structure (not yet seen)
  for (const snapshot of cleanedRecording.dom) {
    if (selectedUrls.has(snapshot.url)) continue;
    if (totalTokens >= maxTokens || samples.length >= maxPages) break;

    // Check if this structure is unique
    if (!structures.has(snapshot.structure)) {
      const tokens = estimateTokens(snapshot.html);
      if (totalTokens + tokens <= maxTokens) {
        samples.push(snapshot.html);
        selectedUrls.add(snapshot.url);
        structures.add(snapshot.structure);
        totalTokens += tokens;
      }
    }
  }

  return samples;
}

/**
 * Format page metadata for the prompt
 */
function formatPageMetadata(metadata: PageMetadata, url: string): string {
  const parts: string[] = [];
  parts.push(`URL: ${url}`);

  if (metadata.title) {
    parts.push(`Title: ${metadata.title}`);
  }
  if (metadata.description) {
    parts.push(`Description: ${metadata.description}`);
  }
  if (metadata.language) {
    parts.push(`Language: ${metadata.language}`);
  }

  // Open Graph
  if (metadata.openGraph) {
    const og = metadata.openGraph;
    if (og.title || og.description || og.type) {
      parts.push(`Open Graph: ${og.type || 'website'} - ${og.title || metadata.title || 'N/A'}`);
      if (og.description && og.description !== metadata.description) {
        parts.push(`  OG Description: ${og.description}`);
      }
    }
  }

  // Headings (show first 5)
  if (metadata.headings && metadata.headings.length > 0) {
    const headingList = metadata.headings.slice(0, 5).map(h => `H${h.level}: ${h.text}`).join(', ');
    parts.push(`Headings: ${headingList}`);
  }

  // Navigation (show first 8)
  if (metadata.navLinks && metadata.navLinks.length > 0) {
    const navList = metadata.navLinks.slice(0, 8).map(n => n.text).join(', ');
    parts.push(`Navigation: ${navList}`);
  }

  // Main content preview
  if (metadata.mainContentPreview) {
    parts.push(`Content Preview: ${metadata.mainContentPreview.substring(0, 200)}...`);
  }

  // Forms
  if (metadata.forms && metadata.forms.length > 0) {
    const formDescriptions = metadata.forms.map(f => {
      const features = [];
      if (f.hasPasswordField) features.push('password');
      if (f.hasEmailField) features.push('email');
      return `Form(${f.inputCount} inputs${features.length ? ': ' + features.join(', ') : ''})`;
    });
    parts.push(`Forms: ${formDescriptions.join(', ')}`);
  }

  // Semantic structure
  const regions = [];
  if (metadata.hasHeader) regions.push('header');
  if (metadata.hasNav) regions.push('nav');
  if (metadata.hasMain) regions.push('main');
  if (metadata.hasAside) regions.push('aside');
  if (metadata.hasFooter) regions.push('footer');
  if (regions.length > 0) {
    parts.push(`Semantic Regions: ${regions.join(', ')}`);
  }

  return parts.join('\n  ');
}

/**
 * Collect page metadata from DOM snapshots
 */
function collectPageMetadata(cleanedRecording: CleanedRecording): Map<string, PageMetadata> {
  const metadataMap = new Map<string, PageMetadata>();

  for (const snapshot of cleanedRecording.dom) {
    if (snapshot.metadata && !metadataMap.has(snapshot.url)) {
      metadataMap.set(snapshot.url, snapshot.metadata);
    }
  }

  return metadataMap;
}

/**
 * Format API routes with examples
 */
function formatApiRoutes(
  routes: string[],
  cleanedRecording: CleanedRecording,
  maxTokens: number,
  includeExamples: boolean = true
): string {
  let output = "";
  let totalTokens = 0;

  for (const route of routes) {
    if (totalTokens >= maxTokens) break;

    const [method, path] = route.split(" ");

    // Find an example request for this route
    const example = cleanedRecording.network.find(
      (req) => req.method === method && new URL(req.url).pathname.includes(path.split(":")[0])
    );

    const routeText = `${route}\n`;
    let exampleText = "";

    if (example && includeExamples) {
      exampleText = `  Request: ${JSON.stringify(example.body || {}, null, 2)}\n`;
      exampleText += `  Response: ${JSON.stringify(example.response || {}, null, 2)}\n`;
    }

    const tokens = estimateTokens(routeText + exampleText);
    if (totalTokens + tokens > maxTokens) {
      // Include route but not example
      const routeOnlyTokens = estimateTokens(routeText);
      if (totalTokens + routeOnlyTokens <= maxTokens) {
        output += routeText;
        totalTokens += routeOnlyTokens;
      }
      break;
    }

    output += routeText + exampleText;
    totalTokens += tokens;
  }

  return output;
}

/**
 * Build the user message with context
 */
function buildUserMessage(
  summary: RecordingSummary,
  domSamples: string[],
  apiRoutes: string[],
  cleanedRecording: CleanedRecording,
  screenshots?: string[],
  reducedMode: boolean = false
): string {
  const parts: string[] = [];

  // Header
  parts.push("Clone this website based on the recording:\n");

  // Summary
  parts.push("WEBSITE SUMMARY:");
  parts.push(summary.description);
  if (summary.framework.framework !== "vanilla") {
    parts.push(`Framework: ${summary.framework.framework}`);
  }
  parts.push("");

  // Page Metadata (extracted from the actual pages)
  const pageMetadata = collectPageMetadata(cleanedRecording);
  if (pageMetadata.size > 0) {
    parts.push("PAGE METADATA (SEO & Structure):");
    let pageCount = 0;
    for (const [url, metadata] of pageMetadata) {
      if (pageCount >= (reducedMode ? 3 : 6)) break;
      parts.push(`\n[Page ${pageCount + 1}]`);
      parts.push(`  ${formatPageMetadata(metadata, url)}`);
      pageCount++;
    }
    parts.push("");
  }

  // Pages visited during recording
  if (summary.pages.length > 0) {
    parts.push("PAGES VISITED:");
    for (const page of summary.pages) {
      parts.push(`- ${page.url}`);
      if (page.title && page.title !== page.url) {
        parts.push(`  Title: ${page.title}`);
      }
    }
    parts.push("");
  }

  // Brand style (only include if we have colors or fonts)
  const hasColors = summary.brandStyle.colors.length > 0;
  const hasFonts = summary.brandStyle.fonts.length > 0;
  if (hasColors || hasFonts) {
    parts.push("BRAND STYLE:");
    if (hasColors) {
      parts.push(`Colors: ${summary.brandStyle.colors.join(", ")}`);
    }
    if (hasFonts) {
      parts.push(`Fonts: ${summary.brandStyle.fonts.join(", ")}`);
    }
    parts.push("");
  }

  // DOM structure
  parts.push("DOM STRUCTURE (Representative Samples):");
  for (let i = 0; i < domSamples.length; i++) {
    parts.push(`\n--- Page ${i + 1} ---`);
    parts.push(domSamples[i]);
  }
  parts.push("");

  // API routes
  if (apiRoutes.length > 0) {
    parts.push("API ROUTES:");
    const budget = reducedMode ? TOKEN_BUDGET_REDUCED : TOKEN_BUDGET;
    const formattedRoutes = formatApiRoutes(
      apiRoutes,
      cleanedRecording,
      budget.API_DATA,
      !reducedMode // Skip examples in reduced mode
    );
    parts.push(formattedRoutes);
  }

  // Screenshots
  if (screenshots && screenshots.length > 0) {
    parts.push("SCREENSHOTS:");
    parts.push(`${screenshots.length} screenshots available for visual reference\n`);
  }

  // Goal
  parts.push("GOAL: Generate a pixel-perfect clone that compiles and runs locally.");

  return parts.join("\n");
}

/**
 * Extract libraries from framework info and components
 */
function extractLibraries(summary: RecordingSummary): string[] {
  const libraries = new Set<string>();

  // Base libraries
  libraries.add("react");
  libraries.add("react-dom");

  // Framework-specific routing
  switch (summary.framework.framework) {
    case "react":
      libraries.add("react-router-dom");
      break;
    case "vue":
      libraries.add("vue-router");
      break;
    case "angular":
      libraries.add("@angular/router");
      break;
  }

  // Note: UI library detection is now delegated to the LLM
  // which can determine appropriate libraries from the DOM structure

  return Array.from(libraries);
}

export interface BuildOptions {
  reducedMode?: boolean; // Deprecated: use reductionLevel instead
  reductionLevel?: 'normal' | 'reduced' | 'minimal';
}

/**
 * Build a complete generation prompt
 */
export async function build(
  cleanedRecording: CleanedRecording,
  summary: RecordingSummary,
  screenshots?: string[],
  options: BuildOptions = {}
): Promise<GenerationPrompt> {
  // Support both old reducedMode and new reductionLevel
  const { reducedMode = false, reductionLevel } = options;

  // Determine effective reduction level
  let effectiveLevel: 'normal' | 'reduced' | 'minimal' = 'normal';
  if (reductionLevel) {
    effectiveLevel = reductionLevel;
  } else if (reducedMode) {
    effectiveLevel = 'reduced';
  }

  // Select budget based on reduction level
  let budget: typeof TOKEN_BUDGET;
  switch (effectiveLevel) {
    case 'minimal':
      budget = TOKEN_BUDGET_MINIMAL;
      break;
    case 'reduced':
      budget = TOKEN_BUDGET_REDUCED;
      break;
    default:
      budget = TOKEN_BUDGET;
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt();

  // Extract API routes
  const apiRoutes = extractApiRoutes(cleanedRecording);

  // Select DOM samples
  const maxPages = effectiveLevel === 'minimal'
    ? TOKEN_BUDGET_MINIMAL.MAX_DOM_PAGES
    : effectiveLevel === 'reduced'
      ? TOKEN_BUDGET_REDUCED.MAX_DOM_PAGES
      : 8;
  const domSamples = selectDomSamples(
    cleanedRecording,
    summary,
    budget.DOM_SAMPLES,
    maxPages
  );

  // Extract libraries
  const libraries = extractLibraries(summary);

  // Build user message
  const userMessage = buildUserMessage(
    summary,
    domSamples,
    apiRoutes,
    cleanedRecording,
    screenshots,
    effectiveLevel !== 'normal' // reducedMode for buildUserMessage
  );

  // Calculate tokens and cost
  const totalTokens =
    estimateTokens(systemPrompt) +
    estimateTokens(userMessage);

  const estimatedCost = estimateCost(totalTokens);

  const context: GenerationPromptContext = {
    summary,
    domSamples,
    apiRoutes,
    screenshots,
    framework: summary.framework.framework,
    libraries,
  };

  const metadata: GenerationPromptMetadata = {
    totalTokens,
    estimatedCost,
  };

  return {
    systemPrompt,
    userMessage,
    context,
    metadata,
  };
}
