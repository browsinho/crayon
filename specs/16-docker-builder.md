# Docker Builder

Packages generated sandbox into Docker container.

## ⚠️ External Integration

**USE WEB SEARCH** to find Docker API and dockerode documentation.
- Search: "dockerode npm documentation"
- Search: "dockerode build image example"
- Search: "Docker API build endpoint"
- Search: "docker-compose programmatic generation"

Do NOT guess. Find the real API docs.

## Acceptance Criteria

- [ ] Creates Dockerfile for sandbox
- [ ] Creates docker-compose.yml
- [ ] Frontend and backend run in single container
- [ ] Container exposes ports 3000 (FE) and 3001 (BE)
- [ ] Container can be started/stopped

## Interface

```typescript
interface DockerConfig {
  sandboxId: string;
  frontendDir: string;
  backendDir: string;
  assetsDir: string;
}

build(config: DockerConfig): Promise<string> // returns image ID
generateDockerfile(config: DockerConfig): string
generateCompose(config: DockerConfig): string
```

## Dockerfile Template

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY frontend/ ./frontend/
COPY backend/ ./backend/
RUN cd frontend && npm install && npm run build
RUN cd backend && npm install
EXPOSE 3000 3001
CMD ["npm", "run", "start"]
```

## Testing Requirements

### Unit Tests (`docker-builder.test.ts`)
- Test Dockerfile generation (string output)
- Test docker-compose.yml generation
- Test config validation

### Integration Tests (`docker-builder.integration.test.ts`)
- **REQUIRES DOCKER DAEMON RUNNING**
- Generate Dockerfile from test project
- Build actual Docker image
- Run container, verify ports accessible
- HTTP request to localhost:3000 returns response
- Stop and remove container

## Definition of Done

- [ ] Unit tests pass
- [ ] Integration tests pass (real Docker)
- [ ] `docker build` succeeds
- [ ] `docker run` starts container
- [ ] Frontend accessible at localhost:3000
- [ ] Backend accessible at localhost:3001
- [ ] Container stops cleanly
