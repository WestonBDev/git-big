import type { VercelRequest } from "@vercel/node";

export function getSingleQueryParam(
  query: VercelRequest["query"],
  key: string
): string | undefined {
  const value = query[key];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

export function requiredEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function publicBaseUrl(req: VercelRequest, env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.FITHUB_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = req.headers.host;

  const proto = typeof forwardedProto === "string" ? forwardedProto : "https";
  const host = typeof forwardedHost === "string" ? forwardedHost : hostHeader;
  if (!host) {
    throw new Error("Could not determine public base URL from request.");
  }

  return `${proto}://${host}`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
