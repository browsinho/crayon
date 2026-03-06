# Crayon PRD

Sandbox environment platform for browser agent developers.

## Problem

Browser AI agent developers need test environments resembling real websites. Current solutions (Lovable, AI-generated sites) produce generic mocks.

## Solution

Record real browsing sessions → Generate functional sandboxes with realistic data → Control via MCP.

## User Flow

1. **Record**: User browses real website, we capture DOM/network/screenshots
2. **Generate**: One-shot sandbox generation with LLM-generated data
3. **Use**: Developer controls sandbox via MCP, resets to checkpoints

## Specs

See `specs/` directory. Each spec is one atomic capability:

| # | Spec | Capability |
|---|------|------------|
| 01 | browser-session | AnchorBrowser session management |
| 02 | dom-capture | DOM snapshot capture via CDP |
| 03 | network-capture | HTTP request/response capture |
| 04 | screenshot-capture | PNG screenshot capture |
| 05 | pii-anonymizer | PII detection and replacement |
| 06 | recording-storage | Filesystem storage for recordings |
| 07 | framework-detector | React/Vue/Angular detection |
| 08 | api-route-extractor | API endpoint pattern extraction |
| 09 | schema-inferrer | Data schema inference from JSON |
| 10 | auth-detector | Auth mechanism detection |
| 11 | widget-detector | Third-party widget detection |
| 12 | frontend-generator | Vite+React project generation |
| 13 | backend-generator | Express mock server generation |
| 14 | data-generator | LLM-based realistic data |
| 15 | asset-downloader | Image/font download and URL rewrite |
| 16 | docker-builder | Docker image packaging |
| 17 | sandbox-manager | Container lifecycle management |
| 18 | checkpoint-system | State snapshot and restore |
| 19 | mcp-server | MCP tools for sandbox control |
| 20 | prompt-modifier | Natural language data modification |

## Tech Stack

- TypeScript, Vite, Node.js
- AnchorBrowser for browser infrastructure
- Docker for sandbox isolation
- LLM for data generation

## Out of Scope (MVP)

- Multi-user collaboration
- WebSockets
- Cloud hosting
- iframes, shadow DOM, canvas
