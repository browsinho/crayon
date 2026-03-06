"use client";

import { StepList, type Step } from "./step-status";
import { LogViewer, type LogEntry } from "./log-viewer";
import { X } from "lucide-react";

export type GenerationStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

interface GenerationProgressProps {
  steps: Step[];
  logs: LogEntry[];
  progress: number;
  status: GenerationStatus;
  tokensUsed?: number;
  estimatedCost?: number;
  componentsGenerated?: string[];
  onCancel: () => void;
  onRetry?: (stepId: string) => void;
}

export function GenerationProgress({
  steps,
  logs,
  progress,
  status,
  tokensUsed = 0,
  estimatedCost = 0,
  componentsGenerated = [],
  onCancel,
  onRetry,
}: GenerationProgressProps) {
  const isActive = status === "running";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {status === "running" && "Generating Sandbox..."}
          {status === "completed" && "Generation Complete"}
          {status === "failed" && "Generation Failed"}
          {status === "cancelled" && "Generation Cancelled"}
        </h2>
        {isActive && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats Card */}
      {(tokensUsed > 0 || componentsGenerated.length > 0) && (
        <div className="grid grid-cols-3 gap-4 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tokens Used</p>
            <p className="text-lg font-semibold">{tokensUsed.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Estimated Cost</p>
            <p className="text-lg font-semibold">${estimatedCost.toFixed(3)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Components</p>
            <p className="text-lg font-semibold">{componentsGenerated.length}</p>
          </div>
        </div>
      )}

      {/* Component Preview */}
      {componentsGenerated.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Generated Components</h3>
          <div className="flex flex-wrap gap-2">
            {componentsGenerated.map((component, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20"
              >
                {component}
              </span>
            ))}
          </div>
        </div>
      )}

      <StepList steps={steps} onRetry={status === "failed" ? onRetry : undefined} />

      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Logs</h3>
        <LogViewer logs={logs} />
      </div>
    </div>
  );
}
