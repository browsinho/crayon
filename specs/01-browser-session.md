# Browser Session Management

Manages AnchorBrowser sessions for recording user browsing activity.

## ⚠️ External Integration

**USE WEB SEARCH** to find current AnchorBrowser API documentation before implementing.
- Search: "AnchorBrowser API documentation"
- Search: "AnchorBrowser SDK npm"
- Look up actual method names, parameters, and return types

Do NOT guess the API. Find the real docs.

## Acceptance Criteria

- [ ] Can create a new browser session via AnchorBrowser API
- [ ] Can navigate the session to any URL
- [ ] Can get CDP connection for the session
- [ ] Can close/cleanup the session
- [ ] Session state is tracked (active/stopped/error)

## Interface

```typescript
interface BrowserSession {
  id: string;
  status: 'active' | 'stopped' | 'error';
  cdpUrl: string;
}

createSession(): Promise<BrowserSession>
navigate(sessionId: string, url: string): Promise<void>
closeSession(sessionId: string): Promise<void>
```

## Testing Requirements

### Unit Tests (`browser-session.test.ts`)
- Mock AnchorBrowser client
- Test session creation returns valid session object
- Test navigation updates internal state
- Test close cleans up resources
- Test error states are handled

### Integration Tests (`browser-session.integration.test.ts`)
- **REQUIRES REAL ANCHORBROWSER API KEY**
- Create actual session, verify it exists
- Navigate to example.com, verify page loads
- Close session, verify cleanup
- Test with invalid API key returns auth error

## Definition of Done

- [ ] Unit tests pass (mocked)
- [ ] Integration tests pass (real AnchorBrowser)
- [ ] Can create → navigate → close without errors
- [ ] Handles API errors gracefully
- [ ] Session status correctly reflects state
