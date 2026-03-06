# Generation Engine Refactor - Overview

This document explains the refactored generation engine that uses AI-powered code generation (inspired by open-lovable) instead of direct DOM-to-React conversion.

## What Changed

### Old Architecture (Specs 12-14)
```
Recording (DOM, Network)
    ↓
Direct Code Generation (template-based)
    ↓
    ├─ Frontend: DOM → React components (hardcoded patterns)
    ├─ Backend: Network → Express routes (template generation)
    └─ Data: LLM generates seed data
    ↓
Docker Build
```

**Problems**:
- Template-based generation produces generic code
- Hard to match original styling and structure
- Limited to predefined patterns
- Doesn't handle complex UI well

### New Architecture (Specs 27-32)
```
Recording (DOM, Network, Screenshots)
    ↓
Clean & Prepare (spec 28)
    ├─ Remove noise, scripts, ads
    ├─ Anonymize PII
    └─ Reduce tokens 50-80%
    ↓
Summarize (spec 27)
    ├─ Generate business description
    ├─ Extract UI patterns
    ├─ Identify components
    └─ Extract brand styles
    ↓
Build Prompt (spec 29)
    ├─ System prompt (rules, constraints)
    ├─ User message (summary + cleaned DOM + API routes + screenshots)
    └─ Optimize for <60K tokens
    ↓
AI Code Generation (spec 30 - Lovable Adapter)
    ├─ Multi-LLM support (Anthropic, OpenAI, Google, Groq)
    ├─ Stream code generation
    ├─ Parse XML-tagged files
    └─ Detect packages
    ↓
Validate & Package (spec 12 - updated)
    ├─ Validate TypeScript/JSX
    ├─ Validate Tailwind classes
    ├─ Create Vite project
    └─ Run build to verify
    ↓
Orchestrate (spec 31)
    ├─ Coordinate all stages
    ├─ Save checkpoints
    ├─ Stream progress
    └─ Handle errors
    ↓
Host (spec 32)
    ├─ Reverse proxy sandboxes
    └─ Serve under our domain
```

**Benefits**:
- AI generates pixel-perfect clones
- Handles complex UI patterns
- Better code quality
- More realistic output
- Supports multiple LLM providers

## New Specs

### Spec 27: Recording Summarizer
**Purpose**: Generate high-level summary of recorded website

**Input**: Recording (DOM, network, screenshots, events)

**Output**: RecordingSummary
```typescript
{
  description: "A task management dashboard with kanban boards",
  domain: "productivity",
  pages: [{ url: "/", title: "Home", pageType: "dashboard", ... }],
  components: [{ type: "button", variants: 3, ... }],
  brandStyle: {
    colors: ["#3B82F6", "#10B981", ...],
    fonts: ["Inter", "Roboto"],
    styleKeywords: ["modern", "minimal"]
  },
  framework: { framework: "react", confidence: 0.95, ... },
  interactions: [{ type: "click", description: "Add task", frequency: 10 }]
}
```

**Key Features**:
- Identifies page types (landing, dashboard, detail, form)
- Extracts repeated patterns → components
- Analyzes color palette and typography
- Classifies business domain
- Token-efficient (<5K tokens)

---

### Spec 28: Recording Cleaner
**Purpose**: Clean and optimize recording data for AI prompt

**Input**: Raw recording

**Output**: CleanedRecording
```typescript
{
  dom: [{ url: "/", html: "...", structure: "..." }],
  network: [{ method: "GET", url: "/api/users", ... }],
  metadata: {
    originalTokenCount: 150000,
    cleanedTokenCount: 65000,
    elementsRemoved: 2341,
    requestsFiltered: 87
  }
}
```

**Cleaning Rules**:
- **Remove**: Scripts, analytics, ads, third-party widgets, hidden elements
- **Simplify**: Strip inline styles (keep classes), remove data attributes
- **Filter**: Remove analytics/tracking network requests
- **Anonymize**: Use PII anonymizer (spec 05)
- **Target**: 50-80% token reduction

---

### Spec 29: Prompt Builder
**Purpose**: Construct comprehensive AI prompts

**Input**: CleanedRecording, RecordingSummary, screenshots

**Output**: GenerationPrompt
```typescript
{
  systemPrompt: "You are an expert frontend developer...",
  userMessage: "Clone this website based on the recording...",
  context: {
    summary: RecordingSummary,
    domSamples: ["<html>...</html>", ...],
    apiRoutes: ["/api/users", "/api/posts/:id"],
    screenshots: ["base64...", ...],
    framework: "react",
    libraries: ["react-router-dom", ...]
  },
  metadata: {
    totalTokens: 58000,
    estimatedCost: 0.145
  }
}
```

