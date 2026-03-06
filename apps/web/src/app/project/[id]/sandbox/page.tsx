"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  getSandbox,
  startSandbox,
  stopSandbox,
  restartSandbox,
  checkSandboxFiles,
} from "@/lib/actions/sandbox";
import type { Sandbox } from "@crayon/types";
import { cn } from "@/lib/utils";
import {
  Code,
  Globe,
  Loader2,
  RefreshCw,
  Square,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrowserTab, CodeTab, McpTab, CheckpointBar } from "./components";

type TabId = "browser" | "code" | "mcp";

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: "browser", label: "Browser", icon: Globe },
  { id: "code", label: "Code", icon: Code },
  { id: "mcp", label: "MCP", icon: Workflow },
];

export default function SandboxPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabId>("browser");
  const [hasSandboxFiles, setHasSandboxFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSandbox = async () => {
      setIsLoading(true);
      setError(null);
      const [sandboxResult, hasFiles] = await Promise.all([
        getSandbox(projectId),
        checkSandboxFiles(projectId),
      ]);
      if (sandboxResult.success) {
        setSandbox(sandboxResult.data);
      } else {
        setError(sandboxResult.error);
        setSandbox(null);
      }
      setHasSandboxFiles(hasFiles);
      setIsLoading(false);
    };
    loadSandbox();
  }, [projectId]);

  const handleStart = () => {
    startTransition(async () => {
      setError(null);
      const result = await startSandbox(projectId);
      if (result.success) {
        setSandbox(result.data);
      } else {
        setError(result.error);
      }
    });
  };

  const handleStop = () => {
    startTransition(async () => {
      setError(null);
      await stopSandbox(projectId);
      const result = await getSandbox(projectId);
      if (result.success) {
        setSandbox(result.data);
      } else {
        setError(result.error);
      }
    });
  };

  const handleRestart = () => {
    startTransition(async () => {
      const result = await restartSandbox(projectId);
      setSandbox(result);
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <div className="text-center max-w-md space-y-2">
          <p className="text-sm font-medium text-destructive">Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          {error.includes("Docker") && (
            <p className="text-xs text-muted-foreground">
              Make sure Docker Desktop is running.
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            setIsLoading(true);
            Promise.all([getSandbox(projectId), checkSandboxFiles(projectId)])
              .then(([sandboxResult, hasFiles]) => {
                if (sandboxResult.success) {
                  setSandbox(sandboxResult.data);
                } else {
                  setError(sandboxResult.error);
                }
                setHasSandboxFiles(hasFiles);
              })
              .finally(() => setIsLoading(false));
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!sandbox) {
    if (hasSandboxFiles) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
          <div className="text-center space-y-1">
            <p className="font-medium">Sandbox files ready</p>
            <p className="text-sm text-muted-foreground">
              Start the sandbox to begin
            </p>
          </div>
          <Button onClick={handleStart} disabled={isPending} className="gradient-bg border-0 text-white font-semibold">
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isPending ? "Starting..." : "Start"}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <div className="text-center space-y-1">
          <p className="font-medium">No sandbox available</p>
          <p className="text-sm text-muted-foreground">
            Generate a sandbox first
          </p>
        </div>
        <Button asChild>
          <Link href={`/project/${projectId}/generate`}>Generate Sandbox</Link>
        </Button>
      </div>
    );
  }

  const isRunning = sandbox.status === "running";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isRunning ? "bg-green-500" : "bg-muted-foreground"
            )}
          />
          <span className="text-sm font-medium capitalize">
            {sandbox.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestart}
                disabled={isPending}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Restart
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                disabled={isPending}
              >
                <Square className="mr-2 h-3 w-3" />
                Stop
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleStart} disabled={isPending} className="gradient-bg border-0 text-white font-semibold">
              {isPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : null}
              Start
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors -mb-px",
                activeTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {!isRunning ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Start the sandbox to view its contents
          </div>
        ) : (
          <>
            {activeTab === "browser" && (
              <BrowserTab
                sandboxId={sandbox.id}
                sandboxUrl={sandbox.url}
                frontendPort={sandbox.ports.frontend}
              />
            )}
            {activeTab === "code" && <CodeTab sandboxId={sandbox.id} />}
            {activeTab === "mcp" && <McpTab sandboxId={sandbox.id} />}
          </>
        )}
      </div>

      {/* Checkpoint bar */}
      {isRunning && <CheckpointBar sandboxId={sandbox.id} />}
    </div>
  );
}
