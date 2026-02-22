import { describe, expect, it } from "vitest";

import { decryptTokenSecret, encryptTokenSecret } from "../src/hosted/crypto.js";

describe("hosted token crypto", () => {
  const key = "1111111111111111111111111111111111111111111111111111111111111111";

  it("encrypts and decrypts refresh tokens", () => {
    const encrypted = encryptTokenSecret("refresh-token-abc", key);
    expect(encrypted).not.toContain("refresh-token-abc");

    const decrypted = decryptTokenSecret(encrypted, key);
    expect(decrypted).toBe("refresh-token-abc");
  });

  it("fails to decrypt with the wrong key", () => {
    const encrypted = encryptTokenSecret("refresh-token-abc", key);
    const wrongKey = "2222222222222222222222222222222222222222222222222222222222222222";

    expect(() => decryptTokenSecret(encrypted, wrongKey)).toThrowError(
      "Failed to decrypt token secret."
    );
  });

  it("rejects invalid encryption key material", () => {
    expect(() => encryptTokenSecret("refresh-token-abc", "")).toThrowError(
      "Token encryption key is required."
    );
    expect(() => encryptTokenSecret("refresh-token-abc", "short")).toThrowError(
      "Token encryption key must decode to 32 bytes (AES-256)."
    );
  });

  it("rejects malformed encrypted payloads", () => {
    expect(() => decryptTokenSecret("invalid", key)).toThrowError("Failed to decrypt token secret.");
    expect(() => decryptTokenSecret("enc:v1.missing-parts", key)).toThrowError(
      "Failed to decrypt token secret."
    );
  });
});
