import { describe, expect, test } from "bun:test";
import {
  escapeHtml,
  formatBytes,
  isEncryptedText,
  ENCRYPTION_MARKER,
  TEXT_MAX_LENGTH,
  THEME_KEY,
} from "./utils";

describe("escapeHtml", (): void => {
  test("escapes ampersand", (): void => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  test("escapes less than", (): void => {
    expect(escapeHtml("foo < bar")).toBe("foo &lt; bar");
  });

  test("escapes greater than", (): void => {
    expect(escapeHtml("foo > bar")).toBe("foo &gt; bar");
  });

  test("escapes double quotes", (): void => {
    expect(escapeHtml('foo "bar"')).toBe("foo &quot;bar&quot;");
  });

  test("escapes single quotes", (): void => {
    expect(escapeHtml("foo 'bar'")).toBe("foo &#39;bar&#39;");
  });

  test("escapes multiple special characters", (): void => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });

  test("returns empty string for empty input", (): void => {
    expect(escapeHtml("")).toBe("");
  });

  test("returns unchanged string without special characters", (): void => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });
});

describe("formatBytes", (): void => {
  test("formats 0 bytes", (): void => {
    expect(formatBytes(0)).toBe("0 B");
  });

  test("formats bytes under 1KB", (): void => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1)).toBe("1 B");
  });

  test("formats kilobytes", (): void => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2048)).toBe("2 KB");
  });

  test("formats megabytes", (): void => {
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
    expect(formatBytes(10485760)).toBe("10 MB");
  });

  test("formats gigabytes", (): void => {
    expect(formatBytes(1073741824)).toBe("1 GB");
    expect(formatBytes(2147483648)).toBe("2 GB");
  });

  test("handles decimal precision", (): void => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1331)).toBe("1.3 KB");
  });
});

describe("isEncryptedText", (): void => {
  test("returns true for encrypted text", (): void => {
    expect(isEncryptedText(ENCRYPTION_MARKER + "somebase64data")).toBe(true);
  });

  test("returns false for plain text", (): void => {
    expect(isEncryptedText("hello world")).toBe(false);
  });

  test("returns false for null", (): void => {
    expect(isEncryptedText(null)).toBe(false);
  });

  test("returns false for empty string", (): void => {
    expect(isEncryptedText("")).toBe(false);
  });

  test("returns false for partial marker", (): void => {
    expect(isEncryptedText("WORMHOLE_ENCRYPTED")).toBe(false);
  });
});

describe("constants", (): void => {
  test("ENCRYPTION_MARKER is correct", (): void => {
    expect(ENCRYPTION_MARKER).toBe("WORMHOLE_ENCRYPTED_V1:");
  });

  test("TEXT_MAX_LENGTH is 10000", (): void => {
    expect(TEXT_MAX_LENGTH).toBe(10000);
  });

  test("THEME_KEY is correct", (): void => {
    expect(THEME_KEY).toBe("wormhole-theme");
  });
});
