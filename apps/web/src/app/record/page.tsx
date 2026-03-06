"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/actions/projects";
import { startRecording, stopRecording, cancelRecording } from "@/lib/actions/recording";
import { useSSE } from "@/hooks/use-sse";
import type { RecordingEvent } from "@/app/api/recording/route";
import { Circle } from "lucide-react";
import {
  UrlInput,
  BrowserEmbed,
  EventFeed,
  NetworkPanel,
  RecordingControls,
} from "./components";

interface RecordingSession {
  sessionId: string;
  projectId: string;
  liveViewUrl: string;
  startTime: number;
}

export default function RecordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [localEvents, setLocalEvents] = useState<RecordingEvent[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // SSE for real-time events
  const { data: sseEvents } = useSSE<RecordingEvent>(
    session ? `/api/recording?sessionId=${session.sessionId}` : null
  );

  // Combine local events with SSE events
  const events = [...localEvents, ...sseEvents];

  const handleStart = useCallback((url: string) => {
    startTransition(async () => {
      // Create project from the URL hostname
      const hostname = new URL(url).hostname;
      const project = await createProject({
        name: hostname,
        sourceUrl: url,
      });

      // Start recording
      const result = await startRecording(project.id, url);

      setSession({
        sessionId: result.sessionId,
        projectId: project.id,
        liveViewUrl: result.liveViewUrl,
        startTime: Date.now(),
      });
      setLocalEvents([]);
    });
  }, []);

  const handleStop = useCallback(() => {
    if (!session) return;

    setIsSaving(true);
    startTransition(async () => {
      const result = await stopRecording(session.sessionId, session.projectId);
      router.push(`/project/${result.projectId}`);
    });
  }, [session, router]);

  const handleCancel = useCallback(() => {
    if (!session) return;

    setIsCanceling(true);
    startTransition(async () => {
      await cancelRecording(session.sessionId, session.projectId);
      setSession(null);
      setLocalEvents([]);
      setIsCanceling(false);
    });
  }, [session]);

  const handleClearEvents = useCallback(() => {
    setLocalEvents([]);
  }, []);

  const handleClearNetwork = useCallback(() => {
    setLocalEvents((prev) => prev.filter((e) => e.type !== "network"));
  }, []);

  // Calculate stats
  const eventCount = events.filter((e) =>
    ["navigate", "click", "input", "dom"].includes(e.type)
  ).length;
  const networkCount = events.filter((e) => e.type === "network").length;
  const screenshotCount = events.filter((e) => e.type === "screenshot").length;

  const isRecording = !!session;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Recording</h2>
          <p className="text-muted-foreground">
            Record a browser session to generate a sandbox.
          </p>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-red-500">
            <Circle className="h-2 w-2 fill-current animate-pulse" />
            <span className="text-sm font-medium">REC</span>
          </div>
        )}
      </div>

      {/* URL Input - Only shown before recording starts */}
      {!isRecording && (
        <div className="rounded-lg border bg-card p-6">
          <UrlInput onStart={handleStart} disabled={isPending} />

          <div className="mt-6 rounded-lg border bg-muted/50 p-4">
            <h3 className="font-medium">Recording Tips</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Navigate through the pages you want to capture</li>
              <li>Interact with forms, buttons, and other elements</li>
              <li>The recording will capture DOM, network calls, and screenshots</li>
              <li>Click &quot;Stop &amp; Save&quot; when you&apos;re done</li>
            </ul>
          </div>
        </div>
      )}

      {/* Recording View - Shown during recording */}
      {isRecording && session && (
        <>
          <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
            {/* Browser embed (2/3 width) */}
            <div className="col-span-2 min-h-[400px]">
              <BrowserEmbed liveViewUrl={session.liveViewUrl} />
            </div>

            {/* Side panels (1/3 width) */}
            <div className="flex flex-col gap-4">
              <EventFeed
                events={events}
                startTime={session.startTime}
                onClear={handleClearEvents}
              />
              <NetworkPanel events={events} onClear={handleClearNetwork} />
            </div>
          </div>

          {/* Recording controls */}
          <RecordingControls
            isRecording={isRecording}
            onStop={handleStop}
            onCancel={handleCancel}
            eventCount={eventCount}
            networkCount={networkCount}
            screenshotCount={screenshotCount}
            startTime={session.startTime}
            isSaving={isSaving}
            isCanceling={isCanceling}
          />
        </>
      )}
    </div>
  );
}
