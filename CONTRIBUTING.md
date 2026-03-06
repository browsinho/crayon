# Contributing to Crayon

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9 (`corepack enable`)
- Docker (for sandbox features)
- AnchorBrowser API key (for recording features -- get one at [anchorbrowser.io](https://anchorbrowser.io))

### Getting Started

```bash
git clone https://github.com/nichochar/crayon.git
cd crayon
pnpm install
cp .env.example .env
# Add your ANCHOR_BROWSER_API_KEY to .env

pnpm build
pnpm test
```

## Code Standards

- **TypeScript only** -- all source files are `.ts` (or `.tsx` for React components)
- **Zod** for runtime validation of all data structures
- **Async/await** only (no callbacks or raw promises)
- **Named exports** only (no default exports)
- **Colocated tests** -- `foo.ts` has its test at `foo.test.ts`

## Making Changes

1. Fork the repository and create a feature branch from `main`
2. Make your changes following the code standards above
3. Add or update tests for any changed functionality
4. Run the full check suite:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

5. Commit with a descriptive message using conventional commits:

```
feat: add websocket support to sandbox manager
fix: handle empty DOM snapshots in capture
docs: update MCP server configuration guide
```

6. Open a pull request against `main`

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` -- new feature
- `fix:` -- bug fix
- `docs:` -- documentation only
- `style:` -- formatting, no code change
- `refactor:` -- code change that neither fixes a bug nor adds a feature
- `test:` -- adding or updating tests
- `chore:` -- maintenance tasks

## Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @crayon/core test
pnpm --filter @crayon/web test

# Single test file
pnpm --filter @crayon/core test src/dom-capture.test.ts
```

Integration tests that require external services (AnchorBrowser, Docker) are automatically skipped when the required environment variables or services aren't available.

## Project Structure

```
packages/
  types/       # Shared Zod schemas and TypeScript types
  core/        # Core business logic
apps/
  web/         # Next.js 15 dashboard
  mcp-server/  # Standalone MCP server
specs/         # Module specifications (reference documentation)
```

## Reporting Issues

- Use [GitHub Issues](https://github.com/nichochar/crayon/issues) for bug reports and feature requests
- For security vulnerabilities, see [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
