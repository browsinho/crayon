# AGENTS.md

Instructions for AI coding agents working on this repository.

## Prerequisites

| Requirement | Purpose | How to Get |
|-------------|---------|------------|
| Node.js >= 20 | Runtime | https://nodejs.org |
| pnpm 9.x | Package manager | `corepack enable` |
| AnchorBrowser API key | Recording | https://anchorbrowser.io |
| Docker daemon | Sandbox runtime | Docker Desktop |

```bash
# Verify
node --version
pnpm --version
docker info
```

Copy `.env.example` to `.env` and add your AnchorBrowser key.

## Build Commands

```bash
pnpm install          # Install deps
pnpm build            # Build all
pnpm test             # Run ALL tests
pnpm typecheck        # Type check
pnpm lint             # Lint
```

## Structure

```
packages/types/src/    # Shared Zod schemas and TypeScript types
packages/core/src/     # Core business logic
apps/web/src/          # Next.js 15 frontend
apps/mcp-server/src/   # Standalone MCP server
```

## Code Rules

- **TypeScript only** - all files are `.ts`
- Zod for validation
- Async/await only
- Named exports only
- Tests colocated: `foo.ts` -> `foo.test.ts`
- Small, atomic commits

## Testing

Tests are non-negotiable.

- Every module has unit tests
- Integration tests for external services (guarded with `skipIf`)
- Tests must actually verify functionality

## External APIs

Use web search for docs on: AnchorBrowser SDK, Chrome DevTools Protocol (CDP), MCP SDK, Docker API (dockerode).
