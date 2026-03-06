import { Button } from "@/components/ui/button";

const SUGGESTED_PROMPTS = [
  "Change the page title",
  "Add a new button to the header",
  "Update the color scheme to blue",
  "Add a footer with copyright",
  "Create a new Card component",
  "Fix any TypeScript errors",
];

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="space-y-4">
      {/* Welcome message */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full gradient-bg-sharp flex items-center justify-center flex-shrink-0" />
          <div>
            <h3 className="font-medium">Welcome to Crayon Agent</h3>
            <p className="text-sm text-muted-foreground mt-1">
              I can help you edit your sandbox code using natural language.
              Try one of the suggestions below or type your own request.
            </p>
          </div>
        </div>
      </div>

      {/* Suggested prompts */}
      <div>
        <h4 className="text-sm font-medium mb-2">Try asking:</h4>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onSelect(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
