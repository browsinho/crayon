import { getCrayonService } from "@/lib/crayon";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export interface RecordingEvent {
  type: "connected" | "dom" | "network" | "screenshot" | "navigate" | "click" | "input" | "error";
  sessionId: string;
  timestamp: number;
  data?: {
    url?: string;
    selector?: string;
    value?: string;
    method?: string;
    status?: number;
    screenshotUrl?: string;
    error?: string;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const service = getCrayonService();

      const handleEvent = (event: unknown) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      service.onRecordingEvent(sessionId, handleEvent);

      // Send initial connected message
      const connectedEvent: RecordingEvent = {
        type: "connected",
        sessionId,
        timestamp: Date.now(),
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(connectedEvent)}\n\n`)
      );

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        service.offRecordingEvent(sessionId, handleEvent);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
