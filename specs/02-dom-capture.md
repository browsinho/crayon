# DOM Capture

Captures DOM snapshots from browser sessions via CDP.

## ⚠️ External Integration

**USE WEB SEARCH** to find CDP (Chrome DevTools Protocol) documentation.
- Search: "Chrome DevTools Protocol DOM domain"
- Search: "CDP DOM.getDocument"
- Search: "CDP DOM mutation events"
- Search: "chrome-remote-interface npm examples"

Do NOT guess CDP methods. Find the real protocol docs.

## Acceptance Criteria

- [x] Captures full DOM snapshot on page load
- [x] Captures full DOM snapshot on navigation
- [x] Captures incremental diffs on mutations (batched)
- [x] Each snapshot has timestamp, URL, viewport info
- [x] Snapshots are stored as JSON files

## Interface

```typescript
interface DOMSnapshot {
  id: string;
  timestamp: number;
  url: string;
  type: 'full' | 'diff';
  html?: string;
  mutations?: Mutation[];
  viewport: { width: number; height: number };
}

attach(cdpSession: CDPSession): void
getSnapshots(): DOMSnapshot[]
stop(): void
```

## Integration with AnchorBrowser

The DOM capture is integrated with AnchorBrowser via CDP session:

```typescript
// In BrowserSessionManager (packages/core/src/browser-session.ts)
async getCDPSession(sessionId: string): Promise<CDPSession> {
  const browser = await this.client.browser.connect(sessionId);
  const page = browser.contexts()[0].pages()[0];
  const cdpSession = await page.context().newCDPSession(page);
  return cdpSession;
}

// In CrayonService (apps/web/src/lib/crayon.ts)
async startRecording(projectId: string, url: string) {
  // Create browser session
  const result = await createBrowserSession();
  await manager.navigate(browserSessionId, url);

  // Attach captures
  const domCapture = createDOMCapture();
  const cdpSession = await manager.getCDPSession(browserSessionId);
  await domCapture.attach(cdpSession);
}

async stopRecording(sessionId: string) {
  // Collect captured data
  domCapture.stop();
  const snapshots = domCapture.getSnapshots();
  // Save to recording...
}
```

## Triggers

- `pageload`: Initial page load complete
- `navigation`: URL changed
- `mutation`: 10+ DOM nodes changed (batched per 100ms)

## Testing Requirements

### Unit Tests (`dom-capture.test.ts`)
- Mock CDP session
- Test attach sets up listeners
- Test snapshot creation with correct structure
- Test mutation batching (rapid mutations → single snapshot)
- Test stop removes listeners

### Integration Tests (`dom-capture.integration.test.ts`)
- **REQUIRES REAL BROWSER SESSION**
- Attach to real CDP session
- Navigate to test page, verify snapshot captured
- Trigger DOM mutations, verify diff captured
- Navigate to 3 pages, verify 3 snapshots

## Definition of Done

- [x] Unit tests pass (mocked CDP)
- [x] Integration tests pass (real browser)
- [x] Navigate 3 pages → 3 full snapshots
- [x] Rapid mutations → batched (not spammed)
- [x] Snapshots have all required fields
- [x] Integrated with CrayonService for recording workflow
