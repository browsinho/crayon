# API Route Extractor

Analyzes recorded network calls to extract API endpoint patterns.

## Acceptance Criteria

- [ ] Groups calls by endpoint (method + path pattern)
- [ ] Parameterizes dynamic segments (/users/123 → /users/:id)
- [ ] Extracts request/response JSON schemas
- [ ] Identifies CRUD patterns (list, get, create, update, delete)

## Interface

```typescript
interface APIRoute {
  method: string;
  path: string;            // parameterized: /users/:id
  pattern: 'list' | 'get' | 'create' | 'update' | 'delete' | 'custom';
  requestSchema?: object;  // JSON schema
  responseSchema?: object;
  examples: { request?: any; response: any }[];
}

// Extract routes from network calls
extract(calls: NetworkCall[]): APIRoute[]
```

## Pattern Detection

| Pattern | Signals |
|---------|---------|
| list | GET + array response |
| get | GET + /:id + object response |
| create | POST + object response with id |
| update | PUT/PATCH + /:id |
| delete | DELETE + /:id |

## Definition of Done

1. Unit tests for parameterization (/users/123 → /users/:id)
2. Unit tests for each CRUD pattern
3. Test: 10 network calls → correct route grouping
