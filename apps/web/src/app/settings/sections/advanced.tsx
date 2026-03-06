"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { StorageSettings } from "@/lib/settings-shared";

export function AdvancedSection() {
  const [settings, setSettings] = useState<StorageSettings>({
    projectsDir: "./data/projects",
    recordingsDir: "./data/recordings",
    sandboxesDir: "./data/sandboxes",
    cacheDir: "./data/cache",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.storage) {
          setSettings(data.storage);
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (field: keyof StorageSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storage: settings }),
      });
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold">Advanced Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure storage paths and other advanced options.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Projects Directory</label>
          <input
            type="text"
            value={settings.projectsDir}
            onChange={(e) => handleChange("projectsDir", e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Recordings Directory</label>
          <input
            type="text"
            value={settings.recordingsDir}
            onChange={(e) => handleChange("recordingsDir", e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Sandboxes Directory</label>
          <input
            type="text"
            value={settings.sandboxesDir}
            onChange={(e) => handleChange("sandboxesDir", e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Cache Directory</label>
          <input
            type="text"
            value={settings.cacheDir}
            onChange={(e) => handleChange("cacheDir", e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Save Settings"
          )}
        </button>
      </div>
    </div>
  );
}
