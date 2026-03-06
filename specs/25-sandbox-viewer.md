# Sandbox Viewer Page

Page for viewing and interacting with generated sandboxes.

## ⚠️ External Integration

**USE WEB SEARCH** to find current documentation.
- Search: "Monaco Editor React integration 2025"
- Search: "xterm.js React component"
- Search: "Next.js iframe sandbox communication"

Do NOT guess. Find the real docs.

## Acceptance Criteria

- [ ] Launch/stop sandbox controls
- [ ] Embedded browser view (iframe to sandbox URL)
- [ ] Code explorer with syntax highlighting
- [ ] Database viewer with CRUD
- [ ] Container logs streaming
- [ ] Terminal access
- [ ] Checkpoint management
- [ ] MCP connection info

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Sandbox: E-commerce       [● Running]  [Restart] [Stop]       │
│  ← Back to project                                              │
├─────────────────────────────────────────────────────────────────┤
│  [Browser] [Code] [Data] [Logs] [Terminal] [MCP]               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ── Browser Tab ──                                              │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  ← → ↻  [http://localhost:3000________]        [Screenshot] │
│  ├─────────────────────────────────────────────────────────────┤
│  │                                                             │
│  │                                                             │
│  │              SANDBOX IFRAME                                 │
│  │              (running app)                                  │
│  │                                                             │
│  │                                                             │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Checkpoints: [initial ●] [logged-in] [cart-full] [+ Create]   │
└─────────────────────────────────────────────────────────────────┘

── Code Tab ──

┌─────────────────────────────────────────────────────────────────┐
│  ┌─ Files ──────────┬─ src/app/page.tsx ───────────────────────┐
│  │  📁 frontend     │  1  import { ProductGrid } from './...   │
│  │    📁 src        │  2                                       │
│  │      📁 app      │  3  export default function Home() {     │
│  │        📄 page   │  4    const products = useProducts();    │
│  │        📄 layout │  5    return (                           │
│  │      📁 components│  6      <main className="p-4">          │
│  │    📄 package    │  7        <ProductGrid items={products}/>│
│  │  📁 backend      │  8      </main>                          │
│  │    📁 src        │  9    );                                 │
│  │      📄 index.ts │ 10  }                                    │
│  │      📁 routes   │                                          │
│  └──────────────────┴──────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

── Data Tab ──

┌─────────────────────────────────────────────────────────────────┐
│  Table: [products ▼]                    [+ Add Row] [Refresh]  │
├─────────────────────────────────────────────────────────────────┤
│  │ id │ name            │ price  │ stock │ category │ actions │
│  ├────┼─────────────────┼────────┼───────┼──────────┼─────────│
│  │ 1  │ Wireless Mouse  │ $29.99 │ 150   │ Tech     │ ✎ 🗑    │
│  │ 2  │ Keyboard Pro    │ $79.99 │ 85    │ Tech     │ ✎ 🗑    │
│  │ 3  │ USB-C Hub       │ $49.99 │ 200   │ Tech     │ ✎ 🗑    │
│  └────┴─────────────────┴────────┴───────┴──────────┴─────────┘
│                                                                 │
│  Showing 3 of 25 rows                          [← 1 2 3 4 5 →] │
└─────────────────────────────────────────────────────────────────┘
```

## Page Structure

```typescript
// src/app/project/[id]/sandbox/page.tsx
'use client'

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSandbox } from '@/hooks/use-sandbox';
import { SandboxControls } from './components/sandbox-controls';
import { BrowserTab } from './components/browser-tab';
import { CodeTab } from './components/code-tab';
import { DataTab } from './components/data-tab';
import { LogsTab } from './components/logs-tab';
import { TerminalTab } from './components/terminal-tab';
import { McpTab } from './components/mcp-tab';
import { CheckpointBar } from './components/checkpoint-bar';

