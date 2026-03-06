# Backend Generator

Generates mock API server from extracted routes.

## Acceptance Criteria

- [ ] Generates Express server with all routes
- [ ] Each route returns recorded response structure
- [ ] Connects to SQLite for data storage
- [ ] Supports CRUD operations on entities

## Interface

```typescript
interface GeneratedBackend {
  files: { path: string; content: string }[];
  routes: string[];
  entities: string[];
}

// Generate backend from API routes and schemas
generate(
  routes: APIRoute[],
  schemas: DataSchema[]
): Promise<GeneratedBackend>
```

## Output Structure

```
backend/
├── package.json
├── src/
│   ├── server.ts
│   ├── routes/
│   │   └── {entity}.ts
│   └── db.ts
└── data.sqlite
```

## Generated Route Example

```typescript
app.get('/api/users/:id', (req, res) => {
  const user = db.get('users', req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});
```

## Definition of Done

1. Generated server runs with `npm start`
2. All extracted routes are accessible
3. CRUD operations work on SQLite
