"use client";

import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@crayon/types";
import {
  FolderOpen,
  Plus,
  Trash2,
  Search,
  Grid3X3,
  List,
  Play,
  Wand2,
  ChevronDown,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useTransition, useCallback } from "react";
import { deleteProject } from "@/lib/actions/projects";

interface ProjectListProps {
  initialProjects: Project[];
}

type ViewMode = "grid" | "list";
type SortField = "updatedAt" | "name" | "status";
type SortOrder = "asc" | "desc";

interface SortOption {
  field: SortField;
  order: SortOrder;
  label: string;
}

const sortOptions: SortOption[] = [
  { field: "updatedAt", order: "desc", label: "Recent" },
  { field: "name", order: "asc", label: "Name" },
  { field: "status", order: "asc", label: "Status" },
];

const statusOrder: Record<ProjectStatus, number> = {
  error: 0,
  generating: 1,
  analyzing: 2,
  recording: 3,
  recorded: 4,
  ready: 5,
  draft: 6,
};

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

interface StatusBadgeProps {
  status: ProjectStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<
    ProjectStatus,
    { color: string; label: string; pulse?: boolean }
  > = {
    draft: { color: "bg-gray-100 text-gray-700", label: "Draft" },
    recording: {
      color: "bg-red-100 text-red-700",
      label: "Recording",
      pulse: true,
    },
    recorded: { color: "bg-yellow-100 text-yellow-700", label: "Recorded" },
    analyzing: {
      color: "bg-blue-100 text-blue-700",
      label: "Analyzing",
      pulse: true,
    },
    generating: {
      color: "bg-blue-100 text-blue-700",
      label: "Generating",
      pulse: true,
    },
    ready: { color: "bg-green-100 text-green-700", label: "Ready" },
    error: { color: "bg-red-100 text-red-700", label: "Error" },
  };

  const { color, label, pulse } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        color
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              status === "recording" ? "bg-red-400" : "bg-blue-400"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              status === "recording" ? "bg-red-500" : "bg-blue-500"
            )}
          />
        </span>
      )}
      {label}
    </span>
  );
}

interface DeleteProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DeleteProjectDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Escape") onOpenChange(false);
        }}
        aria-label="Close dialog"
      />
      <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Delete project?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently delete &quot;{project.name}&quot; and all
              associated data. This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProjectActionsProps {
  project: Project;
  onDelete: () => void;
}

