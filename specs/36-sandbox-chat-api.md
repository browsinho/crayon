# Sandbox Chat API

Streaming API endpoint for the sandbox code chat feature.

## ⚠️ External Integration

**USE WEB SEARCH** for documentation on:
- Search: "Next.js 15 streaming response server actions 2025"
- Search: "Server-Sent Events SSE Next.js App Router"
- Search: "React Server Components streaming data"

## Purpose

Provides a streaming HTTP endpoint for the sandbox chat interface. Accepts user messages, processes them through the code agent, and streams back events (tool calls, results, final response).

## Acceptance Criteria

- [ ] Accepts POST requests with user message and conversation history
- [ ] Streams Server-Sent Events (SSE) with agent progress
- [ ] Validates request authentication (session-based)
- [ ] Validates sandbox exists and user has access
- [ ] Handles errors gracefully with proper error events
- [ ] Supports request cancellation via AbortController
- [ ] Includes rate limiting (max 10 requests per minute per session)
- [ ] Logs all chat interactions for debugging

## Interface

### HTTP Endpoint

```
POST /api/sandbox/[sandboxId]/chat

Request Headers:
  Content-Type: application/json
  Cookie: (session cookie)

Request Body:
{
  "message": "Change the title to 'Welcome'",
  "history": [
    { "role": "user", "content": "previous message" },
    { "role": "assistant", "content": "previous response" }
  ]
}

Response Headers:
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive

Response Body (SSE stream):
  event: thinking
  data: {"timestamp": 1234567890}

  event: tool_call
  data: {"toolName": "read_file", "toolInput": {"path": "src/App.tsx"}}

  event: tool_result
  data: {"toolName": "read_file", "success": true, "output": "..."}

  event: message
  data: {"content": "I've updated the title..."}

  event: compile_start
  data: {}

  event: compile_done
  data: {"success": true, "errors": []}

  event: done
  data: {"filesModified": ["src/App.tsx"], "tokensUsed": {"input": 500, "output": 200}}

  event: error
  data: {"message": "Something went wrong", "code": "AGENT_ERROR"}
```

### Type Definitions

```typescript
// apps/web/src/app/api/sandbox/[sandboxId]/chat/types.ts

import { z } from "zod";

// ==================== REQUEST ====================

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ).max(50).default([]),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ==================== SSE EVENTS ====================

export type SSEEventType =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "message"
  | "compile_start"
  | "compile_done"
  | "done"
  | "error";

export interface SSEEvent {
  event: SSEEventType;
  data: Record<string, unknown>;
}

// Specific event data types
export interface ThinkingEventData {
  timestamp: number;
}

export interface ToolCallEventData {
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface ToolResultEventData {
  toolName: string;
  success: boolean;
  output: string;
  durationMs: number;
}

export interface MessageEventData {
  content: string;
}

export interface CompileStartEventData {
  // No additional data
}

export interface CompileDoneEventData {
  success: boolean;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
  }>;
  warnings: Array<{
    file: string;
    line: number;
    message: string;
  }>;
  durationMs: number;
}

export interface DoneEventData {
  filesModified: string[];
  tokensUsed: {
    input: number;
    output: number;
  };
  toolCallsCount: number;
}

export interface ErrorEventData {
  message: string;
  code: "VALIDATION_ERROR" | "AUTH_ERROR" | "SANDBOX_NOT_FOUND" | "AGENT_ERROR" | "RATE_LIMIT";
}
```

## Implementation

### Route Handler

