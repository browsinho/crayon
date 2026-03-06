# Generation Pipeline Page

UI for configuring and monitoring the recording-to-website generation process.

## ⚠️ Architecture Change

This page now orchestrates the NEW generation pipeline (specs 27-32):
1. Recording Cleaner (spec 28)
2. Recording Summarizer (spec 27)
3. Prompt Builder (spec 29)
4. Lovable Adapter - AI Code Generation (spec 30)
5. Frontend Generator - Validation (spec 12)
6. Backend Generator (spec 13) - optional
7. Data Generator (spec 14) - optional
8. Docker Build (spec 16)
9. Deployment (spec 17)

## Purpose

Provides UI for users to configure generation options and monitor real-time progress through all pipeline stages.

## Acceptance Criteria

- [ ] Form displays all generation options (LLM provider, model, backend toggle, data toggle)
- [ ] Options are validated before starting
- [ ] Generation progress streams in real-time (SSE)
- [ ] Progress shows ALL pipeline stages (cleaning, summarizing, prompting, generating, etc.)
- [ ] Shows token usage and estimated cost
- [ ] Displays preview of generated components as they stream
- [ ] Can cancel generation mid-process
- [ ] Supports resuming from checkpoint if failed
- [ ] Redirects to sandbox viewer on completion
- [ ] Shows detailed error state with logs if generation fails

## Route

`/project/[id]/generate`

## Interface

```typescript
interface GenerationOptions {
  recordingId: string;
  projectId: string;
  llmProvider: 'anthropic' | 'openai' | 'google' | 'groq';
  llmModel?: string;
  includeBackend: boolean;
  includeMockData: boolean;
  resumeFromCheckpoint?: boolean; // Resume failed generation
}

interface ProgressEvent {
  stage: PipelineStage;   // From spec 31
  status: 'started' | 'progress' | 'completed' | 'failed';
  message: string;        // "Detected React framework"
  progress?: number;      // 0-100 (optional)
  timestamp: number;
  metadata?: {
    tokensUsed?: number;
    estimatedCost?: number;
    componentsGenerated?: string[];
  };
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
```

## UI Components

### Options Form

```tsx
<GenerationForm>
  <Select name="llmProvider" required>
    <option value="anthropic">Anthropic Claude (Recommended)</option>
    <option value="openai">OpenAI GPT-4</option>
    <option value="google">Google Gemini</option>
    <option value="groq">Groq (Fast)</option>
  </Select>

  <Input
    name="llmModel"
    placeholder="Optional: specific model (e.g., claude-opus-4)"
  />

  <Checkbox
    name="includeBackend"
    label="Generate backend API"
    defaultChecked
  />

  <Checkbox
    name="includeMockData"
    label="Generate realistic seed data"
    defaultChecked
  />

  <Alert type="info">
    <p>Estimated tokens: ~{estimatedTokens.toLocaleString()}</p>
    <p>Estimated cost: ${estimatedCost.toFixed(3)}</p>
  </Alert>

  <Button type="submit" disabled={!hasApiKey}>
    Start Generation
  </Button>

  {hasFailedGeneration && (
    <Button variant="secondary" onClick={handleResume}>
      Resume from Last Checkpoint
    </Button>
  )}
</GenerationForm>
```

### Progress Display

