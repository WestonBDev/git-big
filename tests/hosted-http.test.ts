import { describe, expect, it } from "vitest";

import type { VercelRequest } from "@vercel/node";

import {
  escapeHtml,
  getSingleQueryParam,
  publicBaseUrl,
  requiredEnv,
  requiredEnvAny
} from "../src/hosted/http.js";

function createRequest(input: {
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | undefined>;
}): VercelRequest {
  return {
    query: input.query ?? {},
    headers: input.headers ?? {}
  } as unknown as VercelRequest;
}

describe("hosted http helpers", () => {
  it("reads single query parameters", () => {
    const req = createRequest({
      query: {
        theme: "light",
        tags: ["a", "b"]
      }
    });

    expect(getSingleQueryParam(req.query, "theme")).toBe("light");
    expect(getSingleQueryParam(req.query, "tags")).toBe("a");
    expect(getSingleQueryParam(req.query, "missing")).toBeUndefined();
  });

  it("builds public base url from env override", () => {
    const req = createRequest({
      headers: {
        host: "ignored.example"
      }
    });

    expect(publicBaseUrl(req, { GITBIG_PUBLIC_BASE_URL: "https://git-big.dev/" })).toBe(
      "https://git-big.dev"
    );
    expect(publicBaseUrl(req, { FITHUB_PUBLIC_BASE_URL: "https://fithub.dev/" })).toBe(
      "https://fithub.dev"
    );
  });

  it("builds public base url from forwarded headers", () => {
    const req = createRequest({
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "fithub.dev"
      }
    });

    expect(publicBaseUrl(req, {})).toBe("https://fithub.dev");
  });

  it("requires env values", () => {
    expect(requiredEnv("ABC", { ABC: "123" })).toBe("123");
    expect(() => requiredEnv("ABC", {})).toThrowError("Missing required environment variable: ABC");
  });

  it("reads first available env value from aliases", () => {
    expect(requiredEnvAny(["A", "B"], { B: "value-from-b" })).toBe("value-from-b");
    expect(requiredEnvAny(["A", "B"], { A: "value-from-a", B: "value-from-b" })).toBe(
      "value-from-a"
    );
    expect(() => requiredEnvAny(["A", "B"], {})).toThrowError(
      "Missing required environment variable: A or B"
    );
  });

  it("throws when base url cannot be inferred", () => {
    const req = createRequest({
      headers: {}
    });

    expect(() => publicBaseUrl(req, {})).toThrowError(
      "Could not determine public base URL from request."
    );
  });

  it("escapes html-sensitive characters", () => {
    expect(escapeHtml(`a&b<c>"d"'e'`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;");
  });
});
