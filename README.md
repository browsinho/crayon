# Crayon

Sandbox environment platform for browser AI agent developers. Record real browsing sessions, generate functional sandboxes with realistic data, and control them via MCP.

## What is Crayon?

Browser AI agents need realistic test environments. Crayon records real websites and generates standalone, functional replicas that agents can interact with -- complete with realistic data, working APIs, and Docker-based isolation.

### How it works

```
Record  ->  Analyze  ->  Generate  ->  Run
```

1. **Record** -- Browse a real website while Crayon captures DOM snapshots, network calls, screenshots, and user interactions via [AnchorBrowser](https://anchorbrowser.io)
2. **Analyze** -- Automatically detect frameworks, API routes, schemas, auth patterns, and UI widgets from the recording
3. **Generate** -- Create a standalone replica with a React frontend, Express backend, LLM-generated realistic data, and Docker containers
4. **Run** -- Manage sandboxes via Docker with checkpoint/restore, and control them through MCP tools for AI agent integration

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (`corepack enable`)
- **Docker** (for sandbox features)
- **AnchorBrowser API key** (for recording -- get one at [anchorbrowser.io](https://anchorbrowser.io))

### Setup

```bash
git clone https://github.com/nichochar/crayon.git
cd crayon
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANCHOR_BROWSER_API_KEY

# Build all packages
pnpm build

# Start the web app
pnpm --filter @crayon/web dev
```

Open [http://localhost:3000](http://localhost:3000) to access the Crayon dashboard.

### Start the MCP server

```bash
pnpm --filter @crayon/mcp-server dev
```

The MCP server runs on port 3002 and exposes tools for AI agents to interact with sandboxes.

## Project Structure

```
crayon/
├── packages/
│   ├── types/         # Shared Zod schemas and TypeScript types
│   └── core/          # Core business logic (recording, analysis, generation, sandbox)
├── apps/
│   ├── web/           # Next.js 15 dashboard
│   └── mcp-server/    # Standalone MCP server for AI agents
└── specs/             # Module specifications
```

### Core Modules (`packages/core/src/`)

| Category | Modules |
|----------|---------|
| **Recording** | `browser-session`, `dom-capture`, `network-capture`, `screenshot-capture`, `user-event-capture` |
| **Analysis** | `framework-detector`, `api-route-extractor`, `schema-inferrer`, `auth-detector`, `widget-detector` |
| **Generation** | `frontend-generator`, `backend-generator`, `data-generator`, `lovable-adapter`, `generation-orchestrator` |
| **Sandbox** | `sandbox-manager`, `sandbox-hosting`, `sandbox-dev-container`, `checkpoint-manager`, `docker-builder` |
| **MCP** | `mcp-server`, `mcp-http-transport`, `mcp-tool-registry`, `mcp-code-tools` |

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # Type check
pnpm lint             # Lint all packages
pnpm clean            # Clean build artifacts
```

### Package-specific commands

```bash
pnpm --filter @crayon/web dev          # Start Next.js dev server
pnpm --filter @crayon/core test        # Run core tests
pnpm --filter @crayon/mcp-server dev   # Start MCP server

# Run a single test file
pnpm --filter @crayon/core test src/dom-capture.test.ts
```

## MCP Integration

Crayon exposes [Model Context Protocol](https://modelcontextprotocol.io) tools so AI agents can control sandboxes. See the [MCP server README](apps/mcp-server/README.md) for details on available tools and configuration.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and how to submit changes.

## License

[MIT](LICENSE)
