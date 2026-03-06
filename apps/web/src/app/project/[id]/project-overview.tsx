"use client";

import { cn } from "@/lib/utils";
import type { Project, Recording, Sandbox, DOMSnapshot, NetworkCall } from "@crayon/types";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  Clock,
  Code,
  Globe,
  Image,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectOverviewProps {
  project: Project;
  recording: Recording | null;
  sandbox: Sandbox | null;
}

function DOMSnapshotItem({ snapshot, index }: { snapshot: DOMSnapshot; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {snapshot.type}
              </Badge>
              <span className="text-sm truncate max-w-[200px]">{snapshot.url}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(snapshot.timestamp).toLocaleTimeString()} · {snapshot.viewport.width}x{snapshot.viewport.height}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {expanded && snapshot.html && (
        <div className="border-t p-3">
          <ScrollArea className="h-48">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
              {snapshot.html.substring(0, 5000)}
              {snapshot.html.length > 5000 && "\n... (truncated)"}
            </pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function NetworkCallItem({ call, index }: { call: NetworkCall; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET": return "text-green-500";
      case "POST": return "text-blue-500";
      case "PUT": return "text-yellow-500";
      case "DELETE": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="border rounded-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-mono font-medium", getMethodColor(call.request.method))}>
                {call.request.method}
              </span>
              <span className="text-xs text-muted-foreground">{call.response.status}</span>
              <span className="text-sm truncate max-w-[200px]">
                {new URL(call.request.url).pathname}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">
              {call.request.url}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="border-t p-3 space-y-3">
          {call.request.body && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Request Body</p>
              <ScrollArea className="h-24">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
                  {tryFormatJson(call.request.body)}
                </pre>
              </ScrollArea>
            </div>
          )}
          {call.response.body && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Response Body</p>
              <ScrollArea className="h-24">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
                  {tryFormatJson(call.response.body.substring(0, 2000))}
                  {call.response.body.length > 2000 && "\n... (truncated)"}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function tryFormatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

export function ProjectOverview({
  project,
  recording,
  sandbox,
}: ProjectOverviewProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showNetworkCalls, setShowNetworkCalls] = useState(false);
  const [showScreenshots, setShowScreenshots] = useState(false);

  const hasRecording = recording && (recording.domSnapshots?.length ?? 0) > 0;
  const hasSandbox = project.status === "ready" && sandbox;

  const getStatusBadge = () => {
    switch (project.status) {
      case "recorded":
        return (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Recording complete
          </Badge>
        );
      case "ready":
        return (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-500">
            <CheckCircle className="h-3 w-3" />
            Sandbox ready
          </Badge>
        );
      case "generating":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3 animate-spin" />
            Generating...
          </Badge>
        );
      default:
        return <Badge variant="secondary">{project.status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Project header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          {getStatusBadge()}
        </div>
        <a
          href={project.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {project.sourceUrl}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Main actions */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Generate / Regenerate */}
          {hasRecording && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {hasSandbox ? "Regenerate sandbox" : "Generate sandbox"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasSandbox
                    ? "Rebuild the sandbox from your recording"
                    : "Create a sandbox from your recording"}
                </p>
              </div>
              <Button 
                asChild 
                variant={hasSandbox ? "outline" : "default"}
                className={hasSandbox ? "" : "gradient-bg border-0 text-white font-semibold"}
              >
                <Link href={`/project/${project.id}/generate`}>
                  {hasSandbox ? "Regenerate" : "Generate"}
                </Link>
              </Button>
            </div>
          )}

          {/* Separator if both actions shown */}
          {hasRecording && hasSandbox && (
            <div className="border-t" />
          )}

          {/* View sandbox */}
          {hasSandbox && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">View sandbox</p>
                <p className="text-sm text-muted-foreground">
                  Open and interact with your sandbox
                </p>
              </div>
              <Button asChild className="gradient-bg border-0 text-white font-semibold">
                <Link href={`/project/${project.id}/sandbox`}>
                  Open
                </Link>
              </Button>
            </div>
          )}

          {/* No recording state */}
          {!hasRecording && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">
                No recording data available.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/">Start a new recording</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recording details (collapsed) */}
      {hasRecording && recording && (
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowDetails(!showDetails)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                Recording details
              </CardTitle>
              {showDetails ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {showDetails && (
            <CardContent className="pt-0 space-y-4">
              {/* Stats summary */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">DOM Snapshots</p>
                  <p className="font-medium">
                    {recording.domSnapshots?.length ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Network Calls</p>
                  <p className="font-medium">
                    {recording.networkCalls?.length ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Screenshots</p>
                  <p className="font-medium">
                    {recording.screenshots?.length ?? 0}
                  </p>
                </div>
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {new Date(project.createdAt).toLocaleString()}
                </p>
              </div>

              {/* DOM Snapshots dropdown */}
              {recording.domSnapshots && recording.domSnapshots.length > 0 && (
                <div className="border-t pt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSnapshots(!showSnapshots);
                    }}
                    className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors w-full"
                  >
                    <Code className="h-4 w-4 text-muted-foreground" />
                    <span>DOM Snapshots ({recording.domSnapshots.length})</span>
                    {showSnapshots ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    )}
                  </button>
                  {showSnapshots && (
                    <div className="mt-3 space-y-2">
                      {recording.domSnapshots.map((snapshot, i) => (
                        <DOMSnapshotItem key={snapshot.id} snapshot={snapshot} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Network Calls dropdown */}
              {recording.networkCalls && recording.networkCalls.length > 0 && (
                <div className="border-t pt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNetworkCalls(!showNetworkCalls);
                    }}
                    className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors w-full"
                  >
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>Network Calls ({recording.networkCalls.length})</span>
                    {showNetworkCalls ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    )}
                  </button>
                  {showNetworkCalls && (
                    <div className="mt-3 space-y-2">
                      {recording.networkCalls.map((call, i) => (
                        <NetworkCallItem key={call.id} call={call} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Screenshots dropdown */}
              {recording.screenshots && recording.screenshots.length > 0 && (
                <div className="border-t pt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowScreenshots(!showScreenshots);
                    }}
                    className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors w-full"
                  >
                    <Image className="h-4 w-4 text-muted-foreground" />
                    <span>Screenshots ({recording.screenshots.length})</span>
                    {showScreenshots ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    )}
                  </button>
                  {showScreenshots && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {recording.screenshots.map((screenshot, i) => (
                        <div key={screenshot.id} className="border rounded-md p-2">
                          <p className="text-xs text-muted-foreground">
                            #{i + 1} · {screenshot.width}x{screenshot.height}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {new Date(screenshot.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Sandbox details */}
      {hasSandbox && sandbox && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Sandbox status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  sandbox.status === "running"
                    ? "bg-green-500"
                    : "bg-muted-foreground"
                )}
              />
              <span className="text-sm capitalize">{sandbox.status}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
