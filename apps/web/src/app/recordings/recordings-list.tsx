"use client";

import { cn } from "@/lib/utils";
import type { Project } from "@crayon/types";
import {
  Camera,
  Clock,
  ExternalLink,
  FileVideo,
  FolderOpen,
  Globe,
  Network,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";

interface RecordingsListProps {
  projects: Project[];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

interface RecordingCardProps {
  project: Project;
}

function RecordingCard({ project }: RecordingCardProps) {
  const recording = project.recording;
  const stats = recording?.stats;

  return (
    <Link
      href={`/project/${project.id}`}
      className="group block rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <FileVideo className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold group-hover:text-primary">
                {project.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {recording?.startUrl || project.sourceUrl}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              recording?.status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            )}
          >
            {recording?.status || "recorded"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">DOM Snapshots</p>
              <p className="font-medium">{stats?.domSnapshots ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Network Calls</p>
              <p className="font-medium">{stats?.networkCalls ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Screenshots</p>
              <p className="font-medium">{stats?.screenshots ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {recording?.createdAt
                ? formatRelativeTime(recording.createdAt)
                : formatRelativeTime(project.createdAt)}
            </span>
            <a
              href={project.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="h-3 w-3" />
              <span className="truncate max-w-[200px]">
                {new URL(project.sourceUrl).hostname}
              </span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <span className="text-sm font-medium text-primary">
            View Project
          </span>
        </div>
      </div>
    </Link>
  );
}

interface RecordingListItemProps {
  project: Project;
}

function RecordingListItem({ project }: RecordingListItemProps) {
  const recording = project.recording;
  const stats = recording?.stats;

  return (
    <Link
      href={`/project/${project.id}`}
      className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="rounded-full bg-blue-100 p-2">
        <FileVideo className="h-5 w-5 text-blue-600" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate group-hover:text-primary">
            {project.name}
          </h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              recording?.status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            )}
          >
            {recording?.status || "recorded"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {recording?.startUrl || project.sourceUrl}
        </p>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-center">
          <p className="font-medium">{stats?.domSnapshots ?? 0}</p>
          <p className="text-xs text-muted-foreground">DOM</p>
        </div>
        <div className="text-center">
          <p className="font-medium">{stats?.networkCalls ?? 0}</p>
          <p className="text-xs text-muted-foreground">Network</p>
        </div>
        <div className="text-center">
          <p className="font-medium">{stats?.screenshots ?? 0}</p>
          <p className="text-xs text-muted-foreground">Screenshots</p>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {recording?.createdAt
          ? formatRelativeTime(recording.createdAt)
          : formatRelativeTime(project.createdAt)}
      </div>
    </Link>
  );
}

export function RecordingsList({ projects }: RecordingsListProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const filteredProjects = useMemo(() => {
    if (!search) return projects;
    const searchLower = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.sourceUrl.toLowerCase().includes(searchLower) ||
        p.recording?.startUrl?.toLowerCase().includes(searchLower)
    );
  }, [projects, search]);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FileVideo className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 font-semibold">No recordings yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Start recording a website to see it here.
        </p>
        <Link
          href="/record"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Start Recording
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search recordings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex rounded-md border">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-l-md px-3 py-2 text-sm",
              viewMode === "grid" ? "bg-muted" : "hover:bg-muted"
            )}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-r-md px-3 py-2 text-sm",
              viewMode === "list" ? "bg-muted" : "hover:bg-muted"
            )}
          >
            List
          </button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No recordings found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search terms.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <RecordingCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredProjects.map((project) => (
            <RecordingListItem key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
