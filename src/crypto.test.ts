import { describe, expect, test } from "bun:test";
import {
  encryptData,
  decryptData,
  encryptText,
  decryptText,
  encryptFile,
  decryptFile,
} from "./crypto";
import { ENCRYPTION_MARKER } from "./utils";

describe("encryptData and decryptData", (): void => {
  test("encrypts and decrypts data correctly", async (): Promise<void> => {
    const originalData: Uint8Array = new TextEncoder().encode("Hello, World!");
    const password: string = "testpassword123";

    const encrypted: Uint8Array = await encryptData(originalData, password);
    const decrypted: Uint8Array = await decryptData(encrypted, password);

    expect(new TextDecoder().decode(decrypted)).toBe("Hello, World!");
  });

  test("encrypted data is different from original", async (): Promise<void> => {
    const originalData: Uint8Array = new TextEncoder().encode("Secret message");
    const password: string = "mypassword";

    const encrypted: Uint8Array = await encryptData(originalData, password);

    expect(encrypted.length).toBeGreaterThan(originalData.length);
    expect(new TextDecoder().decode(encrypted)).not.toBe("Secret message");
  });

  test("encrypting same data twice produces different results", async (): Promise<void> => {
    const originalData: Uint8Array = new TextEncoder().encode("Same data");
    const password: string = "password";

    const encrypted1: Uint8Array = await encryptData(originalData, password);
    const encrypted2: Uint8Array = await encryptData(originalData, password);

    // Due to random IV and salt, results should differ
    expect(encrypted1).not.toEqual(encrypted2);
  });

  test("decryption fails with wrong password", async (): Promise<void> => {
    const originalData: Uint8Array = new TextEncoder().encode("Sensitive data");
    const correctPassword: string = "correct";
    const wrongPassword: string = "wrong";

    const encrypted: Uint8Array = await encryptData(
      originalData,
      correctPassword
    );

    let threw: boolean = false;
    try {
      await decryptData(encrypted, wrongPassword);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test("handles empty data", async (): Promise<void> => {
    const emptyData: Uint8Array = new Uint8Array(0);
    const password: string = "password";

    const encrypted: Uint8Array = await encryptData(emptyData, password);
    const decrypted: Uint8Array = await decryptData(encrypted, password);

    expect(decrypted.length).toBe(0);
  });

  test("handles large data", async (): Promise<void> => {
    const largeData: Uint8Array = new Uint8Array(100000);
    for (let i: number = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }
    const password: string = "password";

    const encrypted: Uint8Array = await encryptData(largeData, password);
    const decrypted: Uint8Array = await decryptData(encrypted, password);

    expect(decrypted).toEqual(largeData);
  });
});

describe("encryptText and decryptText", (): void => {
  test("encrypts and decrypts text correctly", async (): Promise<void> => {
    const originalText: string = "Hello, World!";
    const password: string = "testpassword";

    const encrypted: string = await encryptText(originalText, password);
    const decrypted: string = await decryptText(encrypted, password);

    expect(decrypted).toBe(originalText);
  });

  test("encrypted text starts with marker", async (): Promise<void> => {
    const text: string = "Some text";
    const password: string = "password";

    const encrypted: string = await encryptText(text, password);

    expect(encrypted.startsWith(ENCRYPTION_MARKER)).toBe(true);
  });

  test("decryptText throws for non-encrypted text", async (): Promise<void> => {
    const plainText: string = "Not encrypted";
    const password: string = "password";

    let errorMessage: string = "";
    try {
      await decryptText(plainText, password);
    } catch (e: unknown) {
      if (e instanceof Error) {
        errorMessage = e.message;
      }
    }
    expect(errorMessage).toBe("Not encrypted");
  });

  test("handles unicode text", async (): Promise<void> => {
    const unicodeText: string = "Hello, \u4e16\u754c! \ud83c\udf0d";
    const password: string = "password";

    const encrypted: string = await encryptText(unicodeText, password);
    const decrypted: string = await decryptText(encrypted, password);

    expect(decrypted).toBe(unicodeText);
  });

  test("handles empty text", async (): Promise<void> => {
    const emptyText: string = "";
    const password: string = "password";

    const encrypted: string = await encryptText(emptyText, password);
    const decrypted: string = await decryptText(encrypted, password);

    expect(decrypted).toBe("");
  });
});

describe("encryptFile and decryptFile", (): void => {
  test("encrypts and decrypts file correctly", async (): Promise<void> => {
    const originalContent: string = "File content here";
    const originalFile: File = new File([originalContent], "test.txt", {
      type: "text/plain",
    });
    const password: string = "filepassword";

    const encryptedFile: File = await encryptFile(originalFile, password);
    const decryptedFile: File = await decryptFile(encryptedFile, password);

    expect(decryptedFile.name).toBe("test.txt");
    // File type may include charset suffix in some environments
    expect(decryptedFile.type.startsWith("text/plain")).toBe(true);

    const decryptedContent: string = await decryptedFile.text();
    expect(decryptedContent).toBe(originalContent);
  });

  test("encrypted file has .encrypted extension", async (): Promise<void> => {
    const file: File = new File(["content"], "document.pdf", {
      type: "application/pdf",
    });
    const password: string = "password";

    const encryptedFile: File = await encryptFile(file, password);

    expect(encryptedFile.name).toBe("document.pdf.encrypted");
    expect(encryptedFile.type).toBe("application/octet-stream");
  });

  test("preserves original file metadata", async (): Promise<void> => {
    const file: File = new File(["data"], "image.png", { type: "image/png" });
    const password: string = "password";

    const encryptedFile: File = await encryptFile(file, password);
    const decryptedFile: File = await decryptFile(encryptedFile, password);

    expect(decryptedFile.name).toBe("image.png");
    expect(decryptedFile.type.startsWith("image/png")).toBe(true);
  });

  test("handles binary file content", async (): Promise<void> => {
    const binaryContent: Uint8Array = new Uint8Array([0, 1, 2, 255, 254, 253]);
    const file: File = new File([binaryContent.buffer as ArrayBuffer], "binary.bin", {
      type: "application/octet-stream",
    });
    const password: string = "password";

    const encryptedFile: File = await encryptFile(file, password);
    const decryptedFile: File = await decryptFile(encryptedFile, password);

    const decryptedBuffer: ArrayBuffer = await decryptedFile.arrayBuffer();
    const decryptedArray: Uint8Array = new Uint8Array(decryptedBuffer);

    expect(decryptedArray).toEqual(binaryContent);
  });

  test("decryption fails with wrong password", async (): Promise<void> => {
    const file: File = new File(["sensitive"], "secret.txt", {
      type: "text/plain",
    });
    const correctPassword: string = "correct";
    const wrongPassword: string = "wrong";

    const encryptedFile: File = await encryptFile(file, correctPassword);

    let threw: boolean = false;
    try {
      await decryptFile(encryptedFile, wrongPassword);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
