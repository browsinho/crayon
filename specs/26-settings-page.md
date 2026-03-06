# Settings Page

Page for configuring API keys, storage, and app preferences.

## Acceptance Criteria

- [ ] API key management (AnchorBrowser, OpenAI, etc.)
- [ ] API key validation/testing
- [ ] Storage path configuration
- [ ] Default generation options
- [ ] Theme selection
- [ ] Docker status display
- [ ] Clear data options

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings                                                       │
├────────────────────┬────────────────────────────────────────────┤
│                    │                                            │
│  API Keys          │  API Keys                                  │
│  Generation        │  ─────────────────────────────────────────  │
│  Storage           │                                            │
│  Appearance        │  AnchorBrowser API Key                     │
│  Docker            │  [••••••••••••••••••••••] [Show] [Test]    │
│  Advanced          │  ✓ Connected                               │
│                    │                                            │
│                    │  ─────────────────────────────────────────  │
│                    │                                            │
│                    │  OpenAI API Key (optional)                 │
│                    │  [_________________________] [Show] [Test] │
│                    │  Used for enhanced code generation         │
│                    │                                            │
│                    │  ─────────────────────────────────────────  │
│                    │                                            │
│                    │  Anthropic API Key (optional)              │
│                    │  [_________________________] [Show] [Test] │
│                    │  Used for natural language modifications   │
│                    │                                            │
│                    │                              [Save Changes] │
└────────────────────┴────────────────────────────────────────────┘
```

## Page Structure

```typescript
// src/app/settings/page.tsx
'use client'

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiKeysSection } from './sections/api-keys';
import { GenerationSection } from './sections/generation';
import { StorageSection } from './sections/storage';
import { AppearanceSection } from './sections/appearance';
import { DockerSection } from './sections/docker';
import { AdvancedSection } from './sections/advanced';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Tabs defaultValue="api-keys" orientation="vertical" className="flex gap-6">
        <TabsList className="flex flex-col h-auto w-48">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="generation">Generation</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="docker">Docker</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <div className="flex-1">
          <TabsContent value="api-keys">
            <ApiKeysSection />
          </TabsContent>
          <TabsContent value="generation">
            <GenerationSection />
          </TabsContent>
          <TabsContent value="storage">
            <StorageSection />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceSection />
          </TabsContent>
          <TabsContent value="docker">
            <DockerSection />
          </TabsContent>
          <TabsContent value="advanced">
            <AdvancedSection />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
```

## Section Components

```typescript
// API Keys section
function ApiKeysSection() {
  const { data: settings, mutate } = useSWR('/api/settings');

  const handleSave = async (key: string, value: string) => {
    await updateApiKey(key, value);
    mutate();
  };

  const handleTest = async (key: string) => {
    const result = await testApiKey(key);
    return result;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Configure API keys for external services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ApiKeyInput
          label="AnchorBrowser API Key"
          description="Required for browser recording"
          value={settings?.apiKeys?.anchorBrowser}
          onSave={(v) => handleSave('anchorBrowser', v)}
          onTest={() => handleTest('anchorBrowser')}
        />

        <Separator />

        <ApiKeyInput
          label="OpenAI API Key"
          description="Optional - Used for enhanced code generation"
          value={settings?.apiKeys?.openai}
          onSave={(v) => handleSave('openai', v)}
          onTest={() => handleTest('openai')}
        />

        <Separator />

        <ApiKeyInput
          label="Anthropic API Key"
          description="Optional - Used for natural language sandbox modifications"
          value={settings?.apiKeys?.anthropic}
          onSave={(v) => handleSave('anthropic', v)}
          onTest={() => handleTest('anthropic')}
        />
      </CardContent>
    </Card>
  );
}

// API key input with show/hide and test
interface ApiKeyInputProps {
  label: string;
  description: string;
  value?: string;
  onSave: (value: string) => Promise<void>;
  onTest: () => Promise<{ success: boolean; error?: string }>;
}

function ApiKeyInput({ label, description, value, onSave, onTest }: ApiKeyInputProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    const result = await onTest();
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(inputValue);
    setIsSaving(false);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <Input
          type={showKey ? 'text' : 'password'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter API key..."
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowKey(!showKey)}
        >
          {showKey ? <EyeOff /> : <Eye />}
        </Button>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={!inputValue || isTesting}
        >
          {isTesting ? <Loader2 className="animate-spin" /> : 'Test'}
        </Button>
        <Button
          onClick={handleSave}
          disabled={!inputValue || isSaving}
        >
          {isSaving ? <Loader2 className="animate-spin" /> : 'Save'}
        </Button>
      </div>
      {testResult && (
        <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
          {testResult.success ? '✓ Connected successfully' : `✗ ${testResult.error}`}
        </p>
      )}
    </div>
  );
}

