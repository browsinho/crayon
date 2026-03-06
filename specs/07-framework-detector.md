# Framework Detector

Analyzes recorded DOM to detect frontend framework used by the website.

## Acceptance Criteria

- [ ] Detects React (data-reactroot, __REACT_DEVTOOLS_GLOBAL_HOOK__)
- [ ] Detects Vue (__vue__, data-v-*)
- [ ] Detects Angular (ng-version, _nghost)
- [ ] Returns 'vanilla' if no framework detected
- [ ] Returns confidence score (0-1)

## Interface

```typescript
interface FrameworkInfo {
  framework: 'react' | 'vue' | 'angular' | 'vanilla';
  confidence: number;
  signals: string[];  // what was detected
}

// Analyze DOM snapshots
detect(snapshots: DOMSnapshot[]): FrameworkInfo
```

## Detection Signals

| Framework | Signals |
|-----------|---------|
| React | `data-reactroot`, `data-reactid`, `_reactRootContainer` |
| Vue | `data-v-`, `__vue__`, `Vue.config` |
| Angular | `ng-version`, `_nghost-`, `_ngcontent-` |

## Definition of Done

1. Unit tests for each framework detection
2. Test: React page DOM → detects React with >0.8 confidence
3. Test: plain HTML → returns vanilla
