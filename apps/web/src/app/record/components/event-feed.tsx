"use client";

import { useRef, useEffect } from "react";
import { MousePointer, Navigation, Keyboard, Trash2 } from "lucide-react";
import type { RecordingEvent } from "@/app/api/recording/route";

export interface EventFeedProps {
  events: RecordingEvent[];
  startTime: number;
  onClear: () => void;
}

function formatTimestamp(timestamp: number, startTime: number): string {
  const elapsed = Math.max(0, timestamp - startTime);
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getEventIcon(type: RecordingEvent["type"]) {
  switch (type) {
    case "click":
      return <MousePointer className="h-3 w-3" />;
    case "navigate":
      return <Navigation className="h-3 w-3" />;
    case "input":
      return <Keyboard className="h-3 w-3" />;
    default:
      return null;
  }
}

function getEventDescription(event: RecordingEvent): string {
  switch (event.type) {
    case "navigate":
      return `navigate ${event.data?.url ?? ""}`;
    case "click":
      return `click ${event.data?.selector ?? "element"}`;
    case "input":
      return `type ${event.data?.selector ?? "input"}`;
    case "connected":
      return "session connected";
    default:
      return event.type;
  }
}

export function EventFeed({ events, startTime, onClear }: EventFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter to only show user interaction events
  const displayEvents = events.filter((e) =>
    ["navigate", "click", "input"].includes(e.type)
  );

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayEvents.length]);

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-medium">Events</h3>
        <button
          onClick={onClear}
          disabled={displayEvents.length === 0}
          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Clear events"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 max-h-48">
        {displayEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No events yet. Interact with the browser to see events.
          </p>
        ) : (
          <div className="space-y-1">
            {displayEvents.map((event, index) => (
              <div
                key={`${event.timestamp}-${index}`}
                className="flex items-center gap-2 text-xs"
              >
                <span className="font-mono text-muted-foreground">
                  {formatTimestamp(event.timestamp, startTime)}
                </span>
                <span className="text-muted-foreground">
                  {getEventIcon(event.type)}
                </span>
                <span className="truncate">{getEventDescription(event)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
