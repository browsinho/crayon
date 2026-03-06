"use client";

import { useState, useEffect } from "react";
import { Circle, Square, Image, Network, Layers } from "lucide-react";

export interface RecordingControlsProps {
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

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function RecordingControls({
  isRecording,
  onStop,
  onCancel,
  eventCount,
  networkCount,
  screenshotCount,
  startTime,
  isSaving,
  isCanceling,
}: RecordingControlsProps) {
  const isPending = isSaving || isCanceling;
  const [elapsed, setElapsed] = useState(0);

  // Update elapsed time every second
  useEffect(() => {
    if (!isRecording || !startTime) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      setElapsed(Date.now() - startTime);
    };

    // Update immediately
    updateElapsed();

    // Then update every second
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isRecording, startTime]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Recording indicator */}
          <div className="flex items-center gap-2">
            <Circle
              className={`h-3 w-3 ${isRecording ? "fill-red-500 text-red-500 animate-pulse" : "fill-muted text-muted"}`}
            />
            <span className="font-mono text-lg font-medium">
              {isRecording ? formatDuration(elapsed) : "00:00"}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1" title="DOM events">
              <Layers className="h-4 w-4" />
              <span>{eventCount}</span>
            </div>
            <div className="flex items-center gap-1" title="Network requests">
              <Network className="h-4 w-4" />
              <span>{networkCount}</span>
            </div>
            <div className="flex items-center gap-1" title="Screenshots">
              <Image className="h-4 w-4" />
              <span>{screenshotCount}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {isCanceling ? "Canceling..." : "Cancel"}
          </button>
          <button
            onClick={onStop}
            disabled={!isRecording || isPending}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Square className="h-4 w-4 fill-current" />
            {isSaving ? "Saving..." : "Stop & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
