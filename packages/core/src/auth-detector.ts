/**
 * Auth Detector - Detects authentication mechanisms from recorded sessions
 *
 * Detects:
 * - Form-based login (username/password fields, /login URL)
 * - OAuth buttons (Google, GitHub, Facebook)
 * - Token-based auth (Authorization: Bearer header)
 * - Returns 'none' if no authentication detected
 */

import type {
  AuthInfo,
  AuthType,
  DOMSnapshot,
  FormAuth,
  NetworkCall,
  OAuthInfo,
  OAuthProvider,
  TokenAuth,
  TokenStorage,
} from "@crayon/types";

// Form login detection patterns
const LOGIN_URL_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/sign-in/i,
  /\/authenticate/i,
  /\/auth$/i,
];

const PASSWORD_INPUT_PATTERN = /<input[^>]*type\s*=\s*["']password["'][^>]*>/gi;
const USERNAME_INPUT_PATTERNS = [
  /<input[^>]*(?:type\s*=\s*["'](?:text|email)["'][^>]*(?:name|id)\s*=\s*["'](?:username|email|user|login|user_login|user_email)[^"']*["']|(?:name|id)\s*=\s*["'](?:username|email|user|login|user_login|user_email)[^"']*["'][^>]*type\s*=\s*["'](?:text|email)["'])[^>]*>/gi,
  /<input[^>]*(?:name|id)\s*=\s*["'](?:username|email|user|login|user_login|user_email)[^"']*["'][^>]*>/gi,
];

// OAuth detection patterns
const OAUTH_PATTERNS: Record<OAuthProvider, RegExp[]> = {
  google: [
    /(?:sign\s*in|log\s*in|continue)\s*with\s*google/i,
    /google\s*(?:sign\s*in|login|oauth)/i,
    /accounts\.google\.com/i,
    /googleapis\.com\/oauth/i,
    /class\s*=\s*["'][^"']*google[^"']*["']/i,
  ],
  github: [
    /(?:sign\s*in|log\s*in|continue)\s*with\s*github/i,
    /github\s*(?:sign\s*in|login|oauth)/i,
    /github\.com\/login\/oauth/i,
    /class\s*=\s*["'][^"']*github[^"']*["']/i,
  ],
  facebook: [
    /(?:sign\s*in|log\s*in|continue)\s*with\s*facebook/i,
    /facebook\s*(?:sign\s*in|login|oauth)/i,
    /facebook\.com\/v\d+\.?\d*\/dialog\/oauth/i,
    /connect\.facebook\.net/i,
    /class\s*=\s*["'][^"']*facebook[^"']*["']/i,
  ],
};

// Token auth detection patterns
const AUTHORIZATION_HEADER_PATTERN = /^authorization$/i;
const BEARER_TOKEN_PATTERN = /^Bearer\s+/i;

// OAuth button selector patterns
const OAUTH_BUTTON_SELECTORS: Record<OAuthProvider, string[]> = {
  google: [
    'button[class*="google"]',
    'a[class*="google"]',
    '[data-provider="google"]',
    '[aria-label*="Google"]',
  ],
  github: [
    'button[class*="github"]',
    'a[class*="github"]',
    '[data-provider="github"]',
    '[aria-label*="GitHub"]',
  ],
  facebook: [
    'button[class*="facebook"]',
    'a[class*="facebook"]',
    '[data-provider="facebook"]',
    '[aria-label*="Facebook"]',
  ],
};

interface FormDetectionResult {
  detected: boolean;
  loginUrl?: string;
  usernameField?: string;
  passwordField?: string;
}

interface OAuthDetectionResult {
  detected: boolean;
  provider?: OAuthProvider;
  buttonSelector?: string;
}

interface TokenDetectionResult {
  detected: boolean;
  headerName?: string;
  storage?: TokenStorage;
}

/**
 * Extract field name from an input element HTML string
 */
function extractFieldName(inputHtml: string): string {
  // Try to extract name attribute
  const nameMatch = inputHtml.match(/name\s*=\s*["']([^"']+)["']/i);
  if (nameMatch) {
    return nameMatch[1];
  }

  // Fall back to id attribute
  const idMatch = inputHtml.match(/id\s*=\s*["']([^"']+)["']/i);
  if (idMatch) {
    return idMatch[1];
  }

  return "password";
}

/**
 * Detect form-based authentication from DOM snapshots
 */
function detectFormAuth(snapshots: DOMSnapshot[]): FormDetectionResult {
  for (const snapshot of snapshots) {
    const html = snapshot.html ?? "";

    // Check for password input field
    const passwordMatches = html.match(PASSWORD_INPUT_PATTERN);
    if (!passwordMatches || passwordMatches.length === 0) {
      continue;
    }

    const passwordField = extractFieldName(passwordMatches[0]);

    // Check for username/email field
    let usernameField = "username";
    for (const pattern of USERNAME_INPUT_PATTERNS) {
      const usernameMatches = html.match(pattern);
      if (usernameMatches && usernameMatches.length > 0) {
        usernameField = extractFieldName(usernameMatches[0]);
        break;
      }
    }

    // Check if the URL looks like a login page
    let loginUrl = snapshot.url;
    const isLoginUrl = LOGIN_URL_PATTERNS.some((pattern) => pattern.test(snapshot.url));

    if (!isLoginUrl) {
      // Still detect form auth even if URL doesn't look like login
      // but prefer login URLs when available
      for (const snap of snapshots) {
        if (LOGIN_URL_PATTERNS.some((pattern) => pattern.test(snap.url))) {
          loginUrl = snap.url;
          break;
        }
      }
    }

    return {
      detected: true,
      loginUrl,
      usernameField,
      passwordField,
    };
  }

  return { detected: false };
}

/**
 * Detect OAuth authentication from DOM snapshots and network calls
 */
function detectOAuth(snapshots: DOMSnapshot[], network: NetworkCall[]): OAuthDetectionResult {
  // Check DOM for OAuth buttons/links
  for (const snapshot of snapshots) {
    const html = snapshot.html ?? "";

    for (const [provider, patterns] of Object.entries(OAUTH_PATTERNS) as [
      OAuthProvider,
      RegExp[],
    ][]) {
      for (const pattern of patterns) {
        if (pattern.test(html)) {
          // Find the best button selector for this provider
          const selectors = OAUTH_BUTTON_SELECTORS[provider];
          let buttonSelector = selectors[0]; // Default selector

          // Try to find a matching selector in the HTML
          for (const selector of selectors) {
            // Convert selector to a simple pattern check
            const selectorPattern = selector
              .replace(/\[/g, "\\[")
              .replace(/\]/g, "\\]")
              .replace(/\*/g, ".*")
              .replace(/"/g, '"');

            if (new RegExp(selectorPattern, "i").test(html)) {
              buttonSelector = selector;
              break;
            }
          }

          return {
            detected: true,
            provider,
            buttonSelector,
          };
        }
      }
    }
  }

  // Check network calls for OAuth redirects
  for (const call of network) {
    const url = call.request.url;

    if (/accounts\.google\.com/.test(url) || /googleapis\.com\/oauth/.test(url)) {
      return {
        detected: true,
        provider: "google",
        buttonSelector: OAUTH_BUTTON_SELECTORS.google[0],
      };
    }

    if (/github\.com\/login\/oauth/.test(url)) {
      return {
        detected: true,
        provider: "github",
        buttonSelector: OAUTH_BUTTON_SELECTORS.github[0],
      };
    }

    if (/facebook\.com.*\/dialog\/oauth/.test(url) || /connect\.facebook\.net/.test(url)) {
      return {
        detected: true,
        provider: "facebook",
        buttonSelector: OAUTH_BUTTON_SELECTORS.facebook[0],
      };
    }
  }

  return { detected: false };
}

/**
 * Detect token-based authentication from network calls
 */
function detectTokenAuth(network: NetworkCall[]): TokenDetectionResult {
  for (const call of network) {
    const headers = call.request.headers;

    for (const [headerName, headerValue] of Object.entries(headers)) {
      if (AUTHORIZATION_HEADER_PATTERN.test(headerName)) {
        if (BEARER_TOKEN_PATTERN.test(headerValue)) {
          // Determine storage type - we can infer localStorage if the token
          // appears consistently across requests, otherwise assume cookie
          const storage: TokenStorage = "localStorage";

          return {
            detected: true,
            headerName,
            storage,
          };
        }
      }
    }
  }

  return { detected: false };
}

/**
 * Detect authentication mechanism used by the recorded website
 *
 * @param dom - Array of DOM snapshots to analyze
 * @param network - Array of network calls to analyze
 * @returns AuthInfo with detected auth type and details
 */
export function detect(dom: DOMSnapshot[], network: NetworkCall[]): AuthInfo {
  // Priority: token > oauth > form > none
  // Token auth is checked first as it's the most concrete signal

  // Check for token-based auth (Authorization: Bearer header)
  const tokenResult = detectTokenAuth(network);
  if (tokenResult.detected) {
    const token: TokenAuth = {
      headerName: tokenResult.headerName!,
      storage: tokenResult.storage!,
    };
    return {
      type: "token" as AuthType,
      token,
    };
  }

  // Check for OAuth buttons/redirects
  const oauthResult = detectOAuth(dom, network);
  if (oauthResult.detected) {
    const oauth: OAuthInfo = {
      provider: oauthResult.provider!,
      buttonSelector: oauthResult.buttonSelector!,
    };
    return {
      type: "oauth" as AuthType,
      oauth,
    };
  }

  // Check for form-based login
  const formResult = detectFormAuth(dom);
  if (formResult.detected) {
    const form: FormAuth = {
      loginUrl: formResult.loginUrl!,
      usernameField: formResult.usernameField!,
      passwordField: formResult.passwordField!,
    };
    return {
      type: "form" as AuthType,
      form,
    };
  }

  // No authentication detected
  return {
    type: "none" as AuthType,
  };
}
