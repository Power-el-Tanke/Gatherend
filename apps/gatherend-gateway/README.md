# Gatherend Gateway

Reverse proxy that exposes `gatherend-web` (Next.js) and `express` (API + Socket.IO)
under the same public origin to make BetterAuth cookie-based auth work end-to-end.

## Routing

- `GET/POST/WS /api/r2/*` -> Express (prefix stripped)
- Everything else -> Next.js

Socket.IO is expected at `/api/r2/api/socket/io` from the browser so that, after
prefix stripping, Express receives `/api/socket/io`.

## Required Environment Variables (Railway)

- `PORT`: provided by Railway
- `NEXT_UPSTREAM`: internal URL for Next service, e.g. `http://gatherend-web.railway.internal:3000`
- `EXPRESS_UPSTREAM`: internal URL for Express service, e.g. `http://express.railway.internal:3001`

## Railway Setup Notes

- Create a new Railway service pointing at this repo with root dir `apps/gatherend-gateway`.
- Attach the public domain (`gatherend.com`) to the gateway service.
- Keep `gatherend-web` and `express` services internal (no public domain).
