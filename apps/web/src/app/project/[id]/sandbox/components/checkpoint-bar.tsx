"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckpointData } from "./types";
import {
  getSandboxCheckpoints,
  createSandboxCheckpoint,
  restoreSandboxCheckpoint,
} from "@/lib/actions/sandbox";

interface CheckpointBarProps {
  sandboxId: string;
}

export function CheckpointBar({ sandboxId }: CheckpointBarProps) {
  const [checkpoints, setCheckpoints] = useState<CheckpointData[]>([]);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const loadCheckpoints = async () => {
      setIsLoading(true);
      try {
        const data = await getSandboxCheckpoints(sandboxId);
        setCheckpoints(data);
        if (data.length > 0) {
          setCurrentCheckpoint(data[0].id);
        }
      } catch (error) {
        console.error("Failed to load checkpoints:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCheckpoints();
  }, [sandboxId]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const checkpoint = await createSandboxCheckpoint(sandboxId, newName);
      setCheckpoints((prev) => [...prev, checkpoint]);
      setCurrentCheckpoint(checkpoint.id);
      setShowNameInput(false);
      setNewName("");
    } catch (error) {
      console.error("Failed to create checkpoint:", error);
    } finally {
      setIsCreating(false);
    }
  }, [sandboxId, newName]);

  const handleRestore = useCallback(
    async (checkpointId: string) => {
      setIsRestoring(checkpointId);
      try {
        await restoreSandboxCheckpoint(sandboxId, checkpointId);
        setCurrentCheckpoint(checkpointId);
      } catch (error) {
        console.error("Failed to restore checkpoint:", error);
      } finally {
        setIsRestoring(null);
      }
    },
    [sandboxId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleCreate();
      } else if (e.key === "Escape") {
        setShowNameInput(false);
        setNewName("");
      }
    },
    [handleCreate]
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2 border-t">
        <span className="text-sm font-medium">Checkpoints:</span>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 border-t overflow-x-auto">
      <span className="text-sm font-medium shrink-0">Checkpoints:</span>
      <div className="flex gap-1">
        {checkpoints.map((cp) => (
          <button
            key={cp.id}
            onClick={() => handleRestore(cp.id)}
            disabled={isRestoring !== null}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors",
              currentCheckpoint === cp.id
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-muted",
              isRestoring === cp.id && "opacity-50"
            )}
          >
            {isRestoring === cp.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : currentCheckpoint === cp.id ? (
              <Check className="h-3 w-3" />
            ) : null}
            {cp.name}
          </button>
        ))}

        {showNameInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Checkpoint name"
              className="rounded-md border bg-background px-2 py-1 text-sm w-32"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
              className="rounded-md bg-primary px-2 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
            <button
              onClick={() => {
                setShowNameInput(false);
                setNewName("");
              }}
              className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNameInput(true)}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
            Create
          </button>
        )}
      </div>
    </div>
  );
}
