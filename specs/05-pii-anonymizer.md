# PII Anonymizer

Detects and replaces personally identifiable information in captured data.

## Acceptance Criteria

- [ ] Detects emails, phone numbers, SSNs, credit cards
- [ ] Replaces detected PII with realistic fake data
- [ ] Works on DOM text content
- [ ] Works on network response bodies (JSON)
- [ ] Original data is never stored

## Interface

```typescript
// Anonymize a string, returns anonymized version
anonymize(text: string): string

// Anonymize JSON object recursively
anonymizeJson(obj: any): any

// Anonymize DOM HTML
anonymizeDom(html: string): string
```

## Patterns

| Type | Pattern | Replacement |
|------|---------|-------------|
| Email | `*@*.*` | faker.internet.email() |
| Phone | `(xxx) xxx-xxxx` | faker.phone.number() |
| SSN | `xxx-xx-xxxx` | `XXX-XX-XXXX` |
| Credit Card | `xxxx-xxxx-xxxx-xxxx` | `XXXX-XXXX-XXXX-XXXX` |

## Definition of Done

1. Unit tests for each PII pattern
2. Test: input with email → output has fake email
3. Test: JSON with nested emails → all replaced
