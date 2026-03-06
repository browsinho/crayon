"use client";

import { useState } from "react";
import { Globe, PlayCircle } from "lucide-react";
import { z } from "zod";

const urlSchema = z.string().url("Please enter a valid URL");

export interface UrlInputProps {
  onStart: (url: string) => void;
  disabled: boolean;
}

export function UrlInput({ onStart, disabled }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = urlSchema.safeParse(url);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Invalid URL");
      return;
    }

    setError(null);
    onStart(url);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="target-url" className="text-sm font-medium">
          Target URL
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="target-url"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://example.com"
              disabled={disabled}
              className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!url || disabled}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <PlayCircle className="h-4 w-4" />
            Start Recording
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}
