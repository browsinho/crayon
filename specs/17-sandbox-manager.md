# Sandbox Manager

Manages sandbox container lifecycle via Docker API.

## ⚠️ External Integration

**USE WEB SEARCH** to find Docker API documentation.
- Search: "dockerode npm container lifecycle"
- Search: "dockerode start stop container"
- Search: "Docker container port mapping programmatic"

Do NOT guess. Find the real API docs.

## Acceptance Criteria

- [ ] Can start a sandbox container
- [ ] Can stop a running container
- [ ] Can get container status
- [ ] Can list all sandboxes
- [ ] Handles container not found gracefully

## Interface

```typescript
interface Sandbox {
  id: string;
  status: 'stopped' | 'starting' | 'running' | 'error';
  ports: { frontend: number; backend: number };
  url?: string;
}

start(sandboxId: string): Promise<Sandbox>
stop(sandboxId: string): Promise<void>
getStatus(sandboxId: string): Promise<Sandbox>
list(): Promise<Sandbox[]>
```

## Port Allocation

- Frontend: 3000 + offset
- Backend: 3001 + offset
- Offset based on sandbox index

## Testing Requirements

### Unit Tests (`sandbox-manager.test.ts`)
- Mock Docker client
- Test start returns correct Sandbox object
- Test stop cleans up correctly
- Test status reflects container state
- Test not-found handling

### Integration Tests (`sandbox-manager.integration.test.ts`)
- **REQUIRES DOCKER DAEMON + BUILT IMAGE**
- Start sandbox, verify running
- Get status, verify correct
- Stop sandbox, verify stopped
- Start 2 sandboxes, verify different ports
- Access frontend/backend URLs, verify responding

## Definition of Done

- [ ] Unit tests pass (mocked Docker)
- [ ] Integration tests pass (real Docker)
- [ ] Start/stop cycle works
- [ ] Status correctly reflects container state
- [ ] Multiple sandboxes run simultaneously on different ports
- [ ] URLs accessible when running
