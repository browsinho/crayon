"use client";

import type { Sandbox } from "@crayon/types";
import { cn } from "@/lib/utils";
import { Loader2, Play, RefreshCw, Square } from "lucide-react";
import Link from "next/link";

interface SandboxControlsProps {
  projectId: string;
  sandbox: Sandbox;
  isPending: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}

export function SandboxControls({
  projectId,
  sandbox,
  isPending,
  onStart,
  onStop,
  onRestart,
}: SandboxControlsProps) {
  const isRunning = sandbox.status === "running";
  const isStarting = sandbox.status === "starting";

  return (
    <div className="flex items-center justify-between">
      <div>
        <Link
          href={`/project/${projectId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to project
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">Sandbox</h2>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isRunning
                ? "bg-green-500"
                : isStarting
                  ? "bg-yellow-500 animate-pulse"
                  : sandbox.status === "error"
                    ? "bg-red-500"
                    : "bg-gray-400"
            )}
          />
          <span className="text-sm text-muted-foreground capitalize">
            {sandbox.status}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isRunning ? (
          <>
            <button
              onClick={onRestart}
              disabled={isPending}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Restart
            </button>
            <button
              onClick={onStop}
              disabled={isPending}
              className="flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          </>
        ) : (
          <button
            onClick={onStart}
            disabled={isPending || isStarting}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending || isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start
          </button>
        )}
      </div>
    </div>
  );
}
