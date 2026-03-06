# Generation Orchestrator

End-to-end orchestration of the recording-to-website generation pipeline.

## Purpose

Coordinates all generation steps: clean recording → summarize → build prompt → generate code → write files → build Docker image.

## Acceptance Criteria

- [ ] Executes full pipeline from recording to runnable sandbox
- [ ] Streams progress updates to UI
- [ ] Handles errors gracefully with rollback
- [ ] Supports resuming from checkpoints
- [ ] Validates each stage before proceeding
- [ ] Generates detailed logs for debugging

## Interface

```typescript
interface GenerationConfig {
  recordingId: string;
  projectId: string;

  // AI generation options
  llmProvider: 'anthropic' | 'openai' | 'google' | 'groq';
  llmModel?: string;

  // Output options
  includeBackend: boolean; // Generate Express backend?
  includeMockData: boolean; // Generate realistic data?

  // Progress tracking
  onProgress?: (event: PipelineEvent) => void;
}

interface PipelineEvent {
  stage: PipelineStage;
  status: 'started' | 'progress' | 'completed' | 'failed';
  message: string;
  progress?: number; // 0-100
  timestamp: number;
}

type PipelineStage =
  | 'cleaning'
  | 'summarizing'
  | 'prompt_building'
  | 'code_generation'
  | 'validation'
  | 'file_writing'
  | 'backend_generation'
  | 'data_generation'
  | 'docker_build'
  | 'deployment';

interface GenerationOutput {
  projectId: string;
  sandboxPath: string; // Path to generated files
  dockerImageId?: string;
  url?: string; // Local URL where sandbox is running
  logs: PipelineEvent[];
  errors: string[];
}

// Run full generation pipeline
orchestrate(config: GenerationConfig): Promise<GenerationOutput>

// Stream version
orchestrateStream(config: GenerationConfig): AsyncGenerator<PipelineEvent>
```

## Pipeline Stages

### Stage 1: Data Preparation
1. **Load Recording** (spec 06)
   - Load from `./data/recordings/{recordingId}/`
   - Validate recording is complete

2. **Clean Recording** (spec 28)
   - Remove noise, scripts, analytics
   - Anonymize PII
   - Reduce token count

3. **Summarize Recording** (spec 27)
   - Generate business context
   - Extract UI patterns
   - Identify pages and components

### Stage 2: AI Code Generation
4. **Build Prompt** (spec 29)
   - Construct system prompt
   - Build user message with context
   - Optimize for token budget

5. **Generate Frontend Code** (spec 30)
   - Stream code from LLM
   - Parse files and packages
   - Validate TypeScript/JSX

### Stage 3: Backend & Data (Optional)
6. **Generate Backend** (spec 13 - updated)
   - If `includeBackend: true`
   - Use existing backend generator
   - Create Express API from network requests

7. **Generate Mock Data** (spec 14 - updated)
   - If `includeMockData: true`
   - Use existing data generator
   - Generate realistic seed data

### Stage 4: Deployment
8. **Write Files to Disk**
   - Create project directory structure
   - Write all generated files
   - Install npm packages

9. **Build Docker Image** (spec 16)
   - Package frontend + backend
   - Create Dockerfile
   - Build image

10. **Deploy to Sandbox** (spec 17)
    - Start container
    - Map ports
    - Return URL

## Error Handling

Each stage should:
- Validate inputs before processing
- Catch and log errors
- Allow retry for transient failures
- Rollback on critical failures

### Checkpointing
Save progress after each stage:
```
./data/projects/{projectId}/generation/
  ├── checkpoint.json          # Current stage + metadata
  ├── 01-cleaned.json          # Cleaned recording
  ├── 02-summary.json          # Recording summary
  ├── 03-prompt.json           # Generated prompt
  ├── 04-code/                 # Generated files
  └── logs.jsonl               # All pipeline events
```

This allows:
- Resuming failed generations
- Debugging issues at specific stages
- Iterating on prompts without re-running AI

## Progress Streaming

Emit events for UI to display:
```typescript
// Starting a stage
{ stage: 'cleaning', status: 'started', message: 'Cleaning recording data...' }

// Progress within stage
{ stage: 'cleaning', status: 'progress', message: 'Removed 45% of noise', progress: 45 }

// Completing a stage
{ stage: 'cleaning', status: 'completed', message: 'Recording cleaned: 120K → 65K tokens' }

// Code generation streaming
{ stage: 'code_generation', status: 'progress', message: 'Generated Header.tsx' }
{ stage: 'code_generation', status: 'progress', message: 'Detected package: react-router-dom' }
```

## Testing Requirements

### Unit Tests
- Test stage sequencing
- Test error handling per stage
- Test checkpoint saving/loading
- Test progress event emission

### Integration Tests
- **REQUIRES FULL STACK** (LLM API, Docker, etc.)
- Run full pipeline with test recording
- Verify each stage produces expected output
- Test resume from checkpoint
- Verify final sandbox runs and is accessible

## Definition of Done

- [ ] Full pipeline executes end-to-end
- [ ] Progress events stream correctly
- [ ] Checkpoints allow resuming
- [ ] Errors are caught and logged
- [ ] Integration test produces working website
- [ ] Generated website is accessible at local URL
- [ ] Pipeline completes in <5 minutes for typical recording
