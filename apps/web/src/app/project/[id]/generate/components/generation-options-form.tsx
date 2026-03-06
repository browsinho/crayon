"use client";

import type { GenerationOptions } from "@/lib/generation-types";

interface GenerationOptionsFormProps {
  options: GenerationOptions;
  onChange: (options: GenerationOptions) => void;
  disabled?: boolean;
}

export function GenerationOptionsForm({
  options,
  onChange,
  disabled = false,
}: GenerationOptionsFormProps) {
  const updateOption = <K extends keyof GenerationOptions>(
    key: K,
    value: GenerationOptions[K]
  ) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-4">Generation Options</h3>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="frontend" className="text-sm font-medium">
              Frontend Framework
            </label>
            <select
              id="frontend"
              value={options.frontend}
              onChange={(e) =>
                updateOption(
                  "frontend",
                  e.target.value as GenerationOptions["frontend"]
                )
              }
              disabled={disabled}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="nextjs">Next.js</option>
              <option value="react">React (Vite)</option>
              <option value="vue">Vue</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="styling" className="text-sm font-medium">
              Styling
            </label>
            <select
              id="styling"
              value={options.styling}
              onChange={(e) =>
                updateOption(
                  "styling",
                  e.target.value as GenerationOptions["styling"]
                )
              }
              disabled={disabled}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="tailwind">Tailwind CSS</option>
              <option value="css-modules">CSS Modules</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="backend" className="text-sm font-medium">
              Backend
            </label>
            <select
              id="backend"
              value={options.backend}
              onChange={(e) =>
                updateOption(
                  "backend",
                  e.target.value as GenerationOptions["backend"]
                )
              }
              disabled={disabled}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="express">Express</option>
              <option value="fastify">Fastify</option>
              <option value="hono">Hono</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="database" className="text-sm font-medium">
              Database
            </label>
            <select
              id="database"
              value={options.database}
              onChange={(e) =>
                updateOption(
                  "database",
                  e.target.value as GenerationOptions["database"]
                )
              }
              disabled={disabled}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="sqlite">SQLite</option>
              <option value="postgres">PostgreSQL</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeSampleData}
              onChange={(e) =>
                updateOption("includeSampleData", e.target.checked)
              }
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed"
            />
            <span className="text-sm">Include sample data</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={options.downloadAssets}
              onChange={(e) =>
                updateOption("downloadAssets", e.target.checked)
              }
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed"
            />
            <span className="text-sm">Download assets (images, fonts)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={options.generateTests}
              onChange={(e) => updateOption("generateTests", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed"
            />
            <span className="text-sm">Generate tests</span>
          </label>
        </div>
      </div>
    </div>
  );
}
