"use client";

import { Monitor } from "lucide-react";

export interface BrowserEmbedProps {
  liveViewUrl: string;
}

export function BrowserEmbed({ liveViewUrl }: BrowserEmbedProps) {
  return (
    <div className="relative h-full w-full rounded-lg border bg-muted overflow-hidden">
      {liveViewUrl ? (
        <iframe
          src={liveViewUrl}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          allow="clipboard-read; clipboard-write"
          className="h-full w-full border-0"
          style={{ position: "absolute", top: 0, left: 0 }}
          title="AnchorBrowser Live View"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Monitor className="h-12 w-12" />
            <p className="text-sm">Loading browser session...</p>
          </div>
        </div>
      )}
    </div>
  );
}
