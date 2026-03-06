"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { FileTree } from "./file-tree";
import { CodeViewer } from "./code-viewer";
import type { FileNode } from "./types";
import { getSandboxFiles, getSandboxFileContent } from "@/lib/actions/sandbox";

interface CodeTabProps {
  sandboxId: string;
}

export function CodeTab({ sandboxId }: CodeTabProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  useEffect(() => {
    const loadFiles = async () => {
      setIsLoadingFiles(true);
      try {
        const fileTree = await getSandboxFiles(sandboxId);
        setFiles(fileTree);
      } catch (error) {
        console.error("Failed to load files:", error);
      } finally {
        setIsLoadingFiles(false);
      }
    };
    loadFiles();
  }, [sandboxId]);

  const handleSelectFile = useCallback(
    async (path: string) => {
      setSelectedPath(path);
      setIsLoadingContent(true);
      try {
        const fileContent = await getSandboxFileContent(sandboxId, path);
        setContent(fileContent);
      } catch (error) {
        console.error("Failed to load file content:", error);
        setContent(null);
      } finally {
        setIsLoadingContent(false);
      }
    },
    [sandboxId]
  );

  if (isLoadingFiles) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full rounded-lg border overflow-hidden">
      <div className="w-64 border-r overflow-auto bg-muted/30">
        <div className="p-2 border-b">
          <span className="text-sm font-medium">Files</span>
        </div>
        {files.length > 0 ? (
          <FileTree
            files={files}
            selectedPath={selectedPath}
            onSelect={handleSelectFile}
          />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            No files found
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedPath ? (
          isLoadingContent ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : content !== null ? (
            <CodeViewer content={content} filename={selectedPath} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Failed to load file
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a file to view its contents
          </div>
        )}
      </div>
    </div>
  );
}
