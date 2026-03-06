# Lovable Adapter

Integrates open-lovable's AI code generation engine into Crayon.

## ⚠️ External Integration

This spec requires adapting code from: https://github.com/firecrawl/open-lovable

**Key files to study**:
- `lib/ai/provider-manager.ts` - Multi-LLM provider support
- `app/api/generate-ai-code-stream/route.ts` - Streaming code generation
- `app/api/apply-ai-code/route.ts` - File writing and validation
- `lib/file-parser.ts` - Parsing XML-tagged files from LLM
- `lib/edit-intent-analyzer.ts` - Intent analysis (optional)

## Purpose

Adapts open-lovable's code generation components to work with Crayon's recording-based inputs instead of Firecrawl scraping.

## Acceptance Criteria

- [ ] Can send generation prompts to multiple LLM providers (Anthropic, OpenAI, Gemini, Groq)
- [ ] Streams code generation progress in real-time (SSE)
- [ ] Parses XML-tagged files from LLM response
- [ ] Extracts package dependencies from generated code
- [ ] Detects truncation and can auto-complete
- [ ] Returns structured GenerationResult with all files

## Interface

```typescript
interface GenerationOptions {
  prompt: GenerationPrompt; // From spec 29
  provider: 'anthropic' | 'openai' | 'google' | 'groq';
  model?: string; // Optional specific model
  onProgress?: (event: GenerationEvent) => void; // Streaming callback
}

interface GenerationEvent {
  type: 'status' | 'component' | 'package' | 'file' | 'complete';
  data: unknown;
  timestamp: number;
}

interface GenerationResult {
  files: {
    path: string;
    content: string;
  }[];
  packages: string[];
  components: string[]; // List of component names generated
  warnings: string[]; // Any issues detected
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    durationMs: number;
  };
}

// Generate code from prompt
generate(options: GenerationOptions): Promise<GenerationResult>

// Stream version
generateStream(options: GenerationOptions): AsyncGenerator<GenerationEvent>
```

## Components to Adapt from open-lovable

### 1. Provider Manager (`lib/ai/provider-manager.ts`)
- Adapt to use Crayon's API key storage (spec 26 settings)
- Support multi-provider routing
- Cache clients to avoid recreation

### 2. Code Generation (`app/api/generate-ai-code-stream/route.ts`)
- Remove website scraping logic
- Replace with our recording-based prompt
- Keep streaming logic
- Keep truncation detection

### 3. File Parser (`lib/file-parser.ts`)
- Parse `<file path="">content</file>` tags
- Extract `<package>` tags
- Extract `<command>` tags (optional)
- Handle incomplete responses

### 4. Response Validator
- Ensure generated files are valid TypeScript/JSX
- Check for common issues (missing imports, syntax errors)
- Validate Tailwind classes

## Key Differences from open-lovable

| Aspect | open-lovable | Crayon Adaptation |
|--------|-------------|-------------------|
| Input | Firecrawl scraping | Recording data (DOM, network, screenshots) |
| Prompt | User describes app | Constructed from recording (spec 29) |
| Output | Cloud sandbox (Vercel/E2B) | Local files + Docker (spec 16, 17) |
| Hosting | External | Under our domain |
| Iteration | Chat-based edits | One-shot generation (for now) |

## Implementation Strategy

### Phase 1: Extract Core Components
1. Copy relevant files from open-lovable to `packages/core/src/generation/lovable/`
2. Remove Next.js-specific code (convert API routes to functions)
3. Remove Firecrawl dependencies
4. Keep: Provider manager, file parser, streaming logic

### Phase 2: Adapt to Crayon
1. Integrate with our prompt builder (spec 29)
2. Use our settings system for API keys
3. Return files in our GenerationResult format
4. Add progress callbacks for UI integration

### Phase 3: Validation
1. Add TypeScript/JSX validation
2. Add Tailwind class validation
3. Add import dependency checking

## Testing Requirements

### Unit Tests
- Mock LLM provider, test file parsing
- Test XML tag extraction
- Test package detection from imports
- Test truncation detection

### Integration Tests
- **REQUIRES LLM API KEY** (Anthropic/OpenAI/etc.)
- Send test prompt → get back valid React files
- Test with multiple providers
- Test streaming events fire correctly
- Verify generated code compiles

## Definition of Done

- [ ] Can generate code using Anthropic Claude
- [ ] Can generate code using OpenAI GPT
- [ ] Streaming progress works
- [ ] Files are parsed correctly from XML tags
- [ ] Packages are detected from imports
- [ ] Generated code is valid TypeScript
- [ ] Integration test produces working React app
