# Hosted Mode (Vercel)

This mode gives you a low-friction setup like `githubchart-api`: one shared hosted API, one Strava connect click, and a profile widget URL for `git big`.

Self-host mode (GitHub Actions + your own Strava app) remains fully supported and unchanged.

## What you get

- `GET /api/strava/connect?github=<GitHubLogin>`: starts Strava OAuth.
- `GET /api/strava/callback`: completes OAuth, stores encrypted refresh token, returns copy/paste README snippet.
- `GET /api/graph/<GitHubLogin>.svg?theme=light|dark`: serves the graph SVG.
- `GET|POST /api/cron/refresh`: daily refresh endpoint for all connected users.

## 1. Deploy

Deploy this repo to Vercel.

## 2. Add storage

Use Upstash Redis (Vercel Marketplace integration). Add:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Without these vars, the app falls back to in-memory storage (dev only).

## 3. Set environment variables

Required:

- `STRAVA_CLIENT_ID`: shared Strava app client id.
- `STRAVA_CLIENT_SECRET`: shared Strava app secret.
- `GITBIG_STATE_SECRET`: random secret used to sign OAuth state.
- `GITBIG_TOKEN_ENCRYPTION_KEY`: 32-byte key as 64-char hex or base64/base64url.
- `GITBIG_PUBLIC_BASE_URL`: deployed base URL, e.g. `https://gitbig.yourdomain.com`.

Optional:

- `GITBIG_CRON_SECRET`: cron auth secret (or use Vercel `CRON_SECRET`).
- Legacy `FITHUB_*` env names are still supported for backward compatibility.

## 4. Strava app callback config

In your shared Strava app settings:

- Authorization callback domain must match your deployed domain.
- Example callback URL path: `/api/strava/callback`.

## 5. Connect a user

Open:

```text
https://<your-domain>/api/strava/connect?github=<GitHubLogin>
```

After OAuth, callback page returns the exact README snippet to paste.

## 6. Profile README snippet

```markdown
![Fitness Graph](https://<your-domain>/api/graph/<GitHubLogin>.svg?theme=light#gh-light-mode-only)
![Fitness Graph](https://<your-domain>/api/graph/<GitHubLogin>.svg?theme=dark#gh-dark-mode-only)
```

## 7. Daily refresh

`vercel.json` includes a cron entry for `/api/cron/refresh`.

If you configure `CRON_SECRET` (recommended), `GITBIG_CRON_SECRET`, or `FITHUB_CRON_SECRET`, the endpoint accepts:

- `Authorization: Bearer <secret>`
- or `?secret=<secret>` for manual runs.

Manual test:

```bash
curl -H "Authorization: Bearer <secret>" https://<your-domain>/api/cron/refresh
```
