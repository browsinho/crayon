"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSSE } from "@/hooks/use-sse";
import { startGeneration, cancelGeneration } from "@/lib/actions/generation";
import { defaultGenerationOptions } from "@/lib/generation-types";
import type { GenerationEvent } from "@/app/api/generate/route";
import { ArrowLeft, CheckCircle, Loader2, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const GENERATION_STEPS = [
  { id: "cleaning", name: "Cleaning recording" },
  { id: "summarizing", name: "Summarizing recording" },
  { id: "prompt_building", name: "Building prompt" },
  { id: "code_generation", name: "Generating code" },
  { id: "validation", name: "Validating code" },
  { id: "file_writing", name: "Writing files" },
  { id: "backend_generation", name: "Generating backend" },
  { id: "data_generation", name: "Generating data" },
  { id: "docker_build", name: "Building Docker image" },
  { id: "deployment", name: "Deploying sandbox" },
];

interface Step {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  error?: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "warn" | "error";
}

type GenerationStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

function useGenerationState(events: GenerationEvent[]) {
  return useMemo(() => {
    const completedStepIds = new Set<string>();
    const failedStepIds = new Set<string>();
    const logs: LogEntry[] = [];
    let currentStepId: string | undefined;
    let progress = 0;
    let status: GenerationStatus = "idle";
    let errorMessage: string | undefined;

    for (const event of events) {
      if (event.type === "connected") {
        status = "running";
      } else if (event.type === "pipeline") {
        const stage = event.stage;

        if (event.status === "started") {
          currentStepId = stage;
        } else if (event.status === "completed") {
          if (stage) {
            completedStepIds.add(stage);
          }
          if (stage === currentStepId) {
            currentStepId = undefined;
          }
        } else if (event.status === "failed") {
          if (stage) {
            failedStepIds.add(stage);
          }
          status = "failed";
          errorMessage = event.message;
        }

        if (event.progress !== undefined) {
          progress = event.progress;
        }

        if (event.message) {
          const timestamp = event.timestamp
            ? new Date(event.timestamp).toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : new Date().toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

          logs.push({
            timestamp,
            message: event.message,
            level: event.status === "failed" ? "error" : "info",
          });
        }
      } else if (event.type === "complete") {
        if (currentStepId) {
          completedStepIds.add(currentStepId);
        }
        status = "completed";
        progress = 100;
      } else if (event.type === "error") {
        status = "failed";
        errorMessage = event.error;
        logs.push({
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          message: event.error ?? "Unknown error",
          level: "error",
        });
      }
    }

    const steps: Step[] = GENERATION_STEPS.map((stepDef) => {
      let stepStatus: Step["status"] = "pending";

      if (failedStepIds.has(stepDef.id)) {
        stepStatus = "failed";
      } else if (completedStepIds.has(stepDef.id)) {
        stepStatus = "completed";
      } else if (currentStepId === stepDef.id) {
        stepStatus = status === "failed" ? "failed" : "in_progress";
      }

      return {
        id: stepDef.id,
        name: stepDef.name,
        status: stepStatus,
        error: stepStatus === "failed" ? errorMessage : undefined,
      };
    });

    return { steps, logs, progress, status };
  }, [events]);
}

export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { data: events, error, close } = useSSE<GenerationEvent>(
    generationId ? `/api/generate?generationId=${generationId}` : null
  );

  const { steps, logs, progress, status } = useGenerationState(events);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    try {
      const result = await startGeneration(projectId, defaultGenerationOptions);
      setGenerationId(result.generationId);
    } finally {
      setIsStarting(false);
    }
  }, [projectId]);

  const handleCancel = useCallback(async () => {
    if (generationId) {
      close();
      await cancelGeneration(generationId);
      setGenerationId(null);
    }
  }, [generationId, close]);

  // Redirect when complete
  useEffect(() => {
    if (status === "completed") {
      const timer = setTimeout(() => {
        router.push(`/project/${projectId}/sandbox`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, projectId, router]);

  const isGenerating = generationId !== null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link
        href={`/project/${projectId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to project
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Generate Sandbox
        </h1>
        <p className="text-muted-foreground">
          Create a sandbox environment from your recording
        </p>
      </div>

      {!isGenerating ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Ready to generate</p>
                <p className="text-sm text-muted-foreground">
                  This will analyze your recording and create a working sandbox
                </p>
              </div>
              <Button onClick={handleStart} disabled={isStarting} className="gradient-bg border-0 text-white font-semibold">
                {isStarting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isStarting ? "Starting..." : "Generate"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Progress bar */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {status === "running" && "Generating..."}
                  {status === "completed" && "Complete"}
                  {status === "failed" && "Failed"}
                </p>
                <p className="text-sm text-muted-foreground">{progress}%</p>
              </div>
              <Progress value={progress} />
            </CardContent>
          </Card>

          {/* Steps */}
          <Card>
            <CardContent className="p-6">
              <ul className="space-y-3">
                {steps.map((step) => (
                  <li key={step.id} className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {step.status === "completed" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {step.status === "in_progress" && (
                        <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                      )}
                      {step.status === "pending" && (
                        <div className="h-4 w-4 rounded-full border-2 border-muted" />
                      )}
                      {step.status === "failed" && (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        step.status === "completed" && "text-muted-foreground",
                        step.status === "in_progress" && "font-medium",
                        step.status === "pending" && "text-muted-foreground",
                        step.status === "failed" && "text-red-500"
                      )}
                    >
                      {step.name}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Logs */}
          {logs.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="max-h-48 overflow-auto font-mono text-xs scrollbar-thin">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className={cn(
                        "py-0.5",
                        log.level === "error" && "text-red-500",
                        log.level === "warn" && "text-yellow-500",
                        log.level === "info" && "text-muted-foreground"
                      )}
                    >
                      <span className="text-muted-foreground/60 select-none">
                        [{log.timestamp}]
                      </span>{" "}
                      {log.message}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {status === "running" && (
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            {status === "failed" && (
              <Button onClick={handleStart} className="gradient-bg border-0 text-white font-semibold">Retry</Button>
            )}
          </div>

          {/* Success message */}
          {status === "completed" && (
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="h-4 w-4" />
                  <p className="text-sm font-medium">
                    Generation complete. Redirecting to sandbox...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error message */}
          {(status === "failed" || error) && (
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-4">
                <p className="text-sm text-red-500">
                  {error?.message ?? "Generation failed. Please try again."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
