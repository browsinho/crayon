# Asset Downloader

Downloads and localizes assets from recorded websites.

## Acceptance Criteria

- [ ] Downloads images referenced in DOM
- [ ] Downloads fonts referenced in CSS
- [ ] Downloads CSS files
- [ ] Rewrites URLs in HTML/CSS to local paths
- [ ] Respects size limits (10MB per file, 100MB total)

## Interface

```typescript
interface AssetManifest {
  assets: {
    originalUrl: string;
    localPath: string;
    type: 'image' | 'font' | 'css';
    size: number;
  }[];
  totalSize: number;
}

// Download assets from recording
download(
  snapshots: DOMSnapshot[],
  outputDir: string
): Promise<AssetManifest>

// Rewrite URLs in HTML
rewriteUrls(html: string, manifest: AssetManifest): string
```

## Output Structure

```
assets/
├── images/
│   └── logo.png
├── fonts/
│   └── inter.woff2
└── styles/
    └── main.css
```

## Definition of Done

1. Assets downloaded to correct directories
2. URL rewriting works (old URLs → local paths)
3. Size limits enforced
