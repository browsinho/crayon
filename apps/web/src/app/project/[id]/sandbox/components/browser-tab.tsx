"use client";

import { useState, useRef, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  RotateCw,
} from "lucide-react";
import { ChatPanel } from "./chat-panel";
import { cn } from "@/lib/utils";

interface BrowserTabProps {
  sandboxId: string;
  sandboxUrl: string | undefined;
  frontendPort: number;
}

export function BrowserTab({
  sandboxId,
  sandboxUrl,
  frontendPort,
}: BrowserTabProps) {
  const defaultUrl = sandboxUrl || `http://localhost:${frontendPort}`;
  const [url, setUrl] = useState(defaultUrl);
  const [inputUrl, setInputUrl] = useState(defaultUrl);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleNavigate = useCallback(() => {
    let newUrl = inputUrl;
    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
      newUrl = `http://${newUrl}`;
    }
    setUrl(newUrl);
    setInputUrl(newUrl);
  }, [inputUrl]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  }, [url]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleNavigate();
      }
    },
    [handleNavigate]
  );

  const handleScreenshot = useCallback(async () => {
    window.open(url, "_blank");
  }, [url]);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Browser toolbar */}
      <div className="flex gap-2 items-center px-4 pt-2">
        <button
          onClick={() => iframeRef.current?.contentWindow?.history.back()}
          className="p-2 rounded-md hover:bg-muted"
          title="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => iframeRef.current?.contentWindow?.history.forward()}
          className="p-2 rounded-md hover:bg-muted"
          title="Go forward"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-md hover:bg-muted"
          title="Refresh"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleNavigate}
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
          placeholder="Enter URL..."
        />
        <button
          onClick={handleScreenshot}
          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          title="Take screenshot"
        >
          <Camera className="h-4 w-4" />
          Screenshot
        </button>
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
            isChatOpen
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-muted"
          )}
          title="Crayon Agent"
        >
          <div className="h-3 w-3 rounded-full gradient-bg-sharp" />
          Crayon Agent
        </button>
      </div>

      {/* Browser container with window chrome */}
      <div className="flex-1 mx-4 mb-4 mt-2 rounded-xl border-2 border-border/50 overflow-hidden shadow-2xl flex flex-col bg-muted/30">
        {/* Browser window chrome */}
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs text-muted-foreground font-medium">Generated Sandbox</span>
          </div>
          <div className="w-12" /> {/* Spacer for symmetry */}
        </div>
        
        {/* Browser content area - iframe with chat overlay */}
        <div className="flex-1 flex min-h-0">
          {/* Browser iframe - takes remaining space */}
          <iframe
            ref={iframeRef}
            src={url}
            className="flex-1 min-w-0 bg-white"
            title="Sandbox Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />

          {/* Chat panel - slides in from right inside browser */}
          <div
            className={cn(
              "bg-background border-l shadow-xl flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
              isChatOpen ? "w-96" : "w-0"
            )}
          >
            <div className="w-96 h-full">
              <ChatPanel sandboxId={sandboxId} onClose={() => setIsChatOpen(false)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
