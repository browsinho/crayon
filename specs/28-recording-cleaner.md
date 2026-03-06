# Recording Cleaner

Cleans and prepares DOM snapshots and network requests for AI code generation.

## Purpose

Raw recording data contains noise, irrelevant elements, and PII. This module cleans and optimizes the data to create a focused, token-efficient representation for the AI prompt.

## Acceptance Criteria

- [ ] Removes script tags, analytics, ads, third-party widgets
- [ ] Strips inline styles (keeps only class names for Tailwind inference)
- [ ] Removes empty/whitespace-only text nodes
- [ ] Filters out non-essential network requests (analytics, tracking, ads)
- [ ] Deduplicates similar DOM structures across snapshots
- [ ] Anonymizes PII using existing anonymizer (spec 05)
- [ ] Reduces token count by 50-80% while preserving structure

## Interface

```typescript
interface CleanedRecording {
  dom: CleanedDOMSnapshot[];
  network: CleanedNetworkRequest[];
  metadata: {
    originalTokenCount: number;
    cleanedTokenCount: number;
    elementsRemoved: number;
    requestsFiltered: number;
  };
}

interface CleanedDOMSnapshot {
  url: string;
  timestamp: number;
  html: string; // Cleaned HTML (no scripts, minimal attributes)
  structure: string; // Simplified tree structure (for pattern matching)
}

interface CleanedNetworkRequest {
  method: string;
  url: string;
  headers: Record<string, string>; // Only essential headers
  body?: unknown; // Parsed and anonymized
  response?: unknown; // Parsed and anonymized
}

// Clean recording data
clean(recording: Recording): Promise<CleanedRecording>
```

## Cleaning Rules

### DOM Cleaning
1. **Remove entirely**:
   - `<script>` tags
   - Analytics scripts (Google Analytics, Segment, etc.)
   - Ad containers (detected by class names, IDs)
   - Third-party widgets (from spec 11)
   - Comments
   - Hidden elements with `display: none`

2. **Simplify**:
   - Remove inline styles → keep only `class` and `id`
   - Remove data attributes except `data-testid`, `data-component`
   - Strip empty attributes
   - Collapse whitespace

3. **Preserve**:
   - Semantic HTML structure
   - Text content
   - Class names (for Tailwind inference)
   - Form elements and attributes
   - Image src (will be replaced by asset downloader)

### Network Cleaning
1. **Filter out**:
   - Analytics requests (Google Analytics, Mixpanel, etc.)
   - Tracking pixels
   - Ad requests
   - Requests to third-party domains (except CDNs for assets)

2. **Keep**:
   - API requests to the app's backend
   - Asset requests (images, fonts, stylesheets)
   - GraphQL/REST endpoints

3. **Anonymize**:
   - Use PII anonymizer (spec 05) on request/response bodies
   - Remove authentication tokens from headers
   - Replace real IDs with placeholder IDs

## Token Optimization

Target: Reduce token count to fit within LLM context window

- DOM: Aim for <50K tokens per snapshot
- Network: Aim for <20K tokens total
- Use HTML minification
- Represent repeated structures as templates

## Testing Requirements

### Unit Tests
- Test script tag removal
- Test inline style stripping
- Test whitespace collapse
- Test network request filtering
- Test PII anonymization

### Integration Tests
- Real recording with 100K tokens → cleaned to <70K tokens
- Cleaned output should preserve essential structure
- Network requests reduced by 60-80%

## Definition of Done

- [ ] Unit tests pass
- [ ] Integration test shows significant token reduction
- [ ] Cleaned DOM is valid HTML
- [ ] No PII leaks in output
- [ ] Structure preservation verified manually
