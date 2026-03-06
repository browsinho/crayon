import { NextRequest, NextResponse } from "next/server";
import { createCodeAgent, createDevContainerManager } from "@crayon/core";
import { ChatRequestSchema, type SSEEvent } from "./types";
import { getRateLimiter } from "@/lib/rate-limiter";
import { getSettings } from "@/lib/settings";
import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";

export const dynamic = "force-dynamic";

// Rate limiter: 10 requests per minute per session
const rateLimiter = getRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;

  // ==================== AUTHENTICATION ====================
  // For demo purposes, using a simple session ID from headers or generating one
  // In production, use proper session management (NextAuth, etc.)

  const sessionId =
    request.headers.get("x-session-id") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "anonymous";

  // ==================== RATE LIMITING ====================

  const rateLimitResult = await rateLimiter.check(sessionId);
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  const sandboxPath = path.resolve(`./data/projects/${sandboxId}/sandbox`);
  if (!existsSync(sandboxPath)) {
    return NextResponse.json(
      { error: "Sandbox not found" },
      { status: 404 }
    );
  }

  // ==================== GET API KEY ====================

  const settings = await getSettings();
  const apiKey = settings.apiKeys.anthropic || settings.apiKeys.openai;
  const provider = settings.apiKeys.anthropic ? "anthropic" : "openai";

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "No API key configured. Please add an API key in settings.",
      },
      { status: 400 }
    );
  }

  // ==================== STREAM RESPONSE ====================

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE events
      const sendEvent = (event: SSEEvent) => {
        const data = `event: ${event.event}\ndata: ${JSON.stringify(
          event.data
        )}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // Get or start dev container
        const containerInfo = await ensureDevContainer(sandboxId, sandboxPath);

        // Create code agent
        const agent = createCodeAgent({
          sandboxId,
          sandboxPath,
          containerId: containerInfo.containerId,
          provider,
          apiKey,
          maxTokens: 4096,
          maxToolCalls: 20,
        });

        // Convert history format
        const agentHistory = history.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Process message with streaming
        const resultGenerator = agent.chatStream(message, agentHistory);

        const filesModified: string[] = [];
        const tokensUsed = { input: 0, output: 0 };
        let toolCallsCount = 0;
        const toolCallStartTimes = new Map<string, number>();

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
              toolCallStartTimes.set(
                event.data.toolName || "unknown",
                event.timestamp
              );
              sendEvent({
                event: "tool_call",
                data: {
                  toolName: event.data.toolName || "unknown",
                  toolInput: event.data.toolInput || {},
                },
              });
              toolCallsCount++;
              break;

            case "tool_result": {
              const toolName = event.data.toolName || "unknown";
              const startTime = toolCallStartTimes.get(toolName) || event.timestamp;
              sendEvent({
                event: "tool_result",
                data: {
                  toolName,
                  success: event.data.success || false,
                  output: truncateOutput(event.data.toolOutput || "", 5000),
                  durationMs: event.timestamp - startTime,
                },
              });
              toolCallStartTimes.delete(toolName);
              break;
            }

            case "message":
              sendEvent({
                event: "message",
                data: { content: event.data.content || "" },
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
                  success: event.data.compileSuccess || false,
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

        // Get final result - the generator returns it when done
        // For now, we'll track manually since the interface might differ
        // Send done event with accumulated data
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
          sessionId,
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
      // Client disconnected
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
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
      projectPath: sandboxPath,
    });
  }

  return { containerId: info.containerId };
}

// Helper: Log chat interactions for debugging
async function logChatInteraction(data: {
  sandboxId: string;
  sessionId: string;
  message: string;
  filesModified: string[];
  tokensUsed: { input: number; output: number };
  timestamp: Date;
}): Promise<void> {
  const logDir = `./data/projects/${data.sandboxId}/chat-logs`;
  await fs.mkdir(logDir, { recursive: true });

  const logFile = path.join(
    logDir,
    `${data.timestamp.toISOString().slice(0, 10)}.jsonl`
  );
  const logEntry = JSON.stringify(data) + "\n";

  await fs.appendFile(logFile, logEntry);
}