// Generation defaults section
function GenerationSection() {
  const { data: settings, mutate } = useSWR('/api/settings');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Generation Options</CardTitle>
        <CardDescription>
          Default settings for sandbox generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Frontend Framework</Label>
            <Select defaultValue={settings?.generation?.frontend || 'nextjs'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nextjs">Next.js</SelectItem>
                <SelectItem value="react">React (Vite)</SelectItem>
                <SelectItem value="vue">Vue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Styling</Label>
            <Select defaultValue={settings?.generation?.styling || 'tailwind'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tailwind">Tailwind CSS</SelectItem>
                <SelectItem value="css-modules">CSS Modules</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Backend</Label>
            <Select defaultValue={settings?.generation?.backend || 'express'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="express">Express</SelectItem>
                <SelectItem value="fastify">Fastify</SelectItem>
                <SelectItem value="hono">Hono</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Database</Label>
            <Select defaultValue={settings?.generation?.database || 'sqlite'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox defaultChecked={settings?.generation?.includeSampleData} />
            <Label>Include sample data by default</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox defaultChecked={settings?.generation?.downloadAssets} />
            <Label>Download assets by default</Label>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button>Save Defaults</Button>
      </CardFooter>
    </Card>
  );
}

// Storage section
function StorageSection() {
  const { data: usage } = useSWR('/api/settings/storage');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>
          Manage local storage and data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Storage Usage</Label>
          <Progress value={(usage?.used / usage?.total) * 100} className="mt-2" />
          <p className="text-sm text-muted-foreground mt-1">
            {formatBytes(usage?.used)} of {formatBytes(usage?.total)} used
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Projects:</span>{' '}
            {formatBytes(usage?.projects)}
          </div>
          <div>
            <span className="text-muted-foreground">Recordings:</span>{' '}
            {formatBytes(usage?.recordings)}
          </div>
          <div>
            <span className="text-muted-foreground">Sandboxes:</span>{' '}
            {formatBytes(usage?.sandboxes)}
          </div>
          <div>
            <span className="text-muted-foreground">Cache:</span>{' '}
            {formatBytes(usage?.cache)}
          </div>
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button variant="outline" onClick={clearCache}>
            Clear Cache
          </Button>
          <Button variant="destructive" onClick={clearAllData}>
            Delete All Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Docker status section
function DockerSection() {
  const { data: docker } = useSWR('/api/settings/docker');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Docker</CardTitle>
        <CardDescription>
          Docker daemon status and container management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${docker?.running ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>
            {docker?.running ? 'Docker is running' : 'Docker is not running'}
          </span>
        </div>

        {docker?.running && (
          <>
            <div className="text-sm">
              <p>Running containers: {docker?.containers?.length || 0}</p>
              <p>Images: {docker?.images?.length || 0}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={stopAllContainers}>
                Stop All Containers
              </Button>
              <Button variant="outline" onClick={pruneDocker}>
                Clean Up Unused
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Appearance section
function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="flex gap-2">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              onClick={() => setTheme('light')}
            >
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              onClick={() => setTheme('dark')}
            >
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              onClick={() => setTheme('system')}
            >
              System
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## API Routes

```typescript
// src/app/api/settings/route.ts
import { getSettings, updateSettings } from '@/lib/settings';

export async function GET() {
  const settings = await getSettings();
  return Response.json(settings);
}

export async function PUT(request: Request) {
  const data = await request.json();
  const settings = await updateSettings(data);
  return Response.json(settings);
}

// src/app/api/settings/test-key/route.ts
export async function POST(request: Request) {
  const { service, key } = await request.json();

  try {
    switch (service) {
      case 'anchorBrowser':
        // Test AnchorBrowser connection
        break;
      case 'openai':
        // Test OpenAI connection
        break;
      case 'anthropic':
        // Test Anthropic connection
        break;
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
}
```

## Testing Requirements

### Unit Tests
- Test API key input masking
- Test form validation
- Test theme toggle
- Mock settings API

### Integration Tests
- Save settings and reload
- API key test functionality
- Storage usage calculation

## Definition of Done

- [ ] API keys can be saved and tested
- [ ] Keys are masked by default
- [ ] Generation defaults are configurable
- [ ] Storage usage displays correctly
- [ ] Clear cache works
- [ ] Docker status shows correctly
- [ ] Theme toggle works
- [ ] Settings persist across sessions
