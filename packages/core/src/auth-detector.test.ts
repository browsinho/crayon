import { describe, expect, it } from "vitest";
import { detect } from "./auth-detector.js";
import type { DOMSnapshot, NetworkCall } from "@crayon/types";

function createSnapshot(html: string, url = "https://example.com"): DOMSnapshot {
  return {
    id: "test-snapshot",
    timestamp: Date.now(),
    url,
    type: "full",
    html,
    viewport: { width: 1920, height: 1080 },
  };
}

function createNetworkCall(
  url: string,
  headers: Record<string, string> = {},
  method = "GET"
): NetworkCall {
  return {
    id: "test-call",
    timestamp: Date.now(),
    request: {
      method,
      url,
      headers,
    },
    response: {
      status: 200,
      headers: {},
      contentType: "application/json",
    },
  };
}

describe("detect", () => {
  describe("form-based auth detection", () => {
    it("detects form auth via password input field", () => {
      const snapshot = createSnapshot(`
        <form action="/login" method="POST">
          <input type="text" name="email" placeholder="Email" />
          <input type="password" name="password" placeholder="Password" />
          <button type="submit">Login</button>
        </form>
      `);
      const result = detect([snapshot], []);

      expect(result.type).toBe("form");
      expect(result.form).toBeDefined();
      expect(result.form?.passwordField).toBe("password");
      expect(result.form?.usernameField).toBe("email");
    });

    it("detects form auth on login URL", () => {
      const snapshot = createSnapshot(
        `
        <form method="POST">
          <input type="email" name="username" />
          <input type="password" name="pass" />
          <button>Sign In</button>
        </form>
      `,
        "https://example.com/login"
      );
      const result = detect([snapshot], []);

      expect(result.type).toBe("form");
      expect(result.form?.loginUrl).toBe("https://example.com/login");
      expect(result.form?.usernameField).toBe("username");
      expect(result.form?.passwordField).toBe("pass");
    });

    it("detects form auth on signin URL", () => {
      const snapshot = createSnapshot(
        `
        <input type="text" name="user" />
        <input type="password" id="pwd" />
      `,
        "https://example.com/signin"
      );
      const result = detect([snapshot], []);

      expect(result.type).toBe("form");
      expect(result.form?.loginUrl).toContain("signin");
    });

    it("extracts password field from id when name not present", () => {
      const snapshot = createSnapshot(`
        <input type="email" id="email" />
        <input type="password" id="user-password" />
      `);
      const result = detect([snapshot], []);

      expect(result.type).toBe("form");
      expect(result.form?.passwordField).toBe("user-password");
    });

    it("uses login URL from another snapshot if available", () => {
      const homeSnapshot = createSnapshot(
        `<input type="password" name="password" />`,
        "https://example.com/home"
      );
      const loginSnapshot = createSnapshot(`<p>Welcome</p>`, "https://example.com/login");
      const result = detect([homeSnapshot, loginSnapshot], []);

      expect(result.type).toBe("form");
      expect(result.form?.loginUrl).toBe("https://example.com/login");
    });
  });

  describe("OAuth detection", () => {
    it("detects Google OAuth via button text", () => {
      const snapshot = createSnapshot(`
        <button class="google-signin">Sign in with Google</button>
      `);
      const result = detect([snapshot], []);

      expect(result.type).toBe("oauth");
      expect(result.oauth?.provider).toBe("google");
      expect(result.oauth?.buttonSelector).toBeDefined();
    });

    it("detects GitHub OAuth via button text", () => {
      const snapshot = createSnapshot(`
        <a href="/auth/github" class="github-login">Continue with GitHub</a>
      `);
      const result = detect([snapshot], []);

      expect(result.type).toBe("oauth");
      expect(result.oauth?.provider).toBe("github");
    });

    it("detects Facebook OAuth via button text", () => {
      const snapshot = createSnapshot(`
        <button data-provider="facebook">Log in with Facebook</button>
      `);
      const result = detect([snapshot], []);

      expect(result.type).toBe("oauth");
      expect(result.oauth?.provider).toBe("facebook");
    });

    it("detects Google OAuth via accounts.google.com URL pattern", () => {
      const snapshot = createSnapshot(`
        <script src="https://accounts.google.com/gsi/client"></script>
      `);
      const result = detect([snapshot], []);

      expect(result.type).toBe("oauth");
      expect(result.oauth?.provider).toBe("google");
    });

    it("detects Google OAuth from network call to googleapis", () => {
      const snapshot = createSnapshot(`<div>Login Page</div>`);
      const networkCall = createNetworkCall("https://www.googleapis.com/oauth/token");
      const result = detect([snapshot], [networkCall]);

      expect(result.type).toBe("oauth");
      expect(result.oauth?.provider).toBe("google");
    });

    it("detects GitHub OAuth from network call", () => {
      const snapshot = createSnapshot(`<div>Login Page</div>`);
      const networkCall = createNetworkCall("https://github.com/login/oauth/authorize?client_id=abc");
      const result = detect([snapshot], [networkCall]);

      expect(result.type).toBe("oauth");
      expect(result.oauth?.provider).toBe("github");
    });

    it("detects Facebook OAuth from network call", () => {
      const snapshot = createSnapshot(`<div>Login Page</div>`);
      const networkCall = createNetworkCall(
        "https://www.facebook.com/v18.0/dialog/oauth?client_id=xyz"
      );
      const result = detect([snapshot], [networkCall]);

      expect(result.type).toBe("oauth");
      expect(result.oauth?.provider).toBe("facebook");
    });

    it("detects Facebook OAuth via connect.facebook.net", () => {
      const snapshot = createSnapshot(`
        <script src="https://connect.facebook.net/en_US/sdk.js"></script>
      `);
      const result = detect([snapshot], []);

      expect(result.type).toBe("oauth");
      expect(result.oauth?.provider).toBe("facebook");
    });
  });

  describe("token-based auth detection", () => {
    it("detects Bearer token auth from Authorization header", () => {
      const snapshot = createSnapshot(`<div>Dashboard</div>`);
      const networkCall = createNetworkCall("https://api.example.com/users", {
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      });
      const result = detect([snapshot], [networkCall]);

      expect(result.type).toBe("token");
      expect(result.token?.headerName).toBe("Authorization");
      expect(result.token?.storage).toBe("localStorage");
    });

    it("detects token auth with lowercase authorization header", () => {
      const snapshot = createSnapshot(`<div>App</div>`);
      const networkCall = createNetworkCall("https://api.example.com/data", {
        authorization: "Bearer abc123xyz",
      });
      const result = detect([snapshot], [networkCall]);

      expect(result.type).toBe("token");
      expect(result.token?.headerName).toBe("authorization");
    });

    it("prioritizes token auth over form auth", () => {
      const snapshot = createSnapshot(`
        <input type="password" name="password" />
      `);
      const networkCall = createNetworkCall("https://api.example.com/me", {
        Authorization: "Bearer token123",
      });
      const result = detect([snapshot], [networkCall]);

      expect(result.type).toBe("token");
    });

    it("prioritizes token auth over OAuth", () => {
      const snapshot = createSnapshot(`
        <button>Sign in with Google</button>
      `);
      const networkCall = createNetworkCall("https://api.example.com/me", {
        Authorization: "Bearer token123",
      });
      const result = detect([snapshot], [networkCall]);

      expect(result.type).toBe("token");
    });
  });

  describe("no auth detection", () => {
    it("returns none for page without auth signals", () => {
      const snapshot = createSnapshot(`
        <html>
          <body>
            <h1>Welcome to our site</h1>
            <p>This is a public page with no authentication.</p>
          </body>
        </html>
      `);
      const result = detect([snapshot], []);

      expect(result.type).toBe("none");
      expect(result.form).toBeUndefined();
      expect(result.oauth).toBeUndefined();
      expect(result.token).toBeUndefined();
    });

    it("returns none for empty snapshots and network calls", () => {
      const result = detect([], []);

      expect(result.type).toBe("none");
    });

    it("returns none for snapshot without HTML", () => {
      const snapshot: DOMSnapshot = {
        id: "test",
        timestamp: Date.now(),
        url: "https://example.com",
        type: "diff",
        viewport: { width: 1920, height: 1080 },
      };
      const result = detect([snapshot], []);

      expect(result.type).toBe("none");
    });

    it("does not detect auth from non-Bearer authorization", () => {
      const snapshot = createSnapshot(`<div>App</div>`);
      const networkCall = createNetworkCall("https://api.example.com/data", {
        Authorization: "Basic dXNlcjpwYXNz",
      });
      const result = detect([snapshot], [networkCall]);

      expect(result.type).toBe("none");
    });
  });

  describe("multiple snapshots", () => {
    it("detects auth across multiple snapshots", () => {
      const homeSnapshot = createSnapshot(`<h1>Home</h1>`, "https://example.com");
      const loginSnapshot = createSnapshot(
        `
        <input type="email" name="email" />
        <input type="password" name="password" />
      `,
        "https://example.com/login"
      );
      const result = detect([homeSnapshot, loginSnapshot], []);

      expect(result.type).toBe("form");
      expect(result.form?.loginUrl).toBe("https://example.com/login");
    });
  });

  describe("priority order", () => {
    it("returns token over oauth over form", () => {
      // All three auth types present
      const snapshot = createSnapshot(`
        <input type="password" name="password" />
        <button>Sign in with Google</button>
      `);
      const networkCall = createNetworkCall("https://api.example.com/users", {
        Authorization: "Bearer token",
      });
      const result = detect([snapshot], [networkCall]);

      expect(result.type).toBe("token");
    });

    it("returns oauth over form when no token", () => {
      const snapshot = createSnapshot(`
        <input type="password" name="password" />
        <button class="google-btn">Sign in with Google</button>
      `);
      const result = detect([snapshot], []);

      expect(result.type).toBe("oauth");
    });
  });

  describe("real-world scenarios", () => {
    it("detects form auth in typical login page", () => {
      const snapshot = createSnapshot(
        `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="login-container">
              <h1>Sign In</h1>
              <form action="/api/auth/login" method="POST">
                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" required />
                </div>
                <div class="form-group">
                  <label for="password">Password</label>
                  <input type="password" id="password" name="password" required />
                </div>
                <button type="submit">Sign In</button>
              </form>
            </div>
          </body>
        </html>
      `,
        "https://app.example.com/login"
      );
      const result = detect([snapshot], []);

      expect(result.type).toBe("form");
      expect(result.form?.loginUrl).toBe("https://app.example.com/login");
      expect(result.form?.usernameField).toBe("email");
      expect(result.form?.passwordField).toBe("password");
    });

    it("detects OAuth in modern SaaS login page", () => {
      const snapshot = createSnapshot(`
        <!DOCTYPE html>
        <html>
          <body>
            <div class="auth-page">
              <h1>Welcome Back</h1>
              <div class="social-login">
                <button class="google-signin-btn">
                  <img src="google-icon.svg" />
                  Continue with Google
                </button>
                <button class="github-signin-btn">
                  <img src="github-icon.svg" />
                  Continue with GitHub
                </button>
              </div>
              <div class="divider">or</div>
              <form>
                <input type="email" name="email" />
                <input type="password" name="password" />
                <button type="submit">Sign In</button>
              </form>
            </div>
          </body>
        </html>
      `);
      const result = detect([snapshot], []);

      // OAuth is detected first due to priority, but form would also be present
      expect(result.type).toBe("oauth");
      expect(result.oauth?.provider).toBe("google");
    });

    it("detects token auth in API-driven SPA", () => {
      const snapshot = createSnapshot(`
        <div id="app">
          <nav>Dashboard</nav>
          <main>User data loaded...</main>
        </div>
      `);
      const networkCalls = [
        createNetworkCall("https://api.example.com/users/me", {
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
          "Content-Type": "application/json",
        }),
        createNetworkCall("https://api.example.com/dashboard", {
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
        }),
      ];
      const result = detect([snapshot], networkCalls);

      expect(result.type).toBe("token");
      expect(result.token?.headerName).toBe("Authorization");
      expect(result.token?.storage).toBe("localStorage");
    });
  });
});
