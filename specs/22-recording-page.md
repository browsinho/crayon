# Recording Page

Web page for recording browser sessions via AnchorBrowser.

## ⚠️ External Integration

**USE WEB SEARCH** to find current documentation.
- Search: "AnchorBrowser live view embed iframe"
- Search: "AnchorBrowser session streaming"
- Search: "React Server-Sent Events real-time updates"

Do NOT guess. Find the real docs.

## Acceptance Criteria

- [ ] Start new recording with target URL
- [ ] Display AnchorBrowser session in iframe/embed
- [ ] Real-time event feed (clicks, navigation, inputs)
- [ ] Network requests panel
- [ ] Screenshot preview updates
- [ ] Recording timer
- [ ] Stop recording and save
- [ ] Cancel recording discards session and project
- [ ] Navigate to project after recording

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  New Recording                                     [● REC 2:34] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Target URL                                                     │
│  [https://example.com____________________] [Start Recording]    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────┬───────────────────────────┐
│  │                                 │  Events           [Clear] │
│  │                                 │  ────────────────────────  │
│  │    ANCHORBROWSER LIVE VIEW      │  00:05 navigate /         │
│  │    (iframe/embed)               │  00:12 click .login-btn   │
│  │                                 │  00:18 type input#email   │
│  │                                 │  00:24 click #submit      │
│  │                                 │  00:28 navigate /dashboard│
│  │                                 │                           │
│  │                                 ├───────────────────────────┤
│  │                                 │  Network          [Clear] │
│  │                                 │  ────────────────────────  │
│  │                                 │  GET  /api/user     200   │
│  │                                 │  POST /api/login    200   │
│  │                                 │  GET  /api/data     200   │
│  └─────────────────────────────────┴───────────────────────────┘
│                                                                 │
│  [Screenshot Preview]  DOM: 142 elements  Requests: 8          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                        [Cancel]  [Stop & Save] │
└─────────────────────────────────────────────────────────────────┘
```

## Page Structure

```typescript
// src/app/record/page.tsx
'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSSE } from '@/hooks/use-sse';
import { startRecording, stopRecording, cancelRecording } from '@/lib/actions/recording';
import { UrlInput } from './components/url-input';
import { BrowserEmbed } from './components/browser-embed';
import { EventFeed } from './components/event-feed';
import { NetworkPanel } from './components/network-panel';
import { RecordingControls } from './components/recording-controls';

export default function RecordPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // SSE for real-time events
  const { data: events } = useSSE<RecordingEvent>(
    sessionId ? `/api/recording?sessionId=${sessionId}` : null
  );

  const handleStart = async (url: string) => {
    const session = await startRecording(url);
    setSessionId(session.id);
    setProjectId(session.projectId);
    setIsRecording(true);
  };

  const handleStop = async () => {
    if (!sessionId || !projectId) return;
    setIsSaving(true);
    const project = await stopRecording(sessionId, projectId);
    router.push(`/project/${project.id}`);
  };

  const handleCancel = async () => {
    if (!sessionId || !projectId) return;
    setIsCanceling(true);
    await cancelRecording(sessionId, projectId);
    setSessionId(null);
    setProjectId(null);
    setIsRecording(false);
    setIsCanceling(false);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <UrlInput onStart={handleStart} disabled={isRecording} />

      {isRecording && sessionId && (
        <>
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <BrowserEmbed sessionId={sessionId} />
            </div>
            <div className="flex flex-col gap-4">
              <EventFeed events={events} />
              <NetworkPanel events={events} />
            </div>
          </div>

          <RecordingControls
            isRecording={isRecording}
            onStop={handleStop}
            onCancel={handleCancel}
            eventCount={events.length}
            networkCount={events.filter(e => e.type === 'network').length}
            screenshotCount={events.filter(e => e.type === 'screenshot').length}
            startTime={Date.now()}
            isSaving={isSaving}
            isCanceling={isCanceling}
          />
        </>
      )}
    </div>
  );
}
```

## Components

```typescript
// URL input with validation
interface UrlInputProps {
  onStart: (url: string) => void;
  disabled: boolean;
}

function UrlInput({ onStart, disabled }: UrlInputProps);

// AnchorBrowser embed
interface BrowserEmbedProps {
  sessionId: string;
}

function BrowserEmbed({ sessionId }: BrowserEmbedProps) {
  // AnchorBrowser provides a live view URL for the session
  // This embeds the remote browser view
  const liveViewUrl = `https://live.anchorbrowser.io/session/${sessionId}`;

  return (
    <iframe
      src={liveViewUrl}
      className="w-full h-full rounded-lg border"
      allow="clipboard-read; clipboard-write"
    />
  );
}

// Real-time event feed
interface EventFeedProps {
  events: RecordingEvent[];
}

function EventFeed({ events }: EventFeedProps);

// Network requests panel
interface NetworkPanelProps {
  events: RecordingEvent[];
}

function NetworkPanel({ events }: NetworkPanelProps);

// Recording controls (timer, stop button)
interface RecordingControlsProps {
  isRecording: boolean;
  onStop: () => void;
  onCancel: () => void;
  eventCount: number;
  networkCount: number;
  screenshotCount: number;
  startTime: number;
  isSaving: boolean;
  isCanceling: boolean;
}

function RecordingControls({ isRecording, onStop, onCancel, eventCount, networkCount, screenshotCount, startTime, isSaving, isCanceling }: RecordingControlsProps);
```

## Server Actions

```typescript
// src/lib/actions/recording.ts
'use server'

import { getCrayonService } from '@/lib/crayon';
import { redirect } from 'next/navigation';

export async function startRecording(url: string) {
  const service = getCrayonService();

  // Create project
  const project = await service.createProject({
    name: new URL(url).hostname,
    sourceUrl: url,
    status: 'recording',
  });

  // Start AnchorBrowser session
  const session = await service.startRecording(project.id, url);

  return {
    id: session.id,
    projectId: project.id,
    liveViewUrl: session.liveViewUrl,
  };
}

export async function stopRecording(sessionId: string, projectId: string) {
  // Takes projectId to ensure redirect works even if server session is lost
  const service = getCrayonService();

  // Stop recording and save
  const recording = await service.stopRecording(sessionId);

  // Update project status
  await service.updateProject(recording.projectId, {
    status: 'recorded',
  });

  return { id: recording.projectId };
}

export async function cancelRecording(sessionId: string, projectId: string) {
  // Closes browser session and deletes the project
  const service = getCrayonService();

  // Stop the recording session
  await service.stopRecording(sessionId);

  // Delete the project
  await service.deleteProject(projectId);
}
```

## SSE API Route

```typescript
// src/app/api/recording/route.ts
import { getCrayonService } from '@/lib/crayon';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const service = getCrayonService();

      // Subscribe to recording events
      const unsubscribe = service.subscribeToRecording(sessionId, (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      });

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Testing Requirements

### Unit Tests (`recording-page.test.tsx`)
- Test URL input validation
- Test recording state transitions
- Test event feed rendering
- Mock SSE and server actions

### Integration Tests
- Start recording via UI
- Verify events stream in
- Stop recording creates project

## Definition of Done

- [ ] Can enter URL and start recording
- [ ] AnchorBrowser embed displays live session
- [ ] Events stream in real-time
- [ ] Network requests shown
- [ ] Stop saves recording and redirects
- [ ] Cancel discards recording and returns to initial state
- [ ] Timer shows elapsed time
- [ ] Responsive layout
