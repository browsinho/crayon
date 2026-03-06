# Checkpoint System

Saves and restores sandbox state for quick reset.

## Acceptance Criteria

- [ ] Can create checkpoint (snapshot current state)
- [ ] Can restore to any checkpoint
- [ ] Snapshots SQLite database
- [ ] Snapshots browser storage (localStorage, cookies)
- [ ] "initial" checkpoint created on sandbox generation

## Interface

```typescript
interface Checkpoint {
  id: string;
  name: string;
  createdAt: Date;
  databasePath: string;
  browserState: {
    localStorage: Record<string, string>;
    cookies: Cookie[];
  };
}

// Create checkpoint
create(sandboxId: string, name: string): Promise<Checkpoint>

// Restore checkpoint
restore(sandboxId: string, checkpointId: string): Promise<void>

// List checkpoints
list(sandboxId: string): Promise<Checkpoint[]>

// Delete checkpoint
delete(checkpointId: string): Promise<void>
```

## Storage

```
checkpoints/
└── {sandbox-id}/
    ├── initial/
    │   ├── data.sqlite
    │   └── state.json
    └── {checkpoint-name}/
        ├── data.sqlite
        └── state.json
```

## Definition of Done

1. Create checkpoint, modify data, restore → data reverted
2. Browser state (localStorage) restored correctly
3. Reset to initial works after many changes
