# Sandbox Hosting

Hosts generated sandboxes under our domain with proper routing and isolation.

## Purpose

Makes generated sandboxes accessible via our Next.js app under subdomains or paths, with proper isolation and security.

## Acceptance Criteria

- [ ] Generated sandboxes are accessible under our domain
- [ ] Each sandbox has a unique URL (e.g., `sandbox-{id}.crayon.local` or `/sandbox/{id}`)
- [ ] Sandboxes are isolated from each other
- [ ] Can proxy requests to Docker containers
- [ ] Supports WebSocket connections (for hot reload)
- [ ] Handles CORS properly
- [ ] Can list all active sandboxes with URLs

## Interface

```typescript
interface SandboxHost {
  sandboxId: string;
  url: string; // Full URL where sandbox is accessible
  status: 'running' | 'stopped' | 'error';
  container: {
    id: string;
    ports: { frontend: number; backend?: number };
  };
}

// Start hosting a sandbox
startHosting(sandboxId: string): Promise<SandboxHost>

// Stop hosting
stopHosting(sandboxId: string): Promise<void>

// Get sandbox URL
getSandboxUrl(sandboxId: string): string

// List all hosted sandboxes
listHosted(): Promise<SandboxHost[]>
```

## Hosting Strategies

### Option A: Port-based Routing (Simpler)
Each sandbox gets a unique port:
- Sandbox 1: `http://localhost:3001`
- Sandbox 2: `http://localhost:3002`

**Pros**: Easy to implement, works locally
**Cons**: Port management, not production-ready

### Option B: Reverse Proxy (Recommended)
Next.js API route proxies to Docker containers:
- Sandbox 1: `http://localhost:3000/sandbox/abc123`
- Sandbox 2: `http://localhost:3000/sandbox/def456`

**Pros**: Clean URLs, production-ready
**Cons**: Requires proxy logic

### Option C: Subdomain Routing (Future)
Each sandbox gets a subdomain:
- Sandbox 1: `http://abc123.crayon.local`
- Sandbox 2: `http://def456.crayon.local`

**Pros**: Full isolation, professional
**Cons**: Requires DNS setup, complex locally

**Recommendation**: Start with Option B (reverse proxy)

## Implementation: Reverse Proxy

### Next.js API Route
Create `/app/api/sandbox/[sandboxId]/[...path]/route.ts`:

```typescript
export async function GET(
  request: Request,
  { params }: { params: { sandboxId: string; path: string[] } }
) {
  const sandbox = await getSandbox(params.sandboxId);
  if (!sandbox) return new Response('Not found', { status: 404 });

  const targetUrl = `http://localhost:${sandbox.port}/${params.path.join('/')}`;
  const response = await fetch(targetUrl, {
    headers: request.headers,
    method: request.method,
  });

  return response;
}
```

### Docker Port Management
- Sandbox manager (spec 17) assigns random available ports
- Store port mapping in sandbox metadata
- Proxy knows which port to forward to

### WebSocket Support
For Vite's hot reload to work:
```typescript
// Upgrade WebSocket connections
if (request.headers.get('upgrade') === 'websocket') {
  // Proxy WebSocket connection to container
}
```

## Security Considerations

1. **Sandbox Isolation**
   - Docker containers run with limited resources
   - No network access between containers
   - Read-only filesystem where possible

2. **Request Validation**
   - Verify sandboxId exists and user has access
   - Rate limiting to prevent abuse
   - No sensitive data in sandbox environment

3. **CORS Headers**
   - Allow sandbox to make requests to Next.js API
   - Restrict cross-origin requests appropriately

## UI Integration

### Sandbox Viewer Page (spec 25)
Display sandbox in iframe:
```tsx
<iframe
  src={`/api/sandbox/${sandboxId}/proxy`}
  className="w-full h-full"
  sandbox="allow-scripts allow-same-origin"
/>
```

### Sandbox List
Show all active sandboxes with clickable URLs

## Testing Requirements

### Unit Tests
- Test port assignment doesn't conflict
- Test URL generation is correct
- Test proxy request forwarding (mocked)

### Integration Tests
- Start sandbox → verify it's accessible at generated URL
- Make request to `/api/sandbox/{id}/` → proxies to container
- Stop sandbox → URL returns 404
- Test with multiple sandboxes running concurrently

## Definition of Done

- [ ] Sandboxes accessible via Next.js proxy URLs
- [ ] Each sandbox has unique URL
- [ ] Proxy correctly forwards requests to Docker containers
- [ ] WebSocket connections work (Vite hot reload)
- [ ] Multiple sandboxes can run simultaneously
- [ ] Sandbox viewer page displays hosted sandbox in iframe
- [ ] Integration tests pass
