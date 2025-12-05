/**
 * Pure utility functions for the Wormhole Web application
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char: string): string => htmlEscapes[char] ?? char);
}

/**
 * Format bytes into human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k: number = 1024;
  const sizes: readonly string[] = ["B", "KB", "MB", "GB"] as const;
  const i: number = Math.floor(Math.log(bytes) / Math.log(k));
  const size: string | undefined = sizes[i];
  if (size === undefined) {
    return "0 B";
  }
  return String(parseFloat((bytes / Math.pow(k, i)).toFixed(1))) + " " + size;
}

/**
 * Encryption marker for identifying encrypted content
 */
export const ENCRYPTION_MARKER: string = "WORMHOLE_ENCRYPTED_V1:";

/**
 * Check if text is encrypted (starts with encryption marker)
 */
export function isEncryptedText(text: string | null): boolean {
  return text?.startsWith(ENCRYPTION_MARKER) ?? false;
}

/**
 * Maximum length for text messages
 */
export const TEXT_MAX_LENGTH: number = 10000;

/**
 * Theme storage key
 */
export const THEME_KEY: string = "wormhole-theme";