```typescript
// apps/web/src/app/api/sandbox/[sandboxId]/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createCodeAgent, type AgentEvent } from "@crayon/core";
import { getServerSession } from "next-auth"; // or your auth solution
import { ChatRequestSchema, type SSEEvent } from "./types";
import { getRateLimiter } from "@/lib/rate-limiter";
import { getSettings } from "@/lib/settings";

// Rate limiter: 10 requests per minute per session
const rateLimiter = getRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
});

export async function POST(
  request: NextRequest,
  { params }: { params: { sandboxId: string } }
) {
  const { sandboxId } = params;

  // ==================== AUTHENTICATION ====================
  
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // ==================== RATE LIMITING ====================

  const rateLimitResult = await rateLimiter.check(session.user.id);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfter),
        },
      }
    );
  }

  // ==================== VALIDATE REQUEST ====================

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parseResult = ChatRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { message, history } = parseResult.data;

  // ==================== VALIDATE SANDBOX EXISTS ====================

  const sandboxPath = `./data/projects/${sandboxId}/sandbox`;
  if (!fs.existsSync(sandboxPath)) {
    return NextResponse.json(
      { error: "Sandbox not found" },
      { status: 404 }
    );
  }

  // ==================== GET API KEY ====================

  const settings = await getSettings();
  const apiKey = settings.anthropicApiKey || settings.openaiApiKey;
  const provider = settings.anthropicApiKey ? "anthropic" : "openai";

  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key configured. Please add an API key in settings." },
      { status: 400 }
    );
  }

  // ==================== STREAM RESPONSE ====================

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE events
      const sendEvent = (event: SSEEvent) => {
        const data = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // Get or start dev container
        const containerInfo = await ensureDevContainer(sandboxId, sandboxPath);

        // Create code agent
        const agent = createCodeAgent({
          sandboxId,
          sandboxPath: path.resolve(sandboxPath),
          containerId: containerInfo.containerId,
          provider,
          apiKey,
          maxTokens: 4096,
          maxToolCalls: 20,
        });

        // Process message with streaming
        const resultGenerator = agent.chatStream(message, history);

        let filesModified: string[] = [];
        let tokensUsed = { input: 0, output: 0 };
        let toolCallsCount = 0;

        for await (const event of resultGenerator) {
          // Map agent events to SSE events
          switch (event.type) {
            case "thinking":
              sendEvent({
                event: "thinking",
                data: { timestamp: event.timestamp },
              });
              break;

            case "tool_call":
              sendEvent({
                event: "tool_call",
                data: {
                  toolName: event.data.toolName,
                  toolInput: event.data.toolInput,
                },
              });
              toolCallsCount++;
              break;

            case "tool_result":
              sendEvent({
                event: "tool_result",
                data: {
                  toolName: event.data.toolName || "unknown",
                  success: event.data.success,
                  output: truncateOutput(event.data.toolOutput || "", 5000),
                  durationMs: Date.now() - event.timestamp,
                },
              });
              break;

            case "message":
              sendEvent({
                event: "message",
                data: { content: event.data.content },
              });
              break;

            case "compile_start":
              sendEvent({
                event: "compile_start",
                data: {},
              });
              break;

            case "compile_done":
              sendEvent({
                event: "compile_done",
                data: {
                  success: event.data.compileSuccess,
                  errors: event.data.compileErrors || [],
                  warnings: [],
                  durationMs: 0,
                },
              });
              break;

            case "error":
              sendEvent({
                event: "error",
                data: {
                  message: event.data.error || "Unknown error",
                  code: "AGENT_ERROR",
                },
              });
              break;
          }
        }

        // Get final result
        const result = await agent.getLastResult();
        filesModified = result?.filesModified || [];
        tokensUsed = result?.tokensUsed || { input: 0, output: 0 };

        // Send done event
        sendEvent({
          event: "done",
          data: {
            filesModified,
            tokensUsed,
            toolCallsCount,
          },
        });

        // Log the interaction
        await logChatInteraction({
          sandboxId,
          userId: session.user.id,
          message,
          filesModified,
          tokensUsed,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error("[Chat API] Error:", error);

        sendEvent({
          event: "error",
          data: {
            message: error instanceof Error ? error.message : "Unknown error",
            code: "AGENT_ERROR",
          },
        });
      } finally {
        controller.close();
      }
    },

    cancel() {
      // Handle client disconnect
      console.log("[Chat API] Client disconnected");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

// Helper: Truncate long outputs
function truncateOutput(output: string, maxLength: number): string {
  if (output.length <= maxLength) return output;
  return output.slice(0, maxLength) + "\n... (truncated)";
}

// Helper: Ensure dev container is running
async function ensureDevContainer(
  sandboxId: string,
  sandboxPath: string
): Promise<{ containerId: string }> {
  const devManager = createDevContainerManager();
  let info = await devManager.getStatus(sandboxId);

  if (!info || info.status !== "running") {
    info = await devManager.start({
      sandboxId,
      projectPath: path.resolve(sandboxPath),
    });
  }

  return { containerId: info.containerId };
}

// Helper: Log chat interactions for debugging
async function logChatInteraction(data: {
  sandboxId: string;
  userId: string;
  message: string;
  filesModified: string[];
  tokensUsed: { input: number; output: number };
  timestamp: Date;
}): Promise<void> {
  const logDir = `./data/projects/${data.sandboxId}/chat-logs`;
  await fs.mkdir(logDir, { recursive: true });

  const logFile = path.join(logDir, `${data.timestamp.toISOString().slice(0, 10)}.jsonl`);
  const logEntry = JSON.stringify(data) + "\n";

  await fs.appendFile(logFile, logEntry);
}
```

