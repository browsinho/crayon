"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiKeyInputProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
  onTest: () => Promise<{ success: boolean; error?: string }>;
  hasStoredValue: boolean;
}

function ApiKeyInput({
  label,
  description,
  value,
  onChange,
  onSave,
  onTest,
  hasStoredValue,
}: ApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: "Test failed" });
    }
    setIsTesting(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
      setTestResult(null);
    } finally {
      setIsSaving(false);
    }
  };

  const hasValue = value.length > 0 || hasStoredValue;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={hasStoredValue ? "••••••••" : "Enter API key..."}
            className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          onClick={handleTest}
          disabled={!hasValue || isTesting}
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
        </button>
        <button
          onClick={handleSave}
          disabled={!value || isSaving}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>
      {testResult && (
        <div
          className={cn(
            "flex items-center gap-2 text-sm",
            testResult.success ? "text-green-600" : "text-red-600"
          )}
        >
          {testResult.success ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Connected successfully</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" />
              <span>{testResult.error || "Connection failed"}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export interface ApiKeysSectionProps {
  initialHasKeys?: {
    anchorBrowser: boolean;
    openai: boolean;
    anthropic: boolean;
  };
}

export function ApiKeysSection({ initialHasKeys }: ApiKeysSectionProps) {
  const [keys, setKeys] = useState({
    anchorBrowser: "",
    openai: "",
    anthropic: "",
  });
  const [hasStoredKeys, setHasStoredKeys] = useState(
    initialHasKeys || {
      anchorBrowser: false,
      openai: false,
      anthropic: false,
    }
  );

  useEffect(() => {
    // Fetch current settings to check which keys are stored
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.apiKeys) {
          setHasStoredKeys({
            anchorBrowser: !!data.apiKeys.anchorBrowser,
            openai: !!data.apiKeys.openai,
            anthropic: !!data.apiKeys.anthropic,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (service: keyof typeof keys) => {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKeys: { [service]: keys[service] },
      }),
    });

    if (response.ok) {
      setHasStoredKeys((prev) => ({ ...prev, [service]: true }));
      setKeys((prev) => ({ ...prev, [service]: "" }));
    }
  };

  const handleTest = async (
    service: keyof typeof keys
  ): Promise<{ success: boolean; error?: string }> => {
    const keyToTest = keys[service] || undefined;

    // If no new key entered, we need to test with the stored key
    // The server will use the stored key if we don't provide one
    const response = await fetch("/api/settings/test-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service,
        key: keyToTest || "stored",
      }),
    });

    return response.json();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold">API Keys</h3>
        <p className="text-sm text-muted-foreground">
          Configure API keys for external services.
        </p>
      </div>

      <div className="space-y-6">
        <ApiKeyInput
          label="AnchorBrowser API Key"
          description="Required for browser recording functionality"
          value={keys.anchorBrowser}
          onChange={(v) => setKeys((prev) => ({ ...prev, anchorBrowser: v }))}
          onSave={() => handleSave("anchorBrowser")}
          onTest={() => handleTest("anchorBrowser")}
          hasStoredValue={hasStoredKeys.anchorBrowser}
        />

        <div className="border-t pt-6">
          <ApiKeyInput
            label="OpenAI API Key"
            description="Optional - Used for enhanced code generation"
            value={keys.openai}
            onChange={(v) => setKeys((prev) => ({ ...prev, openai: v }))}
            onSave={() => handleSave("openai")}
            onTest={() => handleTest("openai")}
            hasStoredValue={hasStoredKeys.openai}
          />
        </div>

        <div className="border-t pt-6">
          <ApiKeyInput
            label="Anthropic API Key"
            description="Optional - Used for natural language sandbox modifications"
            value={keys.anthropic}
            onChange={(v) => setKeys((prev) => ({ ...prev, anthropic: v }))}
            onSave={() => handleSave("anthropic")}
            onTest={() => handleTest("anthropic")}
            hasStoredValue={hasStoredKeys.anthropic}
          />
        </div>
      </div>
    </div>
  );
}