**System Prompt** enforces:
- Use Vite + React + TypeScript
- Use Tailwind CSS only (no custom CSS)
- Output complete files (no truncation)
- XML-tagged format: `<file path="...">content</file>`

**User Message** includes:
- Website summary
- DOM samples (5-8 representative pages)
- API routes with examples
- Screenshots (if available)

**Token Budget**: <60K tokens total

---

### Spec 30: Lovable Adapter
**Purpose**: Integrate open-lovable's AI code generation

**Adapted Components**:
1. **Provider Manager** (`lib/ai/provider-manager.ts`)
   - Multi-LLM routing (Anthropic, OpenAI, Google, Groq)
   - Client caching
   - API key management

2. **Code Generation** (`app/api/generate-ai-code-stream/route.ts`)
   - Streaming code generation (SSE)
   - Progress events
   - Truncation detection

3. **File Parser** (`lib/file-parser.ts`)
   - Parse `<file path="">` tags
   - Extract `<package>` tags
   - Handle incomplete responses

**Output**: GenerationResult
```typescript
{
  files: [
    { path: "src/App.tsx", content: "..." },
    { path: "src/components/Header.tsx", content: "..." }
  ],
  packages: ["react-router-dom", "@radix-ui/react-dialog"],
  components: ["Header", "Hero", "ProductCard"],
  warnings: ["Invalid Tailwind class detected: shadow-3xl"],
  metadata: {
    provider: "anthropic",
    model: "claude-opus-4",
    tokensUsed: 42000,
    durationMs: 8500
  }
}
```

---

### Spec 31: Generation Orchestrator
**Purpose**: End-to-end pipeline coordination

**Pipeline Stages**:
1. **Cleaning** (spec 28) - Remove noise
2. **Summarizing** (spec 27) - Generate summary
3. **Prompt Building** (spec 29) - Construct prompt
4. **Code Generation** (spec 30) - AI generates code
5. **Validation** (spec 12) - Validate TypeScript/Tailwind
6. **File Writing** - Write to disk
7. **Backend Generation** (spec 13) - Optional
8. **Data Generation** (spec 14) - Optional
9. **Docker Build** (spec 16) - Package
10. **Deployment** (spec 17) - Start container

**Checkpointing**:
```
./data/projects/{projectId}/generation/
  ├── checkpoint.json          # Current stage
  ├── 01-cleaned.json          # Cleaned recording
  ├── 02-summary.json          # Summary
  ├── 03-prompt.json           # Prompt
  ├── 04-code/                 # Generated files
  └── logs.jsonl               # All events
```

**Features**:
- Resume from checkpoint on failure
- Stream progress events
- Error handling per stage
- Detailed logging

---

### Spec 32: Sandbox Hosting
**Purpose**: Host generated sandboxes under our domain

**Approach**: Reverse proxy (Next.js API route)

**URL Structure**:
- Sandbox 1: `http://localhost:3000/sandbox/abc123`
- Sandbox 2: `http://localhost:3000/sandbox/def456`

