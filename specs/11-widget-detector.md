# Widget Detector

Detects third-party widgets in recorded DOM that need mocking.

## Acceptance Criteria

- [ ] Detects Google OAuth buttons
- [ ] Detects Stripe payment elements
- [ ] Detects Google Maps embeds
- [ ] Detects reCAPTCHA
- [ ] Returns selector for each widget

## Interface

```typescript
interface WidgetInfo {
  type: 'oauth-google' | 'stripe' | 'maps' | 'recaptcha';
  selector: string;
  provider: string;
}

// Detect widgets from DOM
detect(snapshots: DOMSnapshot[]): WidgetInfo[]
```

## Detection Patterns

| Widget | Selectors/Scripts |
|--------|-------------------|
| Google OAuth | `[data-client_id]`, `accounts.google.com` |
| Stripe | `.StripeElement`, `js.stripe.com` |
| Maps | `.gm-style`, `maps.googleapis.com` |
| reCAPTCHA | `.g-recaptcha`, `recaptcha` |

## Definition of Done

1. Unit tests for each widget type
2. Test: DOM with Stripe element → detects stripe widget
3. Returns correct selector for extraction
