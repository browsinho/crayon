"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle2, XCircle, Container } from "lucide-react";
import type { DockerStatus } from "@/lib/settings-shared";

export function DockerSection() {
  const [status, setStatus] = useState<DockerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<"stop-all" | "prune" | null>(
    null
  );

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings/docker");
      const data = await response.json();
      setStatus(data);
    } catch {
      setStatus({ running: false, containers: 0, images: 0 });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleAction = async (action: "stop-all" | "prune") => {
    setActionInProgress(action);
    try {
      await fetch("/api/settings/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await fetchStatus();
    } finally {
      setActionInProgress(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold">Docker</h3>
        <p className="text-sm text-muted-foreground">
          Docker daemon status and container management.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border p-4">
        <div
          className={`h-3 w-3 rounded-full ${status?.running ? "bg-green-500" : "bg-red-500"}`}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {status?.running ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium">Docker is running</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium">Docker is not running</span>
              </>
            )}
          </div>
          {status?.running && status.version && (
            <p className="text-sm text-muted-foreground">Version: {status.version}</p>
          )}
        </div>
      </div>

      {status?.running ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-md border p-4">
              <Container className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-semibold">{status.containers}</p>
                <p className="text-sm text-muted-foreground">Running containers</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-4">
              <Container className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-semibold">{status.images}</p>
                <p className="text-sm text-muted-foreground">Docker images</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex gap-2">
              <button
                onClick={() => handleAction("stop-all")}
                disabled={actionInProgress !== null || status.containers === 0}
                className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {actionInProgress === "stop-all" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Stop All Containers
              </button>
              <button
                onClick={() => handleAction("prune")}
                disabled={actionInProgress !== null}
                className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {actionInProgress === "prune" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Clean Up Unused
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertCircle className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-medium">Docker daemon is not running</p>
            <p className="text-sm">
              Please start Docker Desktop or the Docker daemon to use sandbox features.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
