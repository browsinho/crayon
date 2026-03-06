"use client";

import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle,
  Circle,
  Loader2,
  RefreshCw,
} from "lucide-react";

export type StepState = "pending" | "in_progress" | "completed" | "failed";

export interface Step {
  id: string;
  name: string;
  status: StepState;
  duration?: number;
  error?: string;
}

interface StepStatusProps {
  step: Step;
  onRetry?: (stepId: string) => void;
}

export function StepStatus({ step, onRetry }: StepStatusProps) {
  const formatDuration = (ms: number) => {
    return (ms / 1000).toFixed(1);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        {step.status === "completed" && (
          <CheckCircle className="h-5 w-5 text-green-500" />
        )}
        {step.status === "in_progress" && (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
        {step.status === "pending" && (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
        {step.status === "failed" && (
          <AlertCircle className="h-5 w-5 text-red-500" />
        )}
      </div>

      <span
        className={cn(
          "flex-1 text-sm",
          step.status === "completed" && "text-muted-foreground",
          step.status === "in_progress" && "font-medium",
          step.status === "pending" && "text-muted-foreground",
          step.status === "failed" && "text-red-500"
        )}
      >
        {step.name}
        {step.status === "in_progress" && "..."}
      </span>

      {step.duration !== undefined && step.status === "completed" && (
        <span className="text-sm text-muted-foreground">
          {formatDuration(step.duration)}s
        </span>
      )}

      {step.status === "failed" && onRetry && (
        <button
          onClick={() => onRetry(step.id)}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}

interface StepListProps {
  steps: Step[];
  onRetry?: (stepId: string) => void;
}

export function StepList({ steps, onRetry }: StepListProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-4">Steps</h3>
      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.id}>
            <StepStatus step={step} onRetry={onRetry} />
            {step.error && (
              <p className="ml-8 mt-1 text-sm text-red-500">{step.error}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
