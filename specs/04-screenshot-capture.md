# Screenshot Capture

Captures screenshots from browser sessions linked to DOM snapshots.

## ⚠️ External Integration

**USE WEB SEARCH** to find CDP Page.captureScreenshot documentation.
- Search: "Chrome DevTools Protocol Page.captureScreenshot"
- Search: "CDP screenshot example typescript"
- Search: "chrome-remote-interface screenshot"

Do NOT guess. Find the real protocol docs.

## Acceptance Criteria

- [x] Captures screenshot on every full DOM snapshot
- [x] Screenshots saved as PNG files
- [x] Each screenshot linked to its DOM snapshot ID
- [x] Captures viewport dimensions
- [x] Integrated with CrayonService recording workflow

## Interface

```typescript
interface Screenshot {
  id: string;
  domSnapshotId: string;
  timestamp: number;
  path: string;
  width: number;
  height: number;
}

attach(cdpSession: CDPSession): void
capture(domSnapshotId: string): Promise<Screenshot>
getScreenshots(): Screenshot[]
```

## Testing Requirements

### Unit Tests (`screenshot-capture.test.ts`)
- Mock CDP session
- Test capture returns correct structure
- Test PNG buffer is valid
- Test linking to DOM snapshot ID

### Integration Tests (`screenshot-capture.integration.test.ts`)
- **REQUIRES REAL BROWSER SESSION**
- Navigate to real page
- Capture screenshot
- Verify PNG file exists and is valid image
- Verify dimensions match viewport

## Definition of Done

- [x] Unit tests pass (mocked)
- [x] Integration tests pass (real browser)
- [x] 3 DOM snapshots = 3 screenshots
- [x] Screenshots are valid PNG files
- [x] Dimensions captured correctly
- [x] Integrated with CrayonService for recording workflow
