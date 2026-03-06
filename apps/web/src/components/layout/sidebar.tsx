"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { listProjects } from "@/lib/actions/projects";
import type { Project } from "@crayon/types";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .finally(() => setIsLoading(false));
  }, [pathname]); // Refetch when navigating

  const isProjectActive = (projectId: string) => {
    return pathname.startsWith(`/project/${projectId}`);
  };

  return (
    <aside className="flex w-52 flex-col border-r bg-card/50">
      <div className="flex h-12 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <div className="h-5 w-5 rounded-full gradient-bg-sharp" />
          <span>Crayon</span>
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-4">
        {/* Home link */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === "/"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          Home
        </Link>

        {/* Record link */}
        <Link
          href="/record"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === "/record"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          <Plus className="h-4 w-4" />
          New Recording
        </Link>

        {/* Projects section */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Projects
          </p>
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Loading...</p>
          ) : projects.length === 0 ? (
            <div className="px-3 py-2">
              <p className="text-sm text-muted-foreground mb-2">No projects yet</p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href="/record">Start recording</Link>
              </Button>
            </div>
          ) : (
            <nav className="space-y-0.5">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors truncate",
                    isProjectActive(project.id)
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                  title={project.name}
                >
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full flex-shrink-0",
                      project.status === "ready"
                        ? "bg-green-500"
                        : project.status === "recorded"
                        ? "bg-blue-500"
                        : "bg-muted-foreground"
                    )}
                  />
                  <span className="truncate">{project.name}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-2 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          Settings
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}