### Server Action Alternative

For simpler integration, also provide a server action:

```typescript
// apps/web/src/lib/actions/chat.ts

"use server";

import { createCodeAgent } from "@crayon/core";
import { getSettings } from "@/lib/settings";

export interface ChatActionResult {
  success: boolean;
  response?: string;
  filesModified?: string[];
  compileResult?: {
    success: boolean;
    errors: Array<{ file: string; line: number; message: string }>;
  };
  error?: string;
}

/**
 * Non-streaming chat action (simpler but no progress updates)
 */
export async function sendChatMessage(
  sandboxId: string,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ChatActionResult> {
  try {
    const sandboxPath = `./data/projects/${sandboxId}/sandbox`;

    if (!fs.existsSync(sandboxPath)) {
      return { success: false, error: "Sandbox not found" };
    }

    const settings = await getSettings();
    const apiKey = settings.anthropicApiKey || settings.openaiApiKey;
    const provider = settings.anthropicApiKey ? "anthropic" : "openai";

    if (!apiKey) {
      return { success: false, error: "No API key configured" };
    }

    const agent = createCodeAgent({
      sandboxId,
      sandboxPath: path.resolve(sandboxPath),
      provider,
      apiKey,
    });

    const result = await agent.chat(message, history);

    return {
      success: result.success,
      response: result.response,
      filesModified: result.filesModified,
      compileResult: result.compileResult,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

## Rate Limiter

```typescript
// apps/web/src/lib/rate-limiter.ts

interface RateLimiterConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // Seconds until next allowed request
}

// Simple in-memory rate limiter (use Redis for production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function getRateLimiter(config: RateLimiterConfig) {
  return {
    async check(userId: string): Promise<RateLimitResult> {
      const now = Date.now();
      const key = userId;

      let record = requestCounts.get(key);

      // Reset if window expired
      if (!record || record.resetAt < now) {
        record = {
          count: 0,
          resetAt: now + config.windowMs,
        };
      }

      // Check limit
      if (record.count >= config.maxRequests) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          retryAfter,
        };
      }

      // Increment and allow
      record.count++;
      requestCounts.set(key, record);

      return {
        allowed: true,
        remaining: config.maxRequests - record.count,
        retryAfter: 0,
      };
    },
  };
}
```

## Client-Side Hook

```typescript
// apps/web/src/hooks/use-sandbox-chat.ts

import { useState, useCallback, useRef } from "react";
import type {
  SSEEvent,
  ToolCallEventData,
  ToolResultEventData,
  CompileDoneEventData,
} from "@/app/api/sandbox/[sandboxId]/chat/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCallEventData[];
  compileResult?: CompileDoneEventData;
}

export interface UseSandboxChatReturn {
  messages: ChatMessage[];
  isProcessing: boolean;
  currentToolCall: ToolCallEventData | null;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
  error: string | null;
}