export default function SandboxPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('browser');

  const {
    sandbox,
    status,
    start,
    stop,
    restart,
  } = useSandbox(id);

  return (
    <div className="flex flex-col h-full gap-4">
      <SandboxControls
        sandbox={sandbox}
        status={status}
        onStart={start}
        onStop={stop}
        onRestart={restart}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList>
          <TabsTrigger value="browser">Browser</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="mcp">MCP</TabsTrigger>
        </TabsList>

        <TabsContent value="browser" className="flex-1">
          <BrowserTab sandboxId={id} sandboxUrl={sandbox?.url} />
        </TabsContent>

        <TabsContent value="code">
          <CodeTab sandboxId={id} />
        </TabsContent>

        <TabsContent value="data">
          <DataTab sandboxId={id} />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTab sandboxId={id} />
        </TabsContent>

        <TabsContent value="terminal">
          <TerminalTab sandboxId={id} />
        </TabsContent>

        <TabsContent value="mcp">
          <McpTab sandboxId={id} />
        </TabsContent>
      </Tabs>

      <CheckpointBar sandboxId={id} />
    </div>
  );
}
```

## Components

```typescript
// Sandbox control bar
function SandboxControls({
  sandbox,
  status,
  onStart,
  onStop,
  onRestart,
}: SandboxControlsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">{sandbox?.name}</h1>
        <StatusBadge status={status} />
      </div>
      <div className="flex gap-2">
        {status === 'stopped' && (
          <Button onClick={onStart}>Start</Button>
        )}
        {status === 'running' && (
          <>
            <Button variant="outline" onClick={onRestart}>Restart</Button>
            <Button variant="destructive" onClick={onStop}>Stop</Button>
          </>
        )}
      </div>
    </div>
  );
}

// Browser iframe tab
function BrowserTab({ sandboxId, sandboxUrl }: BrowserTabProps) {
  const [url, setUrl] = useState(sandboxUrl || '');

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex gap-2">
        <Button size="icon" variant="ghost"><ArrowLeft /></Button>
        <Button size="icon" variant="ghost"><ArrowRight /></Button>
        <Button size="icon" variant="ghost"><RotateCw /></Button>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline">Screenshot</Button>
      </div>
      <iframe
        src={sandboxUrl}
        className="flex-1 w-full border rounded-lg"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}

// Code explorer tab
function CodeTab({ sandboxId }: { sandboxId: string }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { data: files } = useSWR(`/api/sandbox/${sandboxId}/files`);
  const { data: content } = useSWR(
    selectedFile ? `/api/sandbox/${sandboxId}/file?path=${selectedFile}` : null
  );

  return (
    <div className="flex h-full border rounded-lg overflow-hidden">
      <div className="w-64 border-r overflow-auto">
        <FileTree files={files} onSelect={setSelectedFile} selected={selectedFile} />
      </div>
      <div className="flex-1">
        {selectedFile && content && (
          <MonacoEditor
            value={content}
            language={getLanguage(selectedFile)}
            theme="vs-dark"
            options={{ readOnly: true, minimap: { enabled: false } }}
          />
        )}
      </div>
    </div>
  );
}

