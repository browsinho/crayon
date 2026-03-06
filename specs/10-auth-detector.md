# Auth Detector

Detects authentication mechanism used by the recorded website.

## Acceptance Criteria

- [ ] Detects form-based login (username/password fields)
- [ ] Detects OAuth buttons (Google, GitHub, etc.)
- [ ] Detects token-based auth (Authorization header)
- [ ] Identifies protected routes (redirects to login)

## Interface

```typescript
interface AuthInfo {
  type: 'form' | 'oauth' | 'token' | 'none';
  form?: {
    loginUrl: string;
    usernameField: string;
    passwordField: string;
  };
  oauth?: {
    provider: 'google' | 'github' | 'facebook';
    buttonSelector: string;
  };
  token?: {
    headerName: string;
    storage: 'localStorage' | 'cookie';
  };
}

// Detect auth from recording
detect(dom: DOMSnapshot[], network: NetworkCall[]): AuthInfo
```

## Detection Signals

| Type | Signals |
|------|---------|
| form | `<input type="password">`, `/login` URL |
| oauth | Google/GitHub button, OAuth redirect |
| token | `Authorization: Bearer` header |

## Definition of Done

1. Unit tests for each auth type
2. Test: page with login form → detects form auth
3. Test: API with Bearer token → detects token auth
