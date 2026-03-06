"use client";

import { useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";
import type { RecordingEvent } from "@/app/api/recording/route";
import { cn } from "@/lib/utils";

export interface NetworkPanelProps {
  events: RecordingEvent[];
  onClear: () => void;
}

function getStatusColor(status?: number): string {
  if (!status) return "text-muted-foreground";
  if (status >= 200 && status < 300) return "text-green-500";
  if (status >= 300 && status < 400) return "text-yellow-500";
  if (status >= 400) return "text-red-500";
  return "text-muted-foreground";
}

function getMethodColor(method?: string): string {
  switch (method?.toUpperCase()) {
    case "GET":
      return "text-blue-500";
    case "POST":
      return "text-green-500";
    case "PUT":
    case "PATCH":
      return "text-yellow-500";
    case "DELETE":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

function formatUrl(url?: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

export function NetworkPanel({ events, onClear }: NetworkPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter to only show network events
  const networkEvents = events.filter((e) => e.type === "network");

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [networkEvents.length]);

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-medium">Network</h3>
        <button
          onClick={onClear}
          disabled={networkEvents.length === 0}
          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Clear network"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 max-h-48">
        {networkEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No network requests yet.
          </p>
        ) : (
          <div className="space-y-1">
            {networkEvents.map((event, index) => (
              <div
                key={`${event.timestamp}-${index}`}
                className="flex items-center gap-2 text-xs font-mono"
              >
                <span
                  className={cn("w-10 shrink-0", getMethodColor(event.data?.method))}
                >
                  {event.data?.method ?? "GET"}
                </span>
                <span className="flex-1 truncate" title={event.data?.url}>
                  {formatUrl(event.data?.url)}
                </span>
                <span
                  className={cn("w-8 shrink-0 text-right", getStatusColor(event.data?.status))}
                >
                  {event.data?.status ?? "-"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
