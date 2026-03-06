import { getCrayonService } from "@/lib/crayon";
import { getSettings } from "@/lib/settings";
import { NextRequest } from "next/server";
import type { PipelineStage, PipelineEventStatus } from "@crayon/core";

export const dynamic = "force-dynamic";

export interface GenerationEvent {
  type: "connected" | "pipeline" | "complete" | "error";
  generationId: string;
  stage?: PipelineStage;
  status?: PipelineEventStatus;
  message?: string;
  progress?: number;
  timestamp?: number;
  metadata?: {
    tokensUsed?: number;
    estimatedCost?: number;
    componentsGenerated?: string[];
  };
  error?: string;
}

async function getOrchestrator() {
  const core = await import("@crayon/core");
  return {
    orchestrateStream: core.orchestrateStream,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get("generationId");

  if (!generationId) {
    return new Response(JSON.stringify({ error: "generationId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const projectId = generationId.split("-gen-")[0];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const service = getCrayonService();
      let aborted = false;

      request.signal.addEventListener("abort", () => {
        aborted = true;
        controller.close();
      });

      const sendEvent = (event: GenerationEvent) => {
        if (!aborted) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      };

      try {
        const project = await service.getProject(projectId);
        if (!project) {
          sendEvent({ type: "error", generationId, error: `Project not found: ${projectId}` });
          controller.close();
          return;
        }

        sendEvent({ type: "connected", generationId });

        const recordingId = projectId;

        const { orchestrateStream } = await getOrchestrator();
        const settings = await getSettings();

        const llmProvider = "anthropic" as const;
        const apiKey = settings.apiKeys[llmProvider];

        if (!apiKey) {
          sendEvent({ type: "error", generationId, error: `No API key configured for ${llmProvider}. Please add your API key in Settings.` });
          controller.close();
          return;
        }

        const config = {
          recordingId,
          projectId,
          llmProvider,
          apiKey,
          includeBackend: false,
          includeMockData: false,
        };

        for await (const pipelineEvent of orchestrateStream(config)) {
          if (aborted) break;

          sendEvent({
            type: "pipeline",
            generationId,
            stage: pipelineEvent.stage,
            status: pipelineEvent.status,
            message: pipelineEvent.message,
            progress: pipelineEvent.progress,
            timestamp: pipelineEvent.timestamp,
          });
        }

        if (aborted) return;

        await service.updateProject(projectId, { status: "ready" });

        sendEvent({
          type: "complete",
          generationId,
          message: "Generation completed successfully!",
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[Generate API] Error:", errorMessage);
        sendEvent({
          type: "error",
          generationId,
          error: `Generation failed: ${errorMessage}`,
        });
      } finally {
        controller.close();
      }
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
