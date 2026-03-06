# Recording Summarizer

Analyzes recorded session data and generates a comprehensive summary for AI code generation.

## Purpose

Processes raw recording data (DOM snapshots, network requests, screenshots, events) and creates a structured summary that will be fed to the AI code generation engine.

## Acceptance Criteria

- [ ] Generates high-level website description from DOM structure
- [ ] Identifies key UI patterns (navigation, forms, cards, modals, etc.)
- [ ] Extracts color palette and typography from DOM/screenshots
- [ ] Summarizes user interactions and app flow
- [ ] Lists all unique page types/templates detected
- [ ] Identifies framework and libraries used
- [ ] Extracts business domain context (e.g., "e-commerce", "dashboard", "blog")

## Interface

```typescript
interface RecordingSummary {
  // High-level description
  description: string; // "A task management dashboard with kanban boards"
  domain: string; // "productivity" | "ecommerce" | "social" | "dashboard"

  // UI/UX insights
  pages: PageSummary[];
  components: ComponentSummary[];
  brandStyle: {
    colors: string[]; // Extracted color palette
    fonts: string[]; // Font families used
    styleKeywords: string[]; // "modern", "minimal", "colorful"
  };

  // Technical insights
  framework: FrameworkInfo; // From 07-framework-detector
  interactions: {
    type: 'click' | 'scroll' | 'input' | 'navigation';
    description: string;
    frequency: number;
  }[];
}

interface PageSummary {
  url: string;
  title: string;
  pageType: string; // "landing", "dashboard", "detail", "form"
  keyElements: string[]; // ["header with logo", "sidebar navigation", "data table"]
}

interface ComponentSummary {
  type: string; // "button", "card", "modal", "form"
  variants: number; // How many variations detected
  examples: string[]; // HTML snippets
}

// Generate summary from recording
summarize(recording: Recording): Promise<RecordingSummary>
```

## Implementation Notes

- Use framework detector (spec 07) for technical analysis
- Analyze DOM snapshots to identify repeated patterns → components
- Group similar pages by structure/layout
- Extract colors from computed styles and screenshots
- Use LLM for high-level description generation (optional but recommended)

## Testing Requirements

### Unit Tests
- Test with recording containing 3 pages → identifies 3 PageSummary objects
- Test color extraction from DOM styles
- Test component pattern detection (e.g., 5 similar cards → one card component)
- Test business domain classification

### Integration Tests
- Real recording → summary includes accurate description
- Summary should be human-readable and useful for AI prompt

## Definition of Done

- [ ] Unit tests pass
- [ ] Integration test with real recording produces useful summary
- [ ] Summary is concise (<5000 tokens) but comprehensive
- [ ] Can extract brand colors and fonts accurately
