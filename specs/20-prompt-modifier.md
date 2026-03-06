# Prompt Modifier

Modifies sandbox data via simple command parsing.

## Acceptance Criteria

- [ ] Parses commands to data operations
- [ ] Supports add/update/delete operations
- [ ] Generates data using Faker.js when adding
- [ ] Validates operations before applying
- [ ] Returns summary of changes made

## Interface

```typescript
interface PromptResult {
  success: boolean;
  changes: {
    entity: string;
    operation: 'create' | 'update' | 'delete';
    count: number;
  }[];
  error?: string;
}

export function process(
  command: string,
  sandboxId: string
): Promise<PromptResult>;
```

## Supported Commands

Parse these patterns (case-insensitive):

| Pattern | Action |
|---------|--------|
| `add N {entity}` | Creates N records |
| `create N {entity}` | Creates N records |
| `delete all {entity}` | Deletes all records |
| `delete {entity} where {field}={value}` | Deletes matching |
| `update {entity} set {field}={value}` | Updates all |
| `update {entity} set {field}={value} where {field}={value}` | Updates matching |
| `mark all {entity} as {field}` | Sets boolean field true |

## Examples

```typescript
// "add 10 emails" → creates 10 email records
// "delete all users" → removes all user records
// "mark all emails as read" → updates read=true
// "update users set active=false where role=guest"
```

## Testing Requirements

### Unit Tests (`prompt-modifier.test.ts`)
- Test each command pattern parses correctly
- Test invalid commands return error
- Test data generation uses Faker

### Integration Tests (`prompt-modifier.integration.test.ts`)
- "add 5 emails" creates 5 records in DB
- "delete all users" removes records
- "mark all emails as read" updates records

## Definition of Done

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] All command patterns work
- [ ] Invalid commands return helpful error
- [ ] Changes reflected in sandbox DB