// Database viewer tab
function DataTab({ sandboxId }: { sandboxId: string }) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const { data: tables } = useSWR(`/api/sandbox/${sandboxId}/tables`);
  const { data: rows, mutate } = useSWR(
    selectedTable ? `/api/sandbox/${sandboxId}/table/${selectedTable}` : null
  );

  const handleCreate = async (data: Record<string, unknown>) => {
    await createRow(sandboxId, selectedTable!, data);
    mutate();
  };

  const handleUpdate = async (id: string, data: Record<string, unknown>) => {
    await updateRow(sandboxId, selectedTable!, id, data);
    mutate();
  };

  const handleDelete = async (id: string) => {
    await deleteRow(sandboxId, selectedTable!, id);
    mutate();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Select value={selectedTable || ''} onValueChange={setSelectedTable}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select table" />
          </SelectTrigger>
          <SelectContent>
            {tables?.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreateDialog(true)}>Add Row</Button>
        <Button variant="outline" onClick={() => mutate()}>Refresh</Button>
      </div>

      {rows && (
        <DataTable
          data={rows}
          onEdit={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// Logs streaming tab
function LogsTab({ sandboxId }: { sandboxId: string }) {
  const { data: logs } = useSSE<LogEntry>(`/api/sandbox/${sandboxId}/logs`);

  return (
    <div className="h-full bg-black text-green-400 font-mono text-sm p-4 overflow-auto">
      {logs.map((log, i) => (
        <div key={i}>
          <span className="text-gray-500">[{log.timestamp}]</span>{' '}
          <span className={log.level === 'error' ? 'text-red-400' : ''}>
            {log.message}
          </span>
        </div>
      ))}
    </div>
  );
}

// Terminal tab
function TerminalTab({ sandboxId }: { sandboxId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const terminal = new Terminal();
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current!);
    fitAddon.fit();

    // WebSocket connection to sandbox shell
    const ws = new WebSocket(`/api/sandbox/${sandboxId}/terminal`);
    ws.onmessage = (e) => terminal.write(e.data);
    terminal.onData((data) => ws.send(data));

    return () => {
      ws.close();
      terminal.dispose();
    };
  }, [sandboxId]);

  return <div ref={terminalRef} className="h-full" />;
}

// MCP connection info tab
function McpTab({ sandboxId }: { sandboxId: string }) {
  const { data: mcpConfig } = useSWR(`/api/sandbox/${sandboxId}/mcp`);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>MCP Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            Connect your AI agent to this sandbox:
          </p>
          <pre className="bg-muted p-4 rounded text-sm overflow-auto">
{`{
  "mcpServers": {
    "crayon-sandbox": {
      "url": "${mcpConfig?.url}",
      "apiKey": "${mcpConfig?.apiKey}"
    }
  }
}`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {mcpConfig?.tools.map((tool) => (
              <li key={tool.name} className="flex items-start gap-2">
                <code className="text-sm bg-muted px-1 rounded">{tool.name}</code>
                <span className="text-sm text-muted-foreground">{tool.description}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// Checkpoint bar
function CheckpointBar({ sandboxId }: { sandboxId: string }) {
  const { data: checkpoints, mutate } = useSWR(`/api/sandbox/${sandboxId}/checkpoints`);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<string | null>(null);

  const handleCreate = async () => {
    const name = prompt('Checkpoint name:');
    if (name) {
      await createCheckpoint(sandboxId, name);
      mutate();
    }
  };

  const handleRestore = async (checkpointId: string) => {
    await restoreCheckpoint(sandboxId, checkpointId);
    setCurrentCheckpoint(checkpointId);
  };

  return (
    <div className="flex items-center gap-2 p-2 border-t">
      <span className="text-sm font-medium">Checkpoints:</span>
      <div className="flex gap-1">
        {checkpoints?.map((cp) => (
          <Button
            key={cp.id}
            size="sm"
            variant={currentCheckpoint === cp.id ? 'default' : 'outline'}
            onClick={() => handleRestore(cp.id)}
          >
            {cp.name}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={handleCreate}>
          + Create
        </Button>
      </div>
    </div>
  );
}
```

## Testing Requirements

### Unit Tests
- Test tab switching
- Test controls for different states
- Test file tree navigation
- Test data table CRUD

### Integration Tests
- Sandbox starts and iframe loads
- Code files are readable
- Database CRUD works
- Logs stream in real-time

## Definition of Done

- [ ] Sandbox controls work (start/stop/restart)
- [ ] Browser iframe displays sandbox app
- [ ] Code tab shows files with syntax highlighting
- [ ] Data tab allows CRUD operations
- [ ] Logs stream in real-time
- [ ] Terminal connects to container
- [ ] MCP config displayed correctly
- [ ] Checkpoints can be created/restored
