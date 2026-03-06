import { describe, expect, it } from "vitest";
import { detect } from "./widget-detector.js";
import type { DOMSnapshot } from "@crayon/types";

function createSnapshot(html: string): DOMSnapshot {
  return {
    id: "test-snapshot",
    timestamp: Date.now(),
    url: "https://example.com",
    type: "full",
    html,
    viewport: { width: 1920, height: 1080 },
  };
}

describe("detect", () => {
  describe("Google OAuth detection", () => {
    it("detects Google OAuth via data-client_id attribute", () => {
      const snapshot = createSnapshot(
        '<div data-client_id="123456.apps.googleusercontent.com"></div>'
      );
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("oauth-google");
      expect(result[0].provider).toBe("google");
      expect(result[0].selector).toContain("[data-client_id]");
    });

    it("detects Google OAuth via accounts.google.com script", () => {
      const snapshot = createSnapshot(
        '<script src="https://accounts.google.com/gsi/client"></script>'
      );
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("oauth-google");
      expect(result[0].provider).toBe("google");
    });

    it("detects Google OAuth via g_id_signin class", () => {
      const snapshot = createSnapshot('<div class="g_id_signin"></div>');
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("oauth-google");
    });
  });

  describe("Stripe detection", () => {
    it("detects Stripe via StripeElement class", () => {
      const snapshot = createSnapshot('<div class="StripeElement"></div>');
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("stripe");
      expect(result[0].provider).toBe("stripe");
      expect(result[0].selector).toBe(".StripeElement");
    });

    it("detects Stripe via js.stripe.com script", () => {
      const snapshot = createSnapshot('<script src="https://js.stripe.com/v3/"></script>');
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("stripe");
      expect(result[0].provider).toBe("stripe");
    });

    it("detects Stripe with additional classes on element", () => {
      const snapshot = createSnapshot('<div class="payment-form StripeElement loaded"></div>');
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("stripe");
    });
  });

  describe("Google Maps detection", () => {
    it("detects Google Maps via gm-style class", () => {
      const snapshot = createSnapshot('<div class="gm-style"></div>');
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("maps");
      expect(result[0].provider).toBe("google");
      expect(result[0].selector).toBe(".gm-style");
    });

    it("detects Google Maps via maps.googleapis.com script", () => {
      const snapshot = createSnapshot(
        '<script src="https://maps.googleapis.com/maps/api/js?key=ABC123"></script>'
      );
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("maps");
      expect(result[0].provider).toBe("google");
    });
  });

  describe("reCAPTCHA detection", () => {
    it("detects reCAPTCHA via g-recaptcha class", () => {
      const snapshot = createSnapshot('<div class="g-recaptcha"></div>');
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("recaptcha");
      expect(result[0].provider).toBe("google");
      expect(result[0].selector).toContain(".g-recaptcha");
    });

    it("detects reCAPTCHA via data-sitekey attribute", () => {
      const snapshot = createSnapshot(
        '<div class="g-recaptcha" data-sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"></div>'
      );
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("recaptcha");
    });

    it("detects reCAPTCHA via recaptcha script", () => {
      const snapshot = createSnapshot(
        '<script src="https://www.google.com/recaptcha/api.js"></script>'
      );
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("recaptcha");
    });
  });

  describe("multiple widgets", () => {
    it("detects multiple different widgets in same DOM", () => {
      const snapshot = createSnapshot(`
        <html>
          <head>
            <script src="https://js.stripe.com/v3/"></script>
            <script src="https://www.google.com/recaptcha/api.js"></script>
          </head>
          <body>
            <div class="StripeElement"></div>
            <div class="g-recaptcha" data-sitekey="abc123"></div>
          </body>
        </html>
      `);
      const result = detect([snapshot]);

      expect(result).toHaveLength(2);
      const types = result.map((r) => r.type);
      expect(types).toContain("stripe");
      expect(types).toContain("recaptcha");
    });

    it("detects all four widget types", () => {
      const snapshot = createSnapshot(`
        <html>
          <head>
            <script src="https://accounts.google.com/gsi/client"></script>
            <script src="https://js.stripe.com/v3/"></script>
            <script src="https://maps.googleapis.com/maps/api/js"></script>
            <script src="https://www.google.com/recaptcha/api.js"></script>
          </head>
          <body>
            <div data-client_id="test"></div>
            <div class="StripeElement"></div>
            <div class="gm-style"></div>
            <div class="g-recaptcha"></div>
          </body>
        </html>
      `);
      const result = detect([snapshot]);

      expect(result).toHaveLength(4);
      const types = result.map((r) => r.type);
      expect(types).toContain("oauth-google");
      expect(types).toContain("stripe");
      expect(types).toContain("maps");
      expect(types).toContain("recaptcha");
    });
  });

  describe("multiple snapshots", () => {
    it("aggregates widgets across multiple snapshots", () => {
      const snapshot1 = createSnapshot('<div class="StripeElement"></div>');
      const snapshot2 = createSnapshot('<div class="g-recaptcha"></div>');
      const result = detect([snapshot1, snapshot2]);

      expect(result).toHaveLength(2);
      const types = result.map((r) => r.type);
      expect(types).toContain("stripe");
      expect(types).toContain("recaptcha");
    });

    it("deduplicates same widget across snapshots", () => {
      const snapshot1 = createSnapshot('<div class="StripeElement"></div>');
      const snapshot2 = createSnapshot('<div class="StripeElement payment-input"></div>');
      const result = detect([snapshot1, snapshot2]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("stripe");
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty snapshots", () => {
      const result = detect([]);

      expect(result).toHaveLength(0);
    });

    it("returns empty array for plain HTML without widgets", () => {
      const snapshot = createSnapshot("<div><p>Hello World</p></div>");
      const result = detect([snapshot]);

      expect(result).toHaveLength(0);
    });

    it("returns empty array for snapshot without html", () => {
      const snapshot: DOMSnapshot = {
        id: "test",
        timestamp: Date.now(),
        url: "https://example.com",
        type: "diff",
        viewport: { width: 1920, height: 1080 },
      };
      const result = detect([snapshot]);

      expect(result).toHaveLength(0);
    });

    it("returns correct selector for extraction", () => {
      const snapshot = createSnapshot('<div class="StripeElement"></div>');
      const result = detect([snapshot]);

      expect(result[0].selector).toBe(".StripeElement");
    });

    it("handles complex real-world payment form", () => {
      const snapshot = createSnapshot(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>Checkout</title>
            <script src="https://js.stripe.com/v3/"></script>
          </head>
          <body>
            <form id="payment-form">
              <div id="card-element" class="StripeElement StripeElement--empty">
                <div class="__PrivateStripeElement">
                  <iframe name="__privateStripeFrame1234"></iframe>
                </div>
              </div>
              <button type="submit">Pay</button>
            </form>
            <div class="g-recaptcha" data-sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"></div>
          </body>
        </html>
      `);
      const result = detect([snapshot]);

      expect(result.length).toBeGreaterThanOrEqual(2);
      const types = result.map((r) => r.type);
      expect(types).toContain("stripe");
      expect(types).toContain("recaptcha");
    });

    it("handles Google Sign-In button with various configurations", () => {
      const snapshot = createSnapshot(`
        <div id="g_id_onload"
          data-client_id="your-client-id.apps.googleusercontent.com"
          data-login_uri="https://your-domain.com/callback"
          data-auto_prompt="false">
        </div>
        <div class="g_id_signin"
          data-type="standard"
          data-size="large"
          data-theme="outline"
          data-text="sign_in_with"
          data-shape="rectangular"
          data-logo_alignment="left">
        </div>
      `);
      const result = detect([snapshot]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("oauth-google");
      expect(result[0].provider).toBe("google");
    });
  });
});
