# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Crayon, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainers directly. We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Scope

This security policy applies to:

- The Crayon core library (`packages/core`)
- The web dashboard (`apps/web`)
- The MCP server (`apps/mcp-server`)
- Docker container isolation and sandbox security

## Best Practices

When using Crayon:

- Never commit API keys or secrets to version control
- Use `.env` files for sensitive configuration (already gitignored)
- Keep Docker and Node.js updated to their latest stable versions
- Review sandbox permissions before exposing them to untrusted agents