export function ProjectActions({ project, onDelete }: ProjectActionsProps) {
  return (
    <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
      {project.status === "ready" && (
        <Link
          href={`/project/${project.id}/sandbox`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          <Play className="h-3 w-3" />
          Launch
        </Link>
      )}
      {project.status === "recorded" && (
        <Link
          href={`/project/${project.id}/generate`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          <Wand2 className="h-3 w-3" />
          Generate
        </Link>
      )}
      <button
        onClick={onDelete}
        className="rounded-md p-1 hover:bg-destructive/10 hover:text-destructive"
        title="Delete project"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  onDelete: () => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <div className="group relative rounded-lg border bg-card transition-shadow hover:shadow-md">
      <Link href={`/project/${project.id}`} className="block">
        <div className="relative h-32 w-full overflow-hidden rounded-t-lg bg-muted">
          {project.thumbnail ? (
            <Image
              src={project.thumbnail}
              alt={project.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold truncate">{project.name}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {project.sourceUrl}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={project.status} />
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(project.updatedAt)}
            </span>
          </div>
        </div>
      </Link>
      <div className="border-t p-2">
        <ProjectActions project={project} onDelete={onDelete} />
      </div>
    </div>
  );
}

interface ProjectListItemProps {
  project: Project;
  onDelete: () => void;
}

export function ProjectListItem({ project, onDelete }: ProjectListItemProps) {
  return (
    <div className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <Link
        href={`/project/${project.id}`}
        className="flex flex-1 items-center gap-4"
      >
        <div className="relative h-16 w-24 overflow-hidden rounded bg-muted">
          {project.thumbnail ? (
            <Image
              src={project.thumbnail}
              alt={project.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <FolderOpen className="h-6 w-6 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{project.name}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {project.sourceUrl}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={project.status} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(project.updatedAt)}
          </span>
        </div>
      </Link>
      <ProjectActions project={project} onDelete={onDelete} />
    </div>
  );
}

interface NewProjectCardProps {
  viewMode: ViewMode;
}

export function NewProjectCard({ viewMode }: NewProjectCardProps) {
  if (viewMode === "list") {
    return (
      <Link
        href="/record"
        className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="h-5 w-5" />
        <span>New Recording</span>
      </Link>
    );
  }

  return (
    <Link
      href="/record"
      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[200px]"
    >
      <Plus className="h-8 w-8" />
      <span className="font-medium">New Recording</span>
    </Link>
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

function Select({ value, onChange, options, className }: SelectProps) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md border bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

interface ProjectFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortOption: string;
  onSortChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ProjectFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortOption,
  onSortChange,
  viewMode,
  onViewModeChange,
}: ProjectFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <Select
        value={statusFilter}
        onChange={onStatusFilterChange}
        options={[
          { value: "all", label: "All" },
          { value: "ready", label: "Ready" },
          { value: "recorded", label: "Recorded" },
          { value: "generating", label: "Generating" },
          { value: "error", label: "Error" },
        ]}
      />
      <Select
        value={sortOption}
        onChange={onSortChange}
        options={sortOptions.map((opt) => ({
          value: `${opt.field}-${opt.order}`,
          label: opt.label,
        }))}
      />
      <div className="flex rounded-md border">
        <button
          onClick={() => onViewModeChange("grid")}
          className={cn(
            "rounded-l-md p-2",
            viewMode === "grid" ? "bg-muted" : "hover:bg-muted"
          )}
          title="Grid view"
        >
          <Grid3X3 className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewModeChange("list")}
          className={cn(
            "rounded-r-md p-2",
            viewMode === "list" ? "bg-muted" : "hover:bg-muted"
          )}
          title="List view"
        >
          <List className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface ProjectGridProps {
  projects: Project[];
  viewMode: ViewMode;
  onDeleteProject: (project: Project) => void;
}

export function ProjectGrid({
  projects,
  viewMode,
  onDeleteProject,
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FolderOpen className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 font-semibold">No projects found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No projects match your filters. Try adjusting your search or create a
          new recording.
        </p>
        <Link
          href="/record"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Recording
        </Link>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-2">
        {projects.map((project) => (
          <ProjectListItem
            key={project.id}
            project={project}
            onDelete={() => onDeleteProject(project)}
          />
        ))}
        <NewProjectCard viewMode="list" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onDelete={() => onDeleteProject(project)}
        />
      ))}
      <NewProjectCard viewMode="grid" />
    </div>
  );
}

export function ProjectList({ initialProjects }: ProjectListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOption, setSortOption] = useState("updatedAt-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [deleteDialogProject, setDeleteDialogProject] = useState<Project | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.sourceUrl.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Apply sorting
    const [field, order] = sortOption.split("-") as [SortField, SortOrder];
    result.sort((a, b) => {
      let comparison = 0;
      if (field === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (field === "updatedAt") {
        comparison =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (field === "status") {
        comparison = statusOrder[a.status] - statusOrder[b.status];
      }
      return order === "desc" ? -comparison : comparison;
    });

    return result;
  }, [projects, search, statusFilter, sortOption]);

  const handleDelete = useCallback((project: Project) => {
    setDeleteDialogProject(project);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteDialogProject) return;

    const projectId = deleteDialogProject.id;
    startTransition(async () => {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setDeleteDialogProject(null);
    });
  }, [deleteDialogProject]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <ProjectFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortOption={sortOption}
          onSortChange={setSortOption}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        <Link
          href="/record"
          className="ml-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Record
        </Link>
      </div>

      <ProjectGrid
        projects={filteredAndSortedProjects}
        viewMode={viewMode}
        onDeleteProject={handleDelete}
      />

      {deleteDialogProject && (
        <DeleteProjectDialog
          project={deleteDialogProject}
          open={!!deleteDialogProject}
          onOpenChange={(open) => !open && setDeleteDialogProject(null)}
          onConfirm={confirmDelete}
          isPending={isPending}
        />
      )}
    </div>
  );
}
