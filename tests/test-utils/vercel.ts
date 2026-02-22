import type { VercelRequest, VercelResponse } from "@vercel/node";

export interface MockRequestInput {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | undefined>;
}

export interface MockResponseCapture {
  statusCode?: number;
  headers: Record<string, string>;
  jsonBody?: unknown;
  sentBody?: string;
  ended: boolean;
}

export function createMockRequest(input: MockRequestInput = {}): VercelRequest {
  return {
    method: input.method ?? "GET",
    query: input.query ?? {},
    headers: input.headers ?? {}
  } as unknown as VercelRequest;
}

export function createMockResponse(): {
  res: VercelResponse;
  capture: MockResponseCapture;
} {
  const capture: MockResponseCapture = {
    headers: {},
    ended: false
  };

  const res = {
    status(code: number): VercelResponse {
      capture.statusCode = code;
      return res as unknown as VercelResponse;
    },
    setHeader(name: string, value: number | string | string[]): VercelResponse {
      const serialized = Array.isArray(value) ? value.join(",") : String(value);
      capture.headers[name.toLowerCase()] = serialized;
      return res as unknown as VercelResponse;
    },
    json(body: unknown): VercelResponse {
      capture.jsonBody = body;
      capture.ended = true;
      return res as unknown as VercelResponse;
    },
    send(body: unknown): VercelResponse {
      capture.sentBody = typeof body === "string" ? body : String(body);
      capture.ended = true;
      return res as unknown as VercelResponse;
    },
    end(body?: unknown): VercelResponse {
      if (body !== undefined) {
        capture.sentBody = typeof body === "string" ? body : String(body);
      }
      capture.ended = true;
      return res as unknown as VercelResponse;
    }
  };

  return {
    res: res as unknown as VercelResponse,
    capture
  };
}
