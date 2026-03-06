# Next.js Web Application

Main web application for Crayon using Next.js 15 App Router.

## ⚠️ External Integration

**USE WEB SEARCH** to find current Next.js 15 best practices.
- Search: "Next.js 15 App Router best practices 2025"
- Search: "Next.js server actions patterns"
- Search: "Next.js API routes with streaming"
- Search: "shadcn/ui installation Next.js"

Do NOT guess. Find the real docs.

## Acceptance Criteria

- [ ] Next.js 15 app with App Router
- [ ] Tailwind CSS + shadcn/ui components
- [ ] Server actions for @crayon/core operations
- [ ] Real-time updates via Server-Sent Events
- [ ] API routes for long-running operations
- [ ] Authentication ready (API key based)
- [ ] Responsive layout

## Architecture

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with providers
│   │   ├── page.tsx             # Home → Project list
│   │   ├── record/
│   │   │   └── page.tsx         # Recording session
│   │   ├── project/
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # Project overview
│   │   │       ├── generate/
│   │   │       │   └── page.tsx # Generation pipeline
│   │   │       └── sandbox/
│   │   │           └── page.tsx # Sandbox viewer
│   │   ├── settings/
│   │   │   └── page.tsx         # Settings page
│   │   └── api/
│   │       ├── recording/
│   │       │   └── route.ts     # Recording SSE stream
│   │       ├── generate/
│   │       │   └── route.ts     # Generation SSE stream
│   │       └── sandbox/
│   │           └── route.ts     # Sandbox control
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── nav.tsx
│   │   └── shared/
│   │       ├── loading.tsx
│   │       └── error-boundary.tsx
│   ├── lib/
│   │   ├── actions/             # Server actions
│   │   │   ├── projects.ts
│   │   │   ├── recording.ts
│   │   │   ├── generation.ts
│   │   │   └── sandbox.ts
│   │   ├── crayon.ts            # @crayon/core wrapper
│   │   └── utils.ts
│   └── hooks/
│       ├── use-sse.ts           # SSE subscription hook
│       └── use-project.ts
├── public/
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Project list (home) |
| `/record` | New recording session |
| `/project/[id]` | Project detail/overview |
| `/project/[id]/generate` | Generation pipeline |
| `/project/[id]/sandbox` | Sandbox viewer |
| `/settings` | API keys and settings |

## Server Actions

```typescript
// src/lib/actions/projects.ts
'use server'

import { getCrayonService } from '@/lib/crayon';

export async function listProjects() {
  const service = getCrayonService();
  return service.listProjects();
}

export async function createProject(name: string, sourceUrl: string) {
  const service = getCrayonService();
  return service.createProject({ name, sourceUrl });
}

export async function deleteProject(id: string) {
  const service = getCrayonService();
  return service.deleteProject(id);
}
```

## SSE Streaming API

```typescript
// src/app/api/recording/route.ts
import { getCrayonService } from '@/lib/crayon';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const service = getCrayonService();

      service.onRecordingEvent(sessionId, (event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        service.stopRecording(sessionId);
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

## Client SSE Hook

```typescript
// src/hooks/use-sse.ts
'use client'

import { useEffect, useState } from 'react';

export function useSSE<T>(url: string | null) {
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!url) return;

    const eventSource = new EventSource(url);

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onerror = (e) => setError(new Error('SSE connection failed'));
    eventSource.onmessage = (e) => {
      const parsed = JSON.parse(e.data) as T;
      setData((prev) => [...prev, parsed]);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [url]);

  return { data, error, isConnected };
}
```

## Layout Structure

```typescript
// src/app/layout.tsx
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <Header />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
```

## Dependencies

```json
{
  "dependencies": {
    "@crayon/core": "workspace:*",
    "@crayon/types": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "@types/react": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.3"
  }
}
```

## Testing Requirements

### Unit Tests
- Test server actions with mocked @crayon/core
- Test SSE hook with mock EventSource
- Test component rendering

### Integration Tests
- Full page renders correctly
- Navigation between routes works
- SSE connection established

## Definition of Done

- [ ] App runs with `pnpm dev`
- [ ] All routes render without errors
- [ ] Server actions call @crayon/core
- [ ] SSE streaming works for recording/generation
- [ ] Tailwind + shadcn/ui styled
- [ ] Responsive on mobile/tablet/desktop
