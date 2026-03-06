"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { formatBytes } from "@/lib/settings-shared";
import type { StorageUsage } from "@/lib/settings-shared";

export function StorageSection() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [isClearing, setIsClearing] = useState<"cache" | "all" | null>(null);
  const [showConfirm, setShowConfirm] = useState<"cache" | "all" | null>(null);

  const fetchUsage = async () => {
    try {
      const response = await fetch("/api/settings/storage");
      const data = await response.json();
      setUsage(data);
    } catch {
      // Ignore errors
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const handleClear = async (type: "cache" | "all") => {
    setIsClearing(type);
    setShowConfirm(null);
    try {
      await fetch(`/api/settings/storage?type=${type}`, {
        method: "DELETE",
      });
      await fetchUsage();
    } finally {
      setIsClearing(null);
    }
  };

  const usagePercent = usage ? (usage.used / usage.total) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold">Storage</h3>
        <p className="text-sm text-muted-foreground">
          Manage local storage and data.
        </p>
      </div>

      {usage ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Storage Usage</span>
              <span className="font-medium">
                {formatBytes(usage.used)} of {formatBytes(usage.total)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between rounded-md border p-3">
              <span className="text-muted-foreground">Projects</span>
              <span className="font-medium">{formatBytes(usage.projects)}</span>
            </div>
            <div className="flex justify-between rounded-md border p-3">
              <span className="text-muted-foreground">Recordings</span>
              <span className="font-medium">{formatBytes(usage.recordings)}</span>
            </div>
            <div className="flex justify-between rounded-md border p-3">
              <span className="text-muted-foreground">Sandboxes</span>
              <span className="font-medium">{formatBytes(usage.sandboxes)}</span>
            </div>
            <div className="flex justify-between rounded-md border p-3">
              <span className="text-muted-foreground">Cache</span>
              <span className="font-medium">{formatBytes(usage.cache)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="border-t pt-4">
        <div className="flex gap-2">
          {showConfirm === "cache" ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">Clear cache?</span>
              <button
                onClick={() => handleClear("cache")}
                disabled={isClearing !== null}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirm(null)}
                className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm("cache")}
              disabled={isClearing !== null}
              className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {isClearing === "cache" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear Cache
            </button>
          )}

          {showConfirm === "all" ? (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-500">Delete ALL data?</span>
              <button
                onClick={() => handleClear("all")}
                disabled={isClearing !== null}
                className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowConfirm(null)}
                className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm("all")}
              disabled={isClearing !== null}
              className="flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {isClearing === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete All Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
