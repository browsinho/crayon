# MCP Server

Exposes sandbox control via Model Context Protocol.

## ⚠️ External Integration

**USE WEB SEARCH** to find MCP SDK documentation.
- Search: "Model Context Protocol SDK documentation"
- Search: "@modelcontextprotocol/sdk npm"
- Search: "MCP server typescript example"
- Search: "MCP tool definition schema"

Do NOT guess. Find the real SDK docs.

## Acceptance Criteria

- [ ] Runs as MCP server (stdio or HTTP transport)
- [ ] Authenticates via API key
- [ ] Exposes tools for sandbox control
- [ ] Returns structured responses

## Tools

| Tool | Purpose |
|------|---------|
| `sandbox_reset` | Reset to checkpoint |
| `sandbox_navigate` | Navigate to URL |
| `sandbox_screenshot` | Capture screenshot |
| `sandbox_get_state` | Get current state (URL, DOM, data) |
| `sandbox_modify_data` | CRUD operations on data |
| `sandbox_action` | UI actions (click, type) |
| `sandbox_checkpoint` | Create/list/restore checkpoints |
| `sandbox_prompt` | Modify via natural language |

## Interface

```typescript
const server = new McpServer({ name: 'crayon-sandbox' });
server.tool('sandbox_reset', schema, handler);
server.listen({ transport: 'stdio' });
```

## Authentication

```typescript
const apiKey = request.headers['x-api-key'];
// Key format: cry_xxxxxxxxxx
```

## Testing Requirements

### Unit Tests (`mcp-server.test.ts`)
- Test each tool handler with mocked sandbox
- Test API key validation
- Test error responses

### Integration Tests (`mcp-server.integration.test.ts`)
- **REQUIRES RUNNING SANDBOX**
- Start MCP server
- Connect MCP client
- Call each tool, verify response
- Test: reset → navigate → screenshot → verify
- Test invalid API key rejected

## Definition of Done

- [ ] Unit tests pass (mocked sandbox)
- [ ] Integration tests pass (real MCP client)
- [ ] Server starts and accepts connections
- [ ] All 8 tools registered and callable
- [ ] Each tool returns correct response structure
- [ ] Invalid API key returns auth error
