"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import type { McpConfig } from "./types";
import { getSandboxMcpConfig } from "@/lib/actions/sandbox";

interface McpTabProps {
  sandboxId: string;
}

export function McpTab({ sandboxId }: McpTabProps) {
  const [config, setConfig] = useState<McpConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const mcpConfig = await getSandboxMcpConfig(sandboxId);
        setConfig(mcpConfig);
      } catch (error) {
        console.error("Failed to load MCP config:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, [sandboxId]);

  const handleCopy = async () => {
    if (!config) return;

    const configJson = JSON.stringify(
      {
        mcpServers: {
          "crayon-sandbox": {
            url: config.url,
            headers: {
              "x-api-key": config.apiKey,
            },
          },
        },
      },
      null,
      2
    );

    await navigator.clipboard.writeText(configJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        MCP configuration not available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">MCP Connection</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Connect your AI agent to this sandbox using the Model Context
            Protocol:
          </p>
          <div className="relative">
            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
              {JSON.stringify(
                {
                  mcpServers: {
                    "crayon-sandbox": {
                      url: config.url,
                      headers: {
                        "x-api-key": config.apiKey,
                      },
                    },
                  },
                },
                null,
                2
              )}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-2 rounded-md hover:bg-background/50"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Available Tools</h3>
        </div>
        <div className="p-4">
          {config.tools.length > 0 ? (
            <ul className="space-y-3">
              {config.tools.map((tool) => (
                <li key={tool.name} className="flex items-start gap-3">
                  <code className="text-sm bg-muted px-2 py-0.5 rounded shrink-0">
                    {tool.name}
                  </code>
                  <span className="text-sm text-muted-foreground">
                    {tool.description}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tools available for this sandbox.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Connection Details</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">URL</label>
            <p className="font-mono text-sm">{config.url}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">API Key</label>
            <p className="font-mono text-sm">{maskApiKey(config.apiKey)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "****";
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
