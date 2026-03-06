# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (Turborepo)
pnpm test             # Run all tests
pnpm typecheck        # Type check all packages
pnpm lint             # Lint all packages
pnpm clean            # Clean dist folders
```

### Package-specific commands

```bash
# Web app (apps/web)
pnpm --filter @crayon/web dev       # Start Next.js dev server
pnpm --filter @crayon/web test      # Run web tests

# Core library (packages/core)
pnpm --filter @crayon/core test     # Run core tests
pnpm --filter @crayon/core build    # Build core package

# Run a single test file
pnpm --filter @crayon/core test src/dom-capture.test.ts
```

## Architecture

Crayon is a sandbox environment platform for browser AI agent developers. It records real browsing sessions, generates functional sandboxes with realistic data, and provides MCP (Model Context Protocol) tools for AI agent control.

### Monorepo Structure

```
packages/
  types/       # Shared Zod schemas and TypeScript types (no internal deps)
  core/        # Core business logic (depends on types)
apps/
  web/         # Next.js 15 frontend (depends on core + types)
  mcp-server/  # Standalone MCP server (depends on core)
```

### Four-Phase Pipeline

1. **Recording** - Captures browser sessions via AnchorBrowser (DOM snapshots, network calls, screenshots)
2. **Analysis** - Understands the recorded app (framework detection, API route extraction, schema inference, auth detection)
3. **Generation** - Creates standalone replica (React frontend, Express backend, LLM-generated data, Docker containers)
4. **Runtime** - Manages sandboxes via Docker + MCP server for AI agent control

### Key Modules (packages/core/src/)

- `browser-session.ts` - AnchorBrowser session management
- `dom-capture.ts`, `network-capture.ts`, `screenshot-capture.ts` - Recording capture
- `framework-detector.ts`, `api-route-extractor.ts`, `schema-inferrer.ts` - Analysis
- `frontend-generator.ts`, `backend-generator.ts`, `data-generator.ts` - Generation
- `sandbox-manager.ts` - Docker container lifecycle
- `mcp-server.ts` - MCP tools for AI agents

### Service Layer (apps/web/src/lib/)

- `crayon.ts` - Central `CrayonService` singleton orchestrating all operations
- `actions/` - Next.js server actions delegating to CrayonService
- `settings.ts` - API key and configuration management

### Data Storage

Filesystem-based (no database):
- Projects: `./data/projects/{projectId}/`
- Recordings: `./data/recordings/{recordingId}/`
- Settings: `./data/settings.json`

## Code Rules

- TypeScript only (`.ts` files)
- Zod for runtime validation
- Async/await only (no callbacks)
- Named exports only (no default exports)
- Tests colocated: `foo.ts` → `foo.test.ts`

## Environment Setup

Copy `.env.example` to `.env`:
```
ANCHOR_BROWSER_API_KEY=   # Required - get from https://anchorbrowser.io
```

Requires Docker daemon running for sandbox features.

## External APIs

Use web search for documentation on: AnchorBrowser SDK, Chrome DevTools Protocol (CDP), MCP SDK, Docker API (dockerode).
