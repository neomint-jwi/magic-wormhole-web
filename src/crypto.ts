/**
 * Encryption utilities using AES-256-GCM
 */

import { ENCRYPTION_MARKER } from "./utils";

/**
 * File metadata for encrypted files
 */
export interface FileMetadata {
  readonly name: string;
  readonly type: string;
}

/**
 * Derive an AES-256 key from a password using PBKDF2
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc: TextEncoder = new TextEncoder();
  const keyMaterial: CryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt raw data with AES-256-GCM
 * Returns: salt (16 bytes) + iv (12 bytes) + ciphertext
 */
export async function encryptData(
  data: Uint8Array,
  password: string
): Promise<Uint8Array> {
  const salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16));
  const iv: Uint8Array = crypto.getRandomValues(new Uint8Array(12));
  const key: CryptoKey = await deriveKey(password, salt);

  const encrypted: ArrayBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );

  const result: Uint8Array = new Uint8Array(
    salt.length + iv.length + encrypted.byteLength
  );
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);
  return result;
}

/**
 * Decrypt data encrypted with encryptData
 */
export async function decryptData(
  encryptedData: Uint8Array,
  password: string
): Promise<Uint8Array> {
  const salt: Uint8Array = encryptedData.slice(0, 16);
  const iv: Uint8Array = encryptedData.slice(16, 28);
  const data: Uint8Array = encryptedData.slice(28);

  const key: CryptoKey = await deriveKey(password, salt);

  const decrypted: ArrayBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );
  return new Uint8Array(decrypted);
}

/**
 * Encrypt text and return base64-encoded string with marker
 */
export async function encryptText(
  text: string,
  password: string
): Promise<string> {
  const enc: TextEncoder = new TextEncoder();
  const encrypted: Uint8Array = await encryptData(enc.encode(text), password);
  return ENCRYPTION_MARKER + btoa(String.fromCharCode(...encrypted));
}

/**
 * Decrypt text encrypted with encryptText
 */
export async function decryptText(
  encryptedText: string,
  password: string
): Promise<string> {
  if (!encryptedText.startsWith(ENCRYPTION_MARKER)) {
    throw new Error("Not encrypted");
  }
  const base64: string = encryptedText.slice(ENCRYPTION_MARKER.length);
  const encrypted: Uint8Array = Uint8Array.from(
    atob(base64),
    (c: string): number => c.charCodeAt(0)
  );
  const decrypted: Uint8Array = await decryptData(encrypted, password);
  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt a file with metadata
 * Format: metadataLength (4 bytes) + metadata (JSON) + encrypted file content
 */
export async function encryptFile(file: File, password: string): Promise<File> {
  const arrayBuffer: ArrayBuffer = await file.arrayBuffer();
  const encrypted: Uint8Array = await encryptData(
    new Uint8Array(arrayBuffer),
    password
  );

  const metadata: FileMetadata = { name: file.name, type: file.type };
  const metaBytes: Uint8Array = new TextEncoder().encode(
    JSON.stringify(metadata)
  );
  const metaLen: Uint32Array = new Uint32Array([metaBytes.length]);

  const result: Uint8Array = new Uint8Array(
    4 + metaBytes.length + encrypted.length
  );
  result.set(new Uint8Array(metaLen.buffer), 0);
  result.set(metaBytes, 4);
  result.set(encrypted, 4 + metaBytes.length);

  return new File([result.buffer as ArrayBuffer], file.name + ".encrypted", {
    type: "application/octet-stream",
  });
}

/**
 * Decrypt a file encrypted with encryptFile
 */
export async function decryptFile(
  encryptedFile: File,
  password: string
): Promise<File> {
  const arrayBuffer: ArrayBuffer = await encryptedFile.arrayBuffer();
  const data: Uint8Array = new Uint8Array(arrayBuffer);

  const metaLenArray: Uint32Array = new Uint32Array(data.slice(0, 4).buffer);
  const metaLen: number | undefined = metaLenArray[0];
  if (metaLen === undefined) {
    throw new Error("Invalid encrypted file format");
  }

  const metaBytes: Uint8Array = data.slice(4, 4 + metaLen);
  const metadata: FileMetadata = JSON.parse(
    new TextDecoder().decode(metaBytes)
  ) as FileMetadata;

  const encrypted: Uint8Array = data.slice(4 + metaLen);
  const decrypted: Uint8Array = await decryptData(encrypted, password);

  return new File([decrypted.buffer as ArrayBuffer], metadata.name, {
    type: metadata.type,
  });
}
