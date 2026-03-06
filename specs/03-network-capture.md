# Network Capture

Captures HTTP requests and responses from browser sessions via CDP.

## ⚠️ External Integration

**USE WEB SEARCH** to find CDP Network domain documentation.
- Search: "Chrome DevTools Protocol Network domain"
- Search: "CDP Network.requestWillBeSent"
- Search: "CDP Network.responseReceived"
- Search: "CDP request interception examples"

Do NOT guess. Find the real protocol docs.

## Acceptance Criteria

- [x] Captures all HTTP requests (GET, POST, PUT, DELETE, PATCH)
- [x] Captures request headers, body, URL, method
- [x] Captures response status, headers, body
- [x] Filters out non-API calls (images, fonts, analytics)
- [x] Respects size limits (skip bodies >5MB)
- [x] Integrated with CrayonService recording workflow

## Interface

```typescript
interface NetworkCall {
  id: string;
  timestamp: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body?: string;
    contentType: string;
  };
}

attach(cdpSession: CDPSession): void
getCalls(): NetworkCall[]
stop(): void
```

## Filters

Include: `**/api/**`, `**/*.json`, `**/graphql`
Exclude: `*.png`, `*.jpg`, `*.woff2`, `**/analytics/**`

## Testing Requirements

### Unit Tests (`network-capture.test.ts`)
- Mock CDP session
- Test filters correctly include/exclude URLs
- Test large response handling (>5MB skipped)
- Test request/response pairing

### Integration Tests (`network-capture.integration.test.ts`)
- **REQUIRES REAL BROWSER SESSION**
- Navigate to page with API calls
- Verify API calls captured with correct data
- Verify image requests filtered out

## Definition of Done

- [x] Unit tests pass (mocked)
- [x] Integration tests pass (real browser)
- [x] API calls captured with headers and bodies
- [x] Images/fonts/analytics filtered out
- [x] Large responses handled gracefully
- [x] Integrated with CrayonService for recording workflow
