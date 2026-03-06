# Frontend Generator

Generates working Vite+React project from AI-generated code (via Lovable adapter).

## ⚠️ Architecture Change

This spec was updated to work with the new AI-powered generation pipeline:
- **Old approach**: Direct DOM → React conversion
- **New approach**: AI generates code (spec 30) → This module validates/packages it

## Purpose

Validates AI-generated frontend code and creates a production-ready Vite project.

## Acceptance Criteria

- [ ] Receives GenerationResult from Lovable Adapter (spec 30)
- [ ] Validates all TypeScript/JSX files compile
- [ ] Validates Tailwind classes are valid
- [ ] Creates complete Vite project structure
- [ ] Generates package.json with detected dependencies
- [ ] Installs npm packages
- [ ] Runs `npm run build` to verify compilation
- [ ] Returns paths to generated files

## Interface

```typescript
interface FrontendGeneratorInput {
  generationResult: GenerationResult; // From spec 30 (Lovable Adapter)
  projectPath: string; // Where to write files
  framework: 'react'; // Only React for now
}

interface FrontendGeneratorOutput {
  projectPath: string;
  files: string[]; // Paths to all generated files
  packages: string[]; // Installed packages
  buildSuccess: boolean;
  errors: string[];
  warnings: string[];
}

// Validate and write AI-generated frontend
generate(input: FrontendGeneratorInput): Promise<FrontendGeneratorOutput>
```

## Validation Steps

### 1. TypeScript/JSX Validation
```typescript
// Use TypeScript compiler API
import ts from 'typescript';

function validateTypeScript(files: { path: string; content: string }[]): string[] {
  const errors: string[] = [];
  // Compile in-memory, report errors
  return errors;
}
```

### 2. Tailwind Class Validation
```typescript
// Check against Tailwind's class list
const validClasses = new Set([...tailwindClasses]);
function validateTailwindClasses(html: string): string[] {
  // Extract classes, check validity
}
```

### 3. Import Validation
```typescript
// Ensure all imports resolve
function validateImports(files: File[], packages: string[]): string[] {
  // Check imports exist in files or packages
}
```

## Project Structure Template

```
{projectPath}/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── public/
│   └── (assets from asset downloader)
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/
    │   └── (AI-generated components)
    ├── pages/
    │   └── (AI-generated pages)
    └── lib/
        └── (utilities)
```

## Package.json Generation

Use dependencies from:
1. GenerationResult.packages (detected by AI)
2. Fixed dependencies (vite, react, typescript, tailwind)

```json
{
  "name": "crayon-sandbox",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.0",
    "vite": "^7.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

## Testing Requirements

### Unit Tests
- Test TypeScript validation catches syntax errors
- Test Tailwind class validation detects invalid classes
- Test import validation finds missing dependencies
- Test project structure creation

### Integration Tests
- Receive AI-generated code → write to disk
- Run `npm install` → succeeds
- Run `npm run build` → compiles without errors
- Generated app is runnable via `npm run dev`

## Definition of Done

- [ ] Validates TypeScript/JSX correctly
- [ ] Validates Tailwind classes
- [ ] Creates proper Vite project structure
- [ ] Generated project compiles successfully
- [ ] Integration test with real AI output produces working app
- [ ] Build errors are caught and reported
