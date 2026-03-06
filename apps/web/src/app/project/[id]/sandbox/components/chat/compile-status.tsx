import { Check, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompileDoneEventData } from "@/app/api/sandbox/[sandboxId]/chat/types";

interface CompileStatusProps {
  result: CompileDoneEventData;
}

export function CompileStatus({ result }: CompileStatusProps) {
  return (
    <div
      className={cn(
        "border rounded-lg p-3",
        result.success
          ? "bg-green-500/10 border-green-500/30"
          : "bg-red-500/10 border-red-500/30"
      )}
    >
      <div className="flex items-center gap-2">
        {result.success ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Build successful
            </span>
          </>
        ) : (
          <>
            <X className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              Build failed ({result.errors.length} error
              {result.errors.length !== 1 ? "s" : ""})
            </span>
          </>
        )}
      </div>

      {/* Error list */}
      {result.errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {result.errors.slice(0, 5).map((error, index) => (
            <div key={index} className="text-xs font-mono">
              <span className="text-muted-foreground">
                {error.file}:{error.line}:{error.column}
              </span>
              <span className="text-red-600 dark:text-red-400 ml-2">
                {error.message}
              </span>
            </div>
          ))}
          {result.errors.length > 5 && (
            <div className="text-xs text-muted-foreground">
              ...and {result.errors.length - 5} more errors
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-3 w-3" />
          <span>{result.warnings.length} warning(s)</span>
        </div>
      )}
    </div>
  );
}
