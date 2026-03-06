# Prompt Builder

Constructs comprehensive AI prompts for code generation using recording data.

## Purpose

Takes cleaned recording data, summary, and screenshots to build a structured prompt that will be sent to the AI code generation engine (adapted from open-lovable).

## Acceptance Criteria

- [ ] Builds system prompt with coding rules and constraints
- [ ] Includes recording summary with business context
- [ ] Includes cleaned DOM samples (representative pages)
- [ ] Includes API route information from network requests
- [ ] Includes screenshot references (if available)
- [ ] Includes framework and library requirements
- [ ] Prompt is optimized for token efficiency
- [ ] Generates user message describing the cloning task

## Interface

```typescript
interface GenerationPrompt {
  systemPrompt: string; // Rules, constraints, output format
  userMessage: string; // The actual cloning request
  context: {
    summary: RecordingSummary;
    domSamples: string[]; // Representative HTML snippets
    apiRoutes: string[]; // "/api/users", "/api/posts/:id"
    screenshots?: string[]; // Base64 or URLs
    framework: string;
    libraries: string[];
  };
  metadata: {
    totalTokens: number;
    estimatedCost: number;
  };
}

// Build prompt from cleaned recording
build(
  cleanedRecording: CleanedRecording,
  summary: RecordingSummary,
  screenshots?: string[]
): Promise<GenerationPrompt>
```

## System Prompt Structure

The system prompt should enforce:

```
You are an expert frontend developer tasked with cloning a website.

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
4. Create mock API responses based on network data
5. Preserve user interactions (forms, buttons, navigation)
6. DO NOT add features not present in the original
7. DO NOT use external APIs or services
```

## User Message Structure

```
Clone this website based on the recording:

WEBSITE SUMMARY:
{summary.description}
Domain: {summary.domain}
Framework: {summary.framework}

PAGES:
{list of pages with descriptions}

COMPONENTS:
{list of detected components}

BRAND STYLE:
Colors: {color palette}
Fonts: {font families}

DOM STRUCTURE (Representative Samples):
{cleaned HTML from key pages}

API ROUTES:
{list of routes with request/response examples}

SCREENSHOTS:
{references to screenshots if available}

GOAL: Generate a pixel-perfect clone that compiles and runs locally.
```

## Token Budget

- System prompt: ~2K tokens
- User message (summary): ~3K tokens
- DOM samples: ~40K tokens (select most representative)
- API data: ~10K tokens
- **Total target: <60K tokens** (leaves room for response)

## DOM Sample Selection Strategy

Don't include ALL DOM snapshots. Select representative samples:
1. Homepage/landing page (always)
2. One example of each unique page type
3. Pages with unique components not seen elsewhere
4. Max 5-8 pages total

## Testing Requirements

### Unit Tests
- Test system prompt includes all required rules
- Test token counting is accurate
- Test DOM sample selection picks diverse pages
- Test API route formatting

### Integration Tests
- Build prompt from real recording
- Verify total tokens < 60K
- Manually review prompt for completeness
- Test with Claude API (verify it accepts the prompt)

## Definition of Done

- [ ] Unit tests pass
- [ ] Generated prompts are under token budget
- [ ] System prompt enforces all constraints
- [ ] User message is clear and comprehensive
- [ ] DOM samples are representative, not exhaustive