**Implementation**:
```typescript
// /app/api/sandbox/[sandboxId]/[...path]/route.ts
export async function GET(request, { params }) {
  const sandbox = await getSandbox(params.sandboxId);
  const targetUrl = `http://localhost:${sandbox.port}/${params.path.join('/')}`;
  const response = await fetch(targetUrl);
  return response;
}
```

**Features**:
- WebSocket support (for Vite hot reload)
- Multiple sandboxes simultaneously
- Iframe embedding in UI

---

## Updated Specs

### Spec 12: Frontend Generator (REFACTORED)
**Old**: Direct DOM → React conversion

**New**: AI code validation wrapper

**New Purpose**:
1. Receive GenerationResult from Lovable Adapter
2. Validate TypeScript/JSX syntax
3. Validate Tailwind classes
4. Create Vite project structure
5. Install npm packages
6. Run `npm run build` to verify

**Key Change**: No longer generates code, only validates and packages it.

---

### Spec 24: Generation Pipeline UI (REFACTORED)
**Old**: Simple progress bar with basic stages

**New**: Comprehensive UI for new pipeline

**New Features**:
- LLM provider selection (Anthropic, OpenAI, Google, Groq)
- Token usage and cost estimation
- All 10 pipeline stages in timeline
- Component preview as they stream
- Resume from checkpoint button
- Detailed error logs

**Progress Events**:
```typescript
{
  stage: 'code_generation',
  status: 'progress',
  message: 'Generated Header.tsx',
  metadata: {
    tokensUsed: 12000,
    estimatedCost: 0.03,
    componentsGenerated: ["Header", "Hero", "ProductCard"]
  }
}
```

---

## Integration with open-lovable

### What We're Taking
1. **Provider Manager** - Multi-LLM abstraction
2. **Streaming Logic** - SSE for real-time progress
3. **File Parser** - XML tag extraction
4. **Prompt Patterns** - System prompt structure

### What We're NOT Taking
1. **Firecrawl Integration** - We use our recording data
2. **Cloud Sandboxes** - We use local Docker
3. **Chat Interface** - We use one-shot generation (for now)
4. **Edit Intent Analyzer** - Not needed yet (future feature)

### Adaptation Strategy
```
1. Extract core components to packages/core/src/generation/lovable/
2. Remove Next.js-specific code
3. Remove Firecrawl dependencies
4. Integrate with our settings system (spec 26)
5. Return files in our GenerationResult format
6. Add TypeScript/Tailwind validation
```

---

## Migration Path (Ralph Wiggum Compatible)

### Phase 7: New Generation Engine

**Tasks** (in order):
1. `[27-recording-summarizer]` - Analyze recordings
2. `[28-recording-cleaner]` - Clean and optimize
3. `[29-prompt-builder]` - Build AI prompts
4. `[30-lovable-adapter]` - AI code generation
5. `[31-generation-orchestrator]` - Pipeline coordination
6. `[32-sandbox-hosting]` - Hosting infrastructure
7. `[12-frontend-generator]` - REFACTOR (validation wrapper)
8. `[24-generation-pipeline]` - REFACTOR (new UI)

**Dependencies**:
- Specs 27-29 can be built in parallel (independent)
- Spec 30 depends on 29 (needs prompt format)
- Spec 31 depends on 27-30 (orchestrates all)
- Spec 32 can be built in parallel (independent)
- Spec 12 refactor depends on 30 (validates AI output)
- Spec 24 refactor depends on 31 (UI for orchestrator)

**Ralphy Command**:
```bash
# Run the new Phase 7 tasks
ralphy --prd IMPLEMENTATION_PLAN.md --phase 7
```

---

## Expected Results

### Input
Recording of a task management app with:
- 5 pages (home, tasks, projects, settings, login)
- 150K tokens of DOM data
- 50 network requests
- 8 screenshots

### After Processing
- **Cleaned**: 65K tokens (57% reduction)
- **Summary**: "Task management dashboard with kanban boards, drag-drop, filters" (500 tokens)
- **Prompt**: 58K tokens total (under budget)

### AI Generation
- **Provider**: Anthropic Claude Opus 4
- **Duration**: ~8-15 seconds
- **Output**:
  - 24 React components
  - 8 pages
  - 12 utility functions
  - 15 npm packages
  - Complete Vite project

### Final Output
- Compiling Vite+React+TypeScript app
- Pixel-perfect match to original
- Hosted at `http://localhost:3000/sandbox/{id}`
- Total cost: ~$0.10-0.30 (depending on LLM)

---

## Testing Strategy

Each spec has:
- **Unit tests**: Logic in isolation
- **Integration tests**: With real LLM APIs (requires API keys)
- **End-to-end test**: Full pipeline with test recording

**Critical Integration Tests**:
1. Real recording → cleaned → summary → prompt → AI output
2. AI output → validation → Vite project → compiles successfully
3. Full orchestration → sandbox runs and is accessible

---

## Success Criteria

Phase 7 is complete when:
- [ ] Can generate working React app from any recording
- [ ] Generated code compiles without errors
- [ ] Visual appearance matches original (manual review)
- [ ] Sandboxes are hosted under our domain
- [ ] Pipeline completes in <5 minutes
- [ ] All integration tests pass
- [ ] Checkpointing works (can resume failed generations)
- [ ] UI shows real-time progress with all stages

---

## Next Steps

1. **Read this document** to understand the architecture
2. **Review specs 27-32** in detail
3. **Run ralphy** to implement Phase 7:
   ```bash
   ralphy --prd IMPLEMENTATION_PLAN.md
   ```
4. **Test with real recordings** to validate quality
5. **Iterate on prompts** to improve output

---

## Questions?

- **Why not keep template-based generation?** AI produces higher quality, more realistic code.
- **Why open-lovable?** Proven architecture, multi-LLM support, streaming works well.
- **Why refactor specs 12 and 24?** Align with new pipeline, don't duplicate logic.
- **Can we still use old specs?** Yes, they're preserved. New specs are additive.
- **What about editing generated code?** Future feature (could adopt open-lovable's edit-intent-analyzer).

---

This refactor positions Crayon to generate production-quality sandboxes that closely match recorded websites, powered by state-of-the-art LLMs.
