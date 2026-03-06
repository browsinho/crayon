"use client";

import { useEffect, useState } from "react";
import { getAnalysisResults } from "@/lib/actions/generation";
import type { AnalysisResults as AnalysisResultsType } from "@/lib/generation-types";
import {
  Code2,
  Database,
  Globe,
  Key,
  LayoutGrid,
  Loader2,
  Puzzle,
} from "lucide-react";

interface AnalysisResultsProps {
  projectId: string;
}

export function AnalysisResults({ projectId }: AnalysisResultsProps) {
  const [analysis, setAnalysis] = useState<AnalysisResultsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalysis() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getAnalysisResults(projectId);
        if (cancelled) return;

        setAnalysis(result);
        if (!result) {
          setError("No analysis available. Please complete a recording first.");
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load analysis"
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAnalysis();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            Loading analysis...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-4">Analysis Results</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <Code2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <dt className="text-sm text-muted-foreground">Framework</dt>
            <dd className="font-medium">{analysis.framework}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Key className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <dt className="text-sm text-muted-foreground">Authentication</dt>
            <dd className="font-medium">{analysis.auth ?? "None detected"}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Globe className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <dt className="text-sm text-muted-foreground">API Routes</dt>
            <dd className="font-medium">{analysis.apiRoutes} endpoints</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Puzzle className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <dt className="text-sm text-muted-foreground">Widgets</dt>
            <dd className="font-medium">
              {analysis.widgets.length > 0
                ? analysis.widgets.join(", ")
                : "None detected"}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Database className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <dt className="text-sm text-muted-foreground">Database</dt>
            <dd className="font-medium">
              {analysis.database ?? "Not detected"}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <LayoutGrid className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <dt className="text-sm text-muted-foreground">Pages</dt>
            <dd className="font-medium">{analysis.pages.length} pages</dd>
          </div>
        </div>
      </div>
    </div>
  );
}
