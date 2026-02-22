import { afterEach, describe, expect, it, vi } from "vitest";

import handler from "../api/cron/refresh.js";
import { createMockRequest, createMockResponse } from "./test-utils/vercel.js";

const mocks = vi.hoisted(() => {
  return {
    refreshAllHostedGraphs: vi.fn(),
    createHostedStore: vi.fn(() => ({ marker: "store" }))
  };
});

vi.mock("../src/hosted/service.js", () => {
  return {
    refreshAllHostedGraphs: mocks.refreshAllHostedGraphs
  };
});

vi.mock("../src/hosted/store.js", () => {
  return {
    createHostedStore: mocks.createHostedStore
  };
});

describe("api /cron/refresh", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("rejects unsupported methods", async () => {
    const req = createMockRequest({ method: "DELETE" });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(405);
    expect(capture.jsonBody).toEqual({ error: "Method not allowed" });
  });

  it("rejects unauthorized requests", async () => {
    process.env = {
      ...originalEnv,
      GITBIG_CRON_SECRET: "cron-secret"
    };

    const req = createMockRequest({
      method: "GET",
      headers: {
        authorization: "Bearer wrong-secret"
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(401);
    expect(capture.jsonBody).toEqual({ error: "Unauthorized" });
  });

  it("accepts bearer auth and returns refresh summary", async () => {
    process.env = {
      ...originalEnv,
      GITBIG_CRON_SECRET: "cron-secret",
      STRAVA_CLIENT_ID: "204011",
      STRAVA_CLIENT_SECRET: "client-secret",
      GITBIG_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
    };

    mocks.refreshAllHostedGraphs.mockResolvedValue({
      processed: 2,
      succeeded: 2,
      failed: 0,
      errors: []
    });

    const req = createMockRequest({
      method: "POST",
      headers: {
        authorization: "Bearer cron-secret"
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(mocks.refreshAllHostedGraphs).toHaveBeenCalledTimes(1);
    expect(mocks.refreshAllHostedGraphs).toHaveBeenCalledWith({
      store: { marker: "store" },
      stravaClientId: "204011",
      stravaClientSecret: "client-secret",
      tokenEncryptionKey: "1111111111111111111111111111111111111111111111111111111111111111"
    });

    expect(capture.statusCode).toBe(200);
    expect(capture.jsonBody).toEqual({
      processed: 2,
      succeeded: 2,
      failed: 0,
      errors: []
    });
  });

  it("accepts query-string secret from CRON_SECRET", async () => {
    process.env = {
      ...originalEnv,
      CRON_SECRET: "legacy-secret",
      STRAVA_CLIENT_ID: "204011",
      STRAVA_CLIENT_SECRET: "client-secret",
      GITBIG_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
    };

    mocks.refreshAllHostedGraphs.mockResolvedValue({
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    });

    const req = createMockRequest({
      method: "GET",
      query: {
        secret: "legacy-secret"
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(200);
    expect(capture.jsonBody).toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    });
  });

  it("returns 500 when refresh operation fails", async () => {
    process.env = {
      ...originalEnv,
      GITBIG_CRON_SECRET: "cron-secret",
      STRAVA_CLIENT_ID: "204011",
      STRAVA_CLIENT_SECRET: "client-secret",
      GITBIG_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
    };

    mocks.refreshAllHostedGraphs.mockRejectedValue(new Error("rate limited"));

    const req = createMockRequest({
      method: "GET",
      headers: {
        authorization: "Bearer cron-secret"
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(500);
    expect(capture.jsonBody).toEqual({ error: "rate limited" });
  });

  it("rejects requests when no cron secret is configured", async () => {
    process.env = {
      ...originalEnv,
      GITBIG_CRON_SECRET: "",
      FITHUB_CRON_SECRET: "",
      CRON_SECRET: ""
    };

    const req = createMockRequest({
      method: "GET"
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(401);
    expect(capture.jsonBody).toEqual({ error: "Unauthorized" });
  });
});
