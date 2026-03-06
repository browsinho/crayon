import { describe, expect, it } from "vitest";
import { anonymize, anonymizeJson, anonymizeDom, hasPii } from "./pii-anonymizer.js";

describe("anonymize", () => {
  describe("email detection", () => {
    it("replaces email addresses with fake emails", () => {
      const input = "Contact me at john.doe@example.com for details";
      const result = anonymize(input);

      expect(result).not.toContain("john.doe@example.com");
      expect(result).toMatch(/Contact me at \w+\d+@[\w.]+\.\w+ for details/);
    });

    it("replaces multiple emails", () => {
      const input = "Email alice@test.com or bob@company.org";
      const result = anonymize(input);

      expect(result).not.toContain("alice@test.com");
      expect(result).not.toContain("bob@company.org");
    });

    it("handles various email formats", () => {
      const emails = [
        "simple@example.com",
        "user.name@domain.org",
        "user+tag@example.co.uk",
        "user123@test.io",
      ];

      for (const email of emails) {
        const result = anonymize(email);
        expect(result).not.toBe(email);
        expect(result).toMatch(/@/);
      }
    });
  });

  describe("phone number detection", () => {
    it("replaces phone numbers with fake phone numbers", () => {
      const input = "Call me at (555) 123-4567";
      const result = anonymize(input);

      expect(result).not.toContain("(555) 123-4567");
      expect(result).toMatch(/Call me at \(\d{3}\) \d{3}-\d{4}/);
    });

    it("handles different phone formats", () => {
      const phones = [
        "(555) 123-4567",
        "555-123-4567",
        "555.123.4567",
        "5551234567",
      ];

      for (const phone of phones) {
        const result = anonymize(`Phone: ${phone}`);
        expect(result).not.toContain(phone);
      }
    });

    it("replaces multiple phone numbers", () => {
      const input = "Home: (555) 111-2222, Work: (555) 333-4444";
      const result = anonymize(input);

      expect(result).not.toContain("(555) 111-2222");
      expect(result).not.toContain("(555) 333-4444");
    });
  });

  describe("SSN detection", () => {
    it("replaces SSNs with masked value", () => {
      const input = "SSN: 123-45-6789";
      const result = anonymize(input);

      expect(result).not.toContain("123-45-6789");
      expect(result).toContain("XXX-XX-XXXX");
    });

    it("replaces multiple SSNs", () => {
      const input = "Primary: 111-22-3333, Secondary: 444-55-6666";
      const result = anonymize(input);

      expect(result).not.toContain("111-22-3333");
      expect(result).not.toContain("444-55-6666");
      expect(result).toMatch(/Primary: XXX-XX-XXXX, Secondary: XXX-XX-XXXX/);
    });
  });

  describe("credit card detection", () => {
    it("replaces credit card numbers with masked value", () => {
      const input = "Card: 1234-5678-9012-3456";
      const result = anonymize(input);

      expect(result).not.toContain("1234-5678-9012-3456");
      expect(result).toContain("XXXX-XXXX-XXXX-XXXX");
    });

    it("handles different credit card formats", () => {
      const cards = [
        "1234-5678-9012-3456",
        "1234 5678 9012 3456",
        "1234567890123456",
      ];

      for (const card of cards) {
        const result = anonymize(`Card: ${card}`);
        expect(result).not.toContain(card);
      }
    });

    it("replaces multiple credit cards", () => {
      const input = "Visa: 1111-2222-3333-4444, MC: 5555-6666-7777-8888";
      const result = anonymize(input);

      expect(result).not.toContain("1111-2222-3333-4444");
      expect(result).not.toContain("5555-6666-7777-8888");
    });
  });

  describe("mixed PII", () => {
    it("replaces all PII types in one string", () => {
      const input = `
        Customer: john@example.com
        Phone: (555) 123-4567
        SSN: 123-45-6789
        Card: 1234-5678-9012-3456
      `;
      const result = anonymize(input);

      expect(result).not.toContain("john@example.com");
      expect(result).not.toContain("(555) 123-4567");
      expect(result).not.toContain("123-45-6789");
      expect(result).not.toContain("1234-5678-9012-3456");
    });

    it("preserves non-PII text", () => {
      const input = "Name: John, Age: 30, City: New York";
      const result = anonymize(input);

      expect(result).toBe(input);
    });
  });
});