```tsx
<ProgressView>
  <ProgressBar value={overallProgress} max={100} />

  <StatsCard>
    <Stat label="Tokens Used" value={tokensUsed.toLocaleString()} />
    <Stat label="Estimated Cost" value={`$${cost.toFixed(3)}`} />
    <Stat label="Components" value={componentsGenerated.length} />
    <Stat label="Duration" value={formatDuration(elapsedMs)} />
  </StatsCard>

  <Timeline>
    <Stage status="completed" icon="✓" duration="2s">
      Cleaning (120K → 65K tokens)
    </Stage>
    <Stage status="completed" icon="✓" duration="5s">
      Summarizing (Generated description)
    </Stage>
    <Stage status="completed" icon="✓" duration="1s">
      Prompt Building (58K tokens)
    </Stage>
    <Stage status="active" icon="⏳" progress={45}>
      Code Generation (Generated 8/15 components)
    </Stage>
    <Stage status="pending">Validation</Stage>
    <Stage status="pending">File Writing</Stage>
    <Stage status="pending">Docker Build</Stage>
    <Stage status="pending">Deployment</Stage>
  </Timeline>

  <ComponentPreview>
    <h3>Generated Components:</h3>
    <div className="flex flex-wrap gap-2">
      {componentsGenerated.map(c => (
        <Chip key={c} variant="success">{c}</Chip>
      ))}
    </div>
  </ComponentPreview>

  <MessageLog maxHeight="300px">
    {events.map(e => (
      <Message key={e.timestamp} status={e.status}>
        <Time>{formatTime(e.timestamp)}</Time>
        <Stage className="font-mono">[{e.stage}]</Stage>
        <Text>{e.message}</Text>
      </Message>
    ))}
  </MessageLog>

  <ButtonGroup>
    <Button onClick={handleCancel} variant="outline" disabled={isComplete}>
      Cancel Generation
    </Button>
    <Button onClick={handleViewLogs} variant="ghost">
      View Full Logs
    </Button>
  </ButtonGroup>
</ProgressView>
```

### Success State

```tsx
<SuccessView>
  <Icon name="check-circle" size="large" color="success" />
  <h2>Generation Complete!</h2>

  <Stats>
    <Stat label="Total Time" value={formatDuration(totalMs)} />
    <Stat label="Components Created" value={componentsGenerated.length} />
    <Stat label="Files Generated" value={filesGenerated} />
    <Stat label="Total Cost" value={`$${totalCost.toFixed(3)}`} />
  </Stats>

  <ButtonGroup>
    <Button onClick={() => router.push(`/project/${projectId}/sandbox`)}>
      View Sandbox
    </Button>
    <Button variant="secondary" onClick={handleDownloadLogs}>
      Download Logs
    </Button>
  </ButtonGroup>
</SuccessView>
```

### Error State

```tsx
<ErrorView>
  <Icon name="alert-circle" size="large" color="error" />
  <h2>Generation Failed</h2>
  <p>Failed at stage: {failedStage}</p>

  <ErrorDetails>
    <pre>{errorMessage}</pre>
  </ErrorDetails>

  <ButtonGroup>
    <Button onClick={handleRetry}>Retry from Checkpoint</Button>
    <Button variant="secondary" onClick={handleViewLogs}>
      View Logs
    </Button>
    <Button variant="ghost" onClick={handleReportIssue}>
      Report Issue
    </Button>
  </ButtonGroup>
</ErrorView>
```

## API Route

`/app/api/generate/route.ts` (Server-Sent Events)

```typescript
export async function POST(request: Request) {
  const options: GenerationOptions = await request.json();

  // Validate options
  if (!options.llmProvider) {
    return new Response('Missing LLM provider', { status: 400 });
  }

  // Start SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Run generation in background
  (async () => {
    try {
      for await (const event of orchestrateStream(options)) {
        await writer.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      await writer.close();
    } catch (error) {
      await writer.write(`data: ${JSON.stringify({
        type: 'error',
        message: error.message
      })}\n\n`);
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Testing Requirements

### Unit Tests
- Test form validation
- Test event stream parsing
- Test progress calculation
- Test component list rendering

### Integration Tests
- Submit form → SSE stream starts
- Events update UI in real-time
- Cancel button stops generation
- Success redirects to sandbox viewer
- Error shows proper error state
- Resume from checkpoint works

## Definition of Done

- [ ] Form validates all inputs
- [ ] SSE stream shows real-time progress
- [ ] All pipeline stages display in timeline
- [ ] Token usage and cost are shown
- [ ] Generated components preview works
- [ ] Cancel functionality stops generation
- [ ] Resume from checkpoint works for failed generations
- [ ] Success state redirects to sandbox
- [ ] Error state shows actionable information
- [ ] Integration test completes full generation flow
