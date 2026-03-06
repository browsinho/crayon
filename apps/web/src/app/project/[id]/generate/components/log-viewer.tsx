"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";

export interface LogEntry {
  timestamp: string;
  message: string;
  level?: "info" | "warn" | "error";
}

interface LogViewerProps {
  logs: LogEntry[];
  className?: string;
}

export function LogViewer({ logs, className }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

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

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
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

  const getLevelClass = (level?: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "text-red-500";
      case "warn":
        return "text-yellow-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onWheel={handleUserScroll}
        className="h-48 overflow-auto font-mono text-sm bg-muted p-3 rounded-md"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground/60">
            Waiting for logs...
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={cn("leading-relaxed", getLevelClass(log.level))}>
              <span className="text-muted-foreground/60 select-none">
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
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        >
          <ArrowDown className="h-3 w-3" />
          <span>Auto-scroll</span>
        </button>
      )}
    </div>
  );
}