describe("anonymizeJson", () => {
  it("anonymizes string values", () => {
    const input = { email: "user@example.com" };
    const result = anonymizeJson(input) as typeof input;

    expect(result.email).not.toBe("user@example.com");
    expect(result.email).toMatch(/@/);
  });

  it("anonymizes nested objects", () => {
    const input = {
      user: {
        contact: {
          email: "nested@example.com",
          phone: "(555) 123-4567",
        },
      },
    };
    const result = anonymizeJson(input) as typeof input;

    expect(result.user.contact.email).not.toBe("nested@example.com");
    expect(result.user.contact.phone).not.toContain("555");
  });

  it("anonymizes arrays", () => {
    const input = {
      emails: ["first@example.com", "second@example.com"],
    };
    const result = anonymizeJson(input) as typeof input;

    expect(result.emails[0]).not.toBe("first@example.com");
    expect(result.emails[1]).not.toBe("second@example.com");
  });

  it("anonymizes arrays of objects", () => {
    const input = [
      { email: "user1@example.com" },
      { email: "user2@example.com" },
    ];
    const result = anonymizeJson(input) as typeof input;

    expect(result[0].email).not.toBe("user1@example.com");
    expect(result[1].email).not.toBe("user2@example.com");
  });

  it("preserves non-string values", () => {
    const input = {
      name: "John",
      age: 30,
      active: true,
      score: null,
    };
    const result = anonymizeJson(input) as typeof input;

    expect(result.name).toBe("John");
    expect(result.age).toBe(30);
    expect(result.active).toBe(true);
    expect(result.score).toBe(null);
  });

  it("handles null and undefined", () => {
    expect(anonymizeJson(null)).toBe(null);
    expect(anonymizeJson(undefined)).toBe(undefined);
  });

  it("handles deeply nested PII", () => {
    const input = {
      level1: {
        level2: {
          level3: {
            ssn: "123-45-6789",
          },
        },
      },
    };
    const result = anonymizeJson(input) as typeof input;

    expect(result.level1.level2.level3.ssn).toBe("XXX-XX-XXXX");
  });

  it("does not modify the original object", () => {
    const input = { email: "original@example.com" };
    anonymizeJson(input);

    expect(input.email).toBe("original@example.com");
  });
});

describe("anonymizeDom", () => {
  it("anonymizes email in HTML text content", () => {
    const input = "<p>Contact: user@example.com</p>";
    const result = anonymizeDom(input);

    expect(result).not.toContain("user@example.com");
    expect(result).toContain("<p>Contact: ");
    expect(result).toContain("</p>");
  });

  it("anonymizes phone numbers in HTML", () => {
    const input = '<span class="phone">(555) 123-4567</span>';
    const result = anonymizeDom(input);

    expect(result).not.toContain("(555) 123-4567");
    expect(result).toContain('<span class="phone">');
    expect(result).toContain("</span>");
  });

  it("anonymizes SSN in HTML", () => {
    const input = "<div>SSN: 123-45-6789</div>";
    const result = anonymizeDom(input);

    expect(result).toContain("XXX-XX-XXXX");
    expect(result).not.toContain("123-45-6789");
  });

  it("anonymizes credit card in HTML", () => {
    const input = "<input value='1234-5678-9012-3456'>";
    const result = anonymizeDom(input);

    expect(result).toContain("XXXX-XXXX-XXXX-XXXX");
    expect(result).not.toContain("1234-5678-9012-3456");
  });

  it("preserves HTML structure", () => {
    const input = `
      <html>
        <body>
          <div class="user-info">
            <span>Email: test@example.com</span>
            <span>Phone: (555) 123-4567</span>
          </div>
        </body>
      </html>
    `;
    const result = anonymizeDom(input);

    expect(result).toContain("<html>");
    expect(result).toContain("<body>");
    expect(result).toContain('<div class="user-info">');
    expect(result).toContain("</html>");
    expect(result).not.toContain("test@example.com");
    expect(result).not.toContain("(555) 123-4567");
  });

  it("handles HTML without PII", () => {
    const input = "<p>Hello World</p>";
    const result = anonymizeDom(input);

    expect(result).toBe(input);
  });
});

describe("hasPii", () => {
  it("returns true for strings with email", () => {
    expect(hasPii("Contact: user@example.com")).toBe(true);
  });

  it("returns true for strings with phone", () => {
    expect(hasPii("Call (555) 123-4567")).toBe(true);
  });

  it("returns true for strings with SSN", () => {
    expect(hasPii("SSN: 123-45-6789")).toBe(true);
  });

  it("returns true for strings with credit card", () => {
    expect(hasPii("Card: 1234-5678-9012-3456")).toBe(true);
  });

  it("returns false for strings without PII", () => {
    expect(hasPii("Hello, World!")).toBe(false);
    expect(hasPii("Name: John, Age: 30")).toBe(false);
  });

  it("works correctly when called multiple times", () => {
    expect(hasPii("user@example.com")).toBe(true);
    expect(hasPii("no pii here")).toBe(false);
    expect(hasPii("another@email.com")).toBe(true);
    expect(hasPii("still no pii")).toBe(false);
  });
});
