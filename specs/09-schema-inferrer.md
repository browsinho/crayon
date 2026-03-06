# Schema Inferrer

Infers data schemas from API response examples.

## Acceptance Criteria

- [ ] Infers field names and types from JSON
- [ ] Detects formats (email, url, date, uuid)
- [ ] Identifies relationships (foreign keys)
- [ ] Handles arrays and nested objects

## Interface

```typescript
interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  format?: 'email' | 'url' | 'uuid' | 'date';
  nullable: boolean;
  example: any;
}

interface DataSchema {
  entity: string;
  fields: FieldSchema[];
  relationships: { field: string; relatedEntity: string }[];
}

// Infer schema from API routes
infer(routes: APIRoute[]): DataSchema[]
```

## Format Detection

| Format | Pattern |
|--------|---------|
| email | `*@*.*` |
| url | `http(s)://` |
| uuid | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| date | ISO 8601 pattern |

## Definition of Done

1. Unit tests for type inference
2. Unit tests for format detection
3. Test: user JSON → schema with email format detected
