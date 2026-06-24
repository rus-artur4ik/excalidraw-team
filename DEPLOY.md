# Deploy — self-hosted Excalidraw with access control

Full stack: **frontend** (static, nginx) + **collab room with ACL** (`excalidraw-room-acl`) +
**access-backend** (MCP + files, `excalidraw-mcp-collab`) + **Firebase** (Auth + Firestore,
managed). See `ACCESS_CONTROL_PLAN.md` for the design.

## Layout (sibling repos under one parent)

```
excalidraw-fork/
├── excalidraw-local-revision-history/   # frontend (this repo) — has the compose file
├── excalidraw-room-acl/                 # collab room server
└── excalidraw-mcp-collab/           # MCP + file backend
```
Run all docker commands from `excalidraw-local-revision-history/`.

## Prerequisites
- Docker + Docker Compose v2.
- The Firebase project `excalidraw-team` with **Firestore (Native)** and **Google Auth** enabled
  (already done), and `firestore.rules` deployed (see "Firestore rules" below).
- A **service account JSON** and the **web API key** (steps below).

## 1. One-time Firebase setup

**Service account** (used by the room + backend Admin SDK):
1. Firebase Console → ⚙ Project settings → **Service accounts** → **Generate new private key**.
2. Save the file as `excalidraw-local-revision-history/secrets/service-account.json`
   (the `secrets/` dir is git-ignored). Do NOT commit it.

**Web API key**: Console → Project settings → General → your Web app → `apiKey` (`AIzaSy…`).
It's already in `stack.env.example` for `excalidraw-team` (not a secret).

**Authorized domains** (for Google sign-in): Console → Authentication → Settings →
Authorized domains → add your production domain (`localhost` is allowed by default).

## 2. Configure the stack
```bash
cd excalidraw-local-revision-history
cp stack.env.example stack.env
# edit stack.env: set INTERNAL_SECRET to a long random string.
# for a real domain, set PUBLIC_APP_ORIGIN / PUBLIC_WS_URL / PUBLIC_BACKEND_URL to https/wss URLs.
```

## 3. Build & run
```bash
docker compose --env-file stack.env -f docker-compose.stack.yml up --build -d
docker compose -f docker-compose.stack.yml ps
```
Open `PUBLIC_APP_ORIGIN` (default http://localhost:18080) → sign in with Google → create a board.

Only the **proxy** publishes a host port (`PROXY_PORT`, default `18080`); it routes by path to the
frontend, room, and backend over the internal docker network — those three have no host ports.

> The `PUBLIC_*` URLs are **baked into the frontend at build time** (the browser uses them).
> Change them → rebuild the frontend (`--build`). `INTERNAL_SECRET`/creds are runtime-only.

## 4. Firestore rules
Already deployed. To redeploy after edits:
```bash
cd firebase-project
firebase deploy --only firestore:rules --project excalidraw-team
```
Note: `scenes/{id}` is intentionally still open (transitional). Tighten it to `canWrite` once the
board flow is verified end-to-end (it would block the legacy collab path until then).

## 5. Production behind Cloudflare (TLS at the edge)
The stack already includes an nginx **`proxy`** service — the single HTTP entrypoint (`PROXY_PORT`,
default `18080`) that routes by path to the internal services. **No host-level nginx/Caddy and no
Let's Encrypt** — Cloudflare terminates TLS and forwards plain HTTP to the proxy.

Set all three `PUBLIC_*` to the public origin (same origin — the paths are distinct):
```
PUBLIC_APP_ORIGIN=https://excalidraw.artavian.com
PUBLIC_WS_URL=https://excalidraw.artavian.com
PUBLIC_BACKEND_URL=https://excalidraw.artavian.com
PROXY_PORT=18080
```
Rebuild after changing any `PUBLIC_*` (they're baked into the build).

Point Cloudflare at the proxy — two options:
- **Cloudflare Tunnel (recommended):** run `cloudflared` with ingress `service: http://localhost:18080`
  (or `http://proxy:80` if cloudflared shares the compose network). Any port works; nothing is exposed.
- **Proxied DNS → origin:** orange-cloud the host. Cloudflare reaches HTTP origins only on certain
  ports — use an **Origin Rule** to target `18080`, or set `PROXY_PORT` to a CF-supported HTTP port
  (80, 8080, 8880, 2052, 2082, 2086, 2095).

Proxy routing (`proxy/nginx.conf`): `/socket.io/`→room (WS), `/mcp` + `/files/`→backend, everything
else→frontend (its own nginx does the SPA fallback for `/b/:id`, `/admin`); `client_max_body_size`
is raised for image uploads.

Then add **`excalidraw.artavian.com`** to Firebase → Authentication → Settings → Authorized domains.
Cloudflare Access (optional) may wrap `/admin` only — never the whole app (public boards need
anonymous access).

## 6. Connecting MCP
On any board you can access, click **MCP** on the board card → copy the returned config snippet into
your MCP client (Claude Desktop/Code, etc.). The bot acts as you: if your access is read-only, its
write tools are rejected; its history entries appear as **"Бот <your name>"**.

## 7. Verify (smoke)
- `curl http://localhost:3002/` → "Excalidraw collaboration server is up :)".
- Sign in, create a board, open it in a second browser/profile → live collaboration.
- Add a teammate in **Admin** (Chats Team) as read-only → they can open but not edit.
- Paste an image on a board → it round-trips (file service).

## 8. Operations
- **Image data** lives in the `backend-data` docker volume — back it up.
- **Revoke access**: remove a user in Admin / change board policy. Caveat: a user who already
  cached a private board's key can still decrypt until the key is rotated (re-encryption is a
  future task) — removal blocks the live socket and future joins.
- **MCP tokens**: revocable via `DELETE /mcp/tokens/:token` (or the UI list).

## 9. Troubleshooting
- **Sign-in popup blocked / unauthorized domain** → add the domain in Firebase Auth settings.
- **Collab connects but read-only user can still edit locally** → ensure you run the ACL room
  (this stack), not the stock `excalidraw/excalidraw-room` image.
- **Bot can't join / 401** → check `FIREBASE_WEB_API_KEY` and that the service account is mounted
  at `/secrets/service-account.json` in both room and backend.
- **Frontend points at the wrong server** → rebuild after changing any `PUBLIC_*` value.
- The access-backend README lists what still needs live verification (token exchange, fractional
  index interop, socket timing).
