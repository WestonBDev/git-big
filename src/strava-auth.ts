export interface ExchangeAuthorizationCodeInput {
  clientId: string;
  clientSecret: string;
  code: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

interface OAuthTokenPayload {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_at?: unknown;
}

function hasRequiredTokens(payload: OAuthTokenPayload): payload is {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
} {
  return typeof payload.access_token === "string" && typeof payload.refresh_token === "string";
}

export async function exchangeAuthorizationCode(
  input: ExchangeAuthorizationCodeInput,
  fetchImpl: typeof fetch = fetch
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    grant_type: "authorization_code"
  });

  const response = await fetchImpl("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = (await response.json()) as OAuthTokenPayload;
  if (!response.ok) {
    throw new Error(`Strava OAuth token exchange failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  if (!hasRequiredTokens(payload)) {
    throw new Error("Strava OAuth token response did not include access_token and refresh_token.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: typeof payload.expires_at === "number" ? payload.expires_at : undefined
  };
}
