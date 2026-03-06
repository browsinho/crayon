/**
 * PII Anonymizer - Detects and replaces personally identifiable information
 *
 * Supports detection and anonymization of:
 * - Email addresses
 * - Phone numbers (US format)
 * - Social Security Numbers (SSN)
 * - Credit card numbers
 */

// PII patterns
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const SSN_PATTERN = /\d{3}-\d{2}-\d{4}/g;
const CREDIT_CARD_PATTERN = /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g;

// Fake data generators for consistent replacements
const FAKE_DOMAINS = ["example.com", "test.org", "sample.net", "demo.io"];
const FAKE_FIRST_NAMES = ["john", "jane", "alex", "sam", "chris", "taylor"];

function generateFakeEmail(): string {
  const firstName = FAKE_FIRST_NAMES[Math.floor(Math.random() * FAKE_FIRST_NAMES.length)];
  const domain = FAKE_DOMAINS[Math.floor(Math.random() * FAKE_DOMAINS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${firstName}${num}@${domain}`;
}

function generateFakePhone(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `(${areaCode}) ${exchange}-${subscriber}`;
}

function generateFakeSSN(): string {
  return "XXX-XX-XXXX";
}

function generateFakeCreditCard(): string {
  return "XXXX-XXXX-XXXX-XXXX";
}

/**
 * Anonymize a string by replacing detected PII with fake data
 *
 * @param text - The input text to anonymize
 * @returns The anonymized text with PII replaced
 */
export function anonymize(text: string): string {
  let result = text;

  // Replace credit cards first (longer patterns to avoid conflicts)
  result = result.replace(CREDIT_CARD_PATTERN, generateFakeCreditCard);

  // Replace SSNs
  result = result.replace(SSN_PATTERN, generateFakeSSN);

  // Replace phone numbers
  result = result.replace(PHONE_PATTERN, generateFakePhone);

  // Replace emails
  result = result.replace(EMAIL_PATTERN, generateFakeEmail);

  return result;
}

/**
 * Recursively anonymize all string values in a JSON object
 *
 * @param obj - The input object to anonymize
 * @returns A new object with all string values anonymized
 */
export function anonymizeJson(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return anonymize(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => anonymizeJson(item));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = anonymizeJson(value);
    }
    return result;
  }

  // Return primitives (numbers, booleans) as-is
  return obj;
}

/**
 * Anonymize PII in DOM HTML content
 *
 * This function anonymizes text content within HTML while preserving
 * the HTML structure and tags.
 *
 * @param html - The HTML string to anonymize
 * @returns The anonymized HTML string
 */
export function anonymizeDom(html: string): string {
  // Process the HTML as text - the patterns will match PII in text content
  // This approach preserves HTML structure while anonymizing text
  return anonymize(html);
}

/**
 * Check if a string contains any detectable PII
 *
 * @param text - The text to check
 * @returns True if PII is detected, false otherwise
 */
export function containsPii(text: string): boolean {
  return (
    EMAIL_PATTERN.test(text) ||
    PHONE_PATTERN.test(text) ||
    SSN_PATTERN.test(text) ||
    CREDIT_CARD_PATTERN.test(text)
  );
}

// Reset regex lastIndex after test() calls
function resetPatterns(): void {
  EMAIL_PATTERN.lastIndex = 0;
  PHONE_PATTERN.lastIndex = 0;
  SSN_PATTERN.lastIndex = 0;
  CREDIT_CARD_PATTERN.lastIndex = 0;
}

// Export a helper to check for PII with proper regex reset
export function hasPii(text: string): boolean {
  resetPatterns();
  const result = containsPii(text);
  resetPatterns();
  return result;
}
