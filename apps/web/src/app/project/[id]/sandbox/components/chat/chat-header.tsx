import { Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  isProcessing: boolean;
  onClear: () => void;
  onClose: () => void;
  hasMessages: boolean;
}

export function ChatHeader({ isProcessing, onClear, onClose, hasMessages }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full gradient-bg-sharp" />
        <h2 className="font-semibold text-sm">Crayon Agent</h2>
        {isProcessing && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Clear button */}
        {hasMessages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isProcessing}
            className="h-7 w-7 p-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
