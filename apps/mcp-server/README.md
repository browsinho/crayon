# MCP Server

Standalone HTTP server application that exposes sandbox manipulation via the Model Context Protocol (MCP).

## Overview

The MCP Server provides HTTP/SSE endpoints that enable external AI clients (like Cursor IDE and Claude Desktop) to connect to and manipulate Crayon sandboxes. It exposes code manipulation tools through a standardized MCP interface.

## Features

- **HTTP/SSE Transport**: REST API and Server-Sent Events for real-time communication
- **Tool Registry**: Exposes sandbox manipulation tools (read, write, edit files, list files, run builds)
- **API Key Authentication**: Secure access with API key validation
- **Sandbox Resolution**: Automatic sandbox path and container resolution
- **Tool Call Logging**: Comprehensive logging of all tool invocations

## Installation

```bash
pnpm install
```

## Development

Start the server in development mode with hot reload:

```bash
pnpm dev
```

The server will start on `http://localhost:3002` by default.

## Production

Build and start the server:

```bash
pnpm build
pnpm start
```

## Configuration

Configure the server using environment variables:

- `MCP_PORT` - Server port (default: `3002`)
- `MCP_HOST` - Server host (default: `0.0.0.0`)
- `DATA_DIR` - Data directory path (default: `./data`)
- `LOG_LEVEL` - Logging level (default: `info`)

## Endpoints

### Health Check

```
GET /health
```

Returns server health status.

### MCP Endpoints

```
GET /mcp/:sandboxId
```

Server-Sent Events endpoint for real-time communication.

```
POST /mcp/:sandboxId
```

JSON-RPC endpoint for MCP requests. Supports:
- `tools/list` - List available tools
- `tools/call` - Execute a tool

```
GET /mcp/:sandboxId/tools
```

Convenience endpoint to list available tools.

## API Authentication

All MCP endpoints require API key authentication via the `x-api-key` header.

### Getting an API Key

API keys are automatically generated for each sandbox. To get the API key for a sandbox:

```bash
cat ./data/projects/{sandboxId}/.mcp-key
```

### API Key Format

API keys follow the pattern: `cry_[a-zA-Z0-9_-]{20,}`

## Available Tools

- `sandbox_read_file` - Read a file from the sandbox
- `sandbox_write_file` - Create or overwrite a file
- `sandbox_edit_file` - Edit a file with find/replace
- `sandbox_list_files` - List files in the sandbox
- `sandbox_run_build` - Run npm build

## Client Configuration

### Cursor IDE

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "crayon-sandbox": {
      "url": "http://localhost:3002/mcp/YOUR_SANDBOX_ID",
      "headers": {
        "x-api-key": "cry_YOUR_API_KEY"
      }
    }
  }
}
```

### Claude Desktop

Add to Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "crayon-sandbox": {
      "url": "http://localhost:3002/mcp/YOUR_SANDBOX_ID",
      "headers": {
        "x-api-key": "cry_YOUR_API_KEY"
      }
    }
  }
}
```

## Example Usage

### List Tools

```bash
curl -X POST http://localhost:3002/mcp/my-sandbox \
  -H "Content-Type: application/json" \
  -H "x-api-key: cry_your_api_key_here" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### Read a File

```bash
curl -X POST http://localhost:3002/mcp/my-sandbox \
  -H "Content-Type: application/json" \
  -H "x-api-key: cry_your_api_key_here" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "sandbox_read_file",
      "arguments": {
        "path": "src/App.tsx"
      }
    }
  }'
```

## Architecture

```
┌─────────────────────────────────────────┐
│        EXTERNAL CLIENTS                  │
│  Cursor IDE | Claude Desktop | Other     │
└──────────────────┬──────────────────────┘
                   │ HTTP/SSE
                   ▼
┌─────────────────────────────────────────┐
│         MCP SERVER APP                   │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Express Server                    │ │
│  │  - Health endpoint                 │ │
│  │  - MCP HTTP transport              │ │
│  │  - API key validation              │ │
│  │  - Sandbox resolution              │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Tool Registry                     │ │
│  │  - sandbox_read_file               │ │
│  │  - sandbox_write_file              │ │
│  │  - sandbox_edit_file               │ │
│  │  - sandbox_list_files              │ │
│  │  - sandbox_run_build               │ │
│  └────────────────────────────────────┘ │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│    SANDBOX INFRASTRUCTURE                │
│  SandboxManager | DevContainer | Docker  │
└─────────────────────────────────────────┘
```

## Testing

Run tests:

```bash
pnpm test
```

## License

MIT
