# Recording Storage

Persists recording data to filesystem in structured format.

## Acceptance Criteria

- [ ] Creates directory per recording: `recordings/{id}/`
- [ ] Stores DOM snapshots in `dom/` subdirectory
- [ ] Stores network calls in `network/` subdirectory
- [ ] Stores screenshots in `screenshots/` subdirectory
- [ ] Stores metadata.json with recording info

## Directory Structure

```
recordings/{recording-id}/
├── metadata.json
├── dom/
│   ├── 00001.json
│   └── ...
├── network/
│   ├── 00001.json
│   └── ...
└── screenshots/
    ├── 00001.png
    └── ...
```

## Interface

```typescript
interface RecordingMetadata {
  id: string;
  createdAt: string;
  startUrl: string;
  status: 'recording' | 'completed';
  stats: {
    domSnapshots: number;
    networkCalls: number;
    screenshots: number;
  };
}

// Create new recording directory
create(id: string, startUrl: string): Promise<void>

// Save DOM snapshot
saveDomSnapshot(id: string, snapshot: DOMSnapshot): Promise<void>

// Save network call
saveNetworkCall(id: string, call: NetworkCall): Promise<void>

// Save screenshot
saveScreenshot(id: string, screenshot: Buffer, meta: ScreenshotMeta): Promise<void>

// Finalize recording (update metadata)
finalize(id: string): Promise<RecordingMetadata>

// Load recording
load(id: string): Promise<Recording>
```

## Definition of Done

1. Unit tests for each save operation
2. Integration test: save 5 of each type, load all back
3. Metadata stats are accurate
