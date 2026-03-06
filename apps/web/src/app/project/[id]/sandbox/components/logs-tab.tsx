"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSSE } from "@/hooks/use-sse";
import type { LogEntry } from "./types";

interface LogsTabProps {
  sandboxId: string;
}

export function LogsTab({ sandboxId }: LogsTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const { data: logs, isConnected } = useSSE<LogEntry>(
    isPaused ? null : `/api/sandbox/${sandboxId}/logs`
  );

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;

    setIsAtBottom(atBottom);
    if (atBottom) {
      setAutoScroll(true);
    }
  };

  const handleUserScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;

    if (!atBottom) {
      setAutoScroll(false);
    }
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
      setAutoScroll(true);
    }
  };

  const getLevelClass = (level?: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "text-red-400";
      case "warn":
        return "text-yellow-400";
      default:
        return "text-green-400";
    }
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-gray-400"
            )}
          />
          <span className="text-sm text-muted-foreground">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-muted"
        >
          {isPaused ? (
            <>
              <Play className="h-3 w-3" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-3 w-3" />
              Pause
            </>
          )}
        </button>
      </div>

      <div className="relative flex-1">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onWheel={handleUserScroll}
          className="h-full overflow-auto bg-black text-sm font-mono p-4 rounded-lg"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500">Waiting for logs...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={getLevelClass(log.level)}>
                <span className="text-gray-500 select-none">
                  [{log.timestamp}]
                </span>{" "}
                {log.message}
              </div>
            ))
          )}
        </div>

        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
          >
            <ArrowDown className="h-3 w-3" />
            <span>Auto-scroll</span>
          </button>
        )}
      </div>
    </div>
  );
}
