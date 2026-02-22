import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { normalizeGithubLogin } from "./github.js";

const STATE_VERSION = "v1";

export interface OAuthStatePayload {
  githubLogin: string;
  redirectPath?: string;
}

interface SignedStatePayload {
  githubLogin: string;
  redirectPath?: string;
  nonce: string;
  iat: number;
  exp: number;
}

function sign(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

export function createOAuthStateToken(
  payload: OAuthStatePayload,
  secret: string,
  now: Date = new Date(),
  ttlSeconds: number = 900
): string {
  if (!secret.trim()) {
    throw new Error("State secret is required.");
  }

  if (ttlSeconds <= 0 || !Number.isFinite(ttlSeconds)) {
    throw new Error("State token TTL must be a positive number.");
  }

  const issuedAt = Math.floor(now.getTime() / 1000);
  const signedPayload: SignedStatePayload = {
    githubLogin: normalizeGithubLogin(payload.githubLogin),
    redirectPath: payload.redirectPath,
    nonce: randomBytes(16).toString("base64url"),
    iat: issuedAt,
    exp: issuedAt + Math.floor(ttlSeconds)
  };

  const serialized = Buffer.from(JSON.stringify(signedPayload), "utf8").toString("base64url");
  const signature = sign(serialized, secret).toString("base64url");
  return `${STATE_VERSION}.${serialized}.${signature}`;
}

export function verifyOAuthStateToken(
  token: string,
  secret: string,
  now: Date = new Date()
): OAuthStatePayload {
  if (!secret.trim()) {
    throw new Error("State secret is required.");
  }

  const [version, serialized, signaturePart] = token.split(".");
  if (version !== STATE_VERSION || !serialized || !signaturePart) {
    throw new Error("Invalid OAuth state token.");
  }

  const expected = sign(serialized, secret);
  const provided = Buffer.from(signaturePart, "base64url");

  if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) {
    throw new Error("Invalid OAuth state signature.");
  }

  let payload: SignedStatePayload;
  try {
    payload = JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")) as SignedStatePayload;
  } catch {
    throw new Error("Invalid OAuth state token.");
  }

  if (!payload || typeof payload !== "object" || typeof payload.githubLogin !== "string") {
    throw new Error("Invalid OAuth state token.");
  }

  if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
    throw new Error("Invalid OAuth state token.");
  }

  const currentEpoch = Math.floor(now.getTime() / 1000);
  if (currentEpoch >= payload.exp) {
    throw new Error("OAuth state token expired.");
  }

  return {
    githubLogin: normalizeGithubLogin(payload.githubLogin),
    redirectPath: typeof payload.redirectPath === "string" ? payload.redirectPath : undefined
  };
}
