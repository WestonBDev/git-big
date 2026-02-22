import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "enc:v1";

function decodeBase64Variant(value: string, encoding: BufferEncoding): Buffer | null {
  try {
    const decoded = Buffer.from(value, encoding);
    if (decoded.length === 0) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function decodeKeyMaterial(rawKey: string): Buffer {
  const key = rawKey.trim();
  if (!key) {
    throw new Error("Token encryption key is required.");
  }

  const hexMatch = /^[0-9a-fA-F]{64}$/.test(key);
  const decoded = hexMatch
    ? Buffer.from(key, "hex")
    : decodeBase64Variant(key, "base64url") ?? decodeBase64Variant(key, "base64");

  if (!decoded || decoded.length !== 32) {
    throw new Error("Token encryption key must decode to 32 bytes (AES-256).");
  }

  return decoded;
}

export function encryptTokenSecret(plaintext: string, rawKey: string): string {
  const value = plaintext.trim();
  if (!value) {
    throw new Error("Token secret cannot be empty.");
  }

  const key = decodeKeyMaterial(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${TOKEN_PREFIX}:${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptTokenSecret(encrypted: string, rawKey: string): string {
  try {
    if (!encrypted.startsWith(`${TOKEN_PREFIX}:`)) {
      throw new Error("Invalid token format.");
    }

    const payload = encrypted.slice(`${TOKEN_PREFIX}:`.length);
    const [ivPart, ciphertextPart, tagPart] = payload.split(".");
    if (!ivPart || !ciphertextPart || !tagPart) {
      throw new Error("Invalid encrypted token payload.");
    }

    const key = decodeKeyMaterial(rawKey);
    const iv = Buffer.from(ivPart, "base64url");
    const ciphertext = Buffer.from(ciphertextPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    if (!plaintext) {
      throw new Error("Decrypted token was empty.");
    }

    return plaintext;
  } catch {
    throw new Error("Failed to decrypt token secret.");
  }
}