export function useSandboxChat(sandboxId: string): UseSandboxChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentToolCall, setCurrentToolCall] = useState<ToolCallEventData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    setError(null);
    setIsProcessing(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Prepare assistant message placeholder
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      toolCalls: [],
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Build history for API
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Make streaming request
      const response = await fetch(`/api/sandbox/${sandboxId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Request failed");
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Keep incomplete event in buffer

        for (const eventStr of lines) {
          if (!eventStr.trim()) continue;

          const eventMatch = eventStr.match(/event: (\w+)\ndata: (.+)/s);
          if (!eventMatch) continue;

          const [, eventType, dataStr] = eventMatch;
          const data = JSON.parse(dataStr);

          // Handle different event types
          switch (eventType) {
            case "tool_call":
              setCurrentToolCall(data as ToolCallEventData);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  last.toolCalls = [...(last.toolCalls || []), data];
                }
                return updated;
              });
              break;

            case "tool_result":
              setCurrentToolCall(null);
              break;

            case "message":
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  last.content = data.content;
                }
                return updated;
              });
              break;

            case "compile_done":
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  last.compileResult = data as CompileDoneEventData;
                }
                return updated;
              });
              break;

            case "error":
              setError(data.message);
              break;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Request was cancelled
        return;
      }
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessing(false);
      setCurrentToolCall(null);
      abortControllerRef.current = null;
    }
  }, [sandboxId, messages]);

  const clearHistory = useCallback(() => {
    // Cancel any in-progress request
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isProcessing,
    currentToolCall,
    sendMessage,
    clearHistory,
    error,
  };
}
```

## Error Handling

```typescript
// apps/web/src/app/api/sandbox/[sandboxId]/chat/errors.ts

export class ChatAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "ChatAPIError";
  }
}

export const ErrorCodes = {
  VALIDATION_ERROR: { code: "VALIDATION_ERROR", status: 400 },
  AUTH_ERROR: { code: "AUTH_ERROR", status: 401 },
  RATE_LIMIT: { code: "RATE_LIMIT", status: 429 },
  SANDBOX_NOT_FOUND: { code: "SANDBOX_NOT_FOUND", status: 404 },
  NO_API_KEY: { code: "NO_API_KEY", status: 400 },
  AGENT_ERROR: { code: "AGENT_ERROR", status: 500 },
} as const;
```

## Testing Requirements

### Unit Tests (`chat-api.test.ts`)

```typescript
describe("Chat API", () => {
  describe("Request Validation", () => {
    test("accepts valid request", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
        history: [],
      });
      expect(result.success).toBe(true);
    });

    test("rejects empty message", () => {
      const result = ChatRequestSchema.safeParse({
        message: "",
        history: [],
      });
      expect(result.success).toBe(false);
    });

    test("rejects message over limit", () => {
      const result = ChatRequestSchema.safeParse({
        message: "x".repeat(10001),
        history: [],
      });
      expect(result.success).toBe(false);
    });

    test("rejects too much history", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
        history: Array(51).fill({ role: "user", content: "msg" }),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Rate Limiter", () => {
    test("allows requests under limit", async () => {
      const limiter = getRateLimiter({ windowMs: 60000, maxRequests: 10 });
      const result = await limiter.check("user1");
      expect(result.allowed).toBe(true);
    });

    test("blocks requests over limit", async () => {
      const limiter = getRateLimiter({ windowMs: 60000, maxRequests: 2 });
      await limiter.check("user2");
      await limiter.check("user2");
      const result = await limiter.check("user2");
      expect(result.allowed).toBe(false);
    });
  });
});
```

### Integration Tests (`chat-api.integration.test.ts`)

```typescript
describe("Chat API Integration", () => {
  // REQUIRES: Running Next.js server, Docker, LLM API key

  test("streams events correctly", async () => {
    const response = await fetch("http://localhost:3000/api/sandbox/test/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "List the files in the project",
        history: [],
      }),
    });

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const events: SSEEvent[] = [];
    const reader = response.body?.getReader();
    // ... parse and collect events

    // Should have thinking, tool_call, tool_result, message, done
    expect(events.some((e) => e.event === "thinking")).toBe(true);
    expect(events.some((e) => e.event === "done")).toBe(true);
  });

  test("returns error for non-existent sandbox", async () => {
    const response = await fetch(
      "http://localhost:3000/api/sandbox/nonexistent/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello", history: [] }),
      }
    );

    expect(response.status).toBe(404);
  });
});
```

## Definition of Done

- [ ] POST endpoint accepts messages and streams SSE events
- [ ] Request validation with Zod schema
- [ ] Rate limiting (10 req/min/user)
- [ ] Authentication check
- [ ] Sandbox existence check
- [ ] All event types stream correctly (thinking, tool_call, tool_result, message, compile_*, done, error)
- [ ] Client hook `useSandboxChat` works correctly
- [ ] Error events sent on failure
- [ ] Chat interactions logged
- [ ] Unit tests pass
- [ ] Integration tests pass
