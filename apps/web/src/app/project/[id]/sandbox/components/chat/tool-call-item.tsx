import { useState } from "react";
import {
  FileText,
  FilePlus,
  FileEdit,
  FolderTree,
  Hammer,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  X,
} from "lucide-react";
import type { ToolCallEventData } from "@/app/api/sandbox/[sandboxId]/chat/types";

const toolIcons: Record<string, typeof FileText> = {
  read_file: FileText,
  write_file: FilePlus,
  edit_file: FileEdit,
  list_files: FolderTree,
  run_build: Hammer,
};

const toolLabels: Record<string, string> = {
  read_file: "Reading file",
  write_file: "Creating file",
  edit_file: "Editing file",
  list_files: "Listing files",
  run_build: "Building",
};

interface ToolCallItemProps {
  toolCall: ToolCallEventData & {
    success?: boolean;
    output?: string;
    isLoading?: boolean;
  };
}

export function ToolCallItem({ toolCall }: ToolCallItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const Icon = toolIcons[toolCall.toolName] || FileText;
  const label = toolLabels[toolCall.toolName] || toolCall.toolName;

  // Get file path from input if available
  const filePath = (toolCall.toolInput as { path?: string })?.path;

  return (
    <div className="border rounded-lg overflow-hidden bg-muted/30">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        {/* Status icon */}
        {toolCall.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : toolCall.success ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : toolCall.success === false ? (
          <X className="h-4 w-4 text-red-500" />
        ) : null}

        {/* Tool icon */}
        <Icon className="h-4 w-4 text-muted-foreground" />

        {/* Label */}
        <span className="text-sm font-medium">{label}</span>

        {/* File path */}
        {filePath && (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {filePath}
          </code>
        )}

        {/* Expand arrow */}
        <div className="ml-auto">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && toolCall.output && (
        <div className="border-t bg-muted/10">
          <pre className="p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto">
            {toolCall.output}
          </pre>
        </div>
      )}
    </div>
  );
}
