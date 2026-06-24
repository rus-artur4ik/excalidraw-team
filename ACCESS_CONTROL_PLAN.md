# Access Control + Auth + MCP — implementation plan

Self-hosted Excalidraw fork: per-board access control (scenario B), Google auth,
team boards with an admin panel, and an MCP bridge that connects to a board as the
acting user (read-only respected, history attributed as "Бот <user>").

## 0. Locked decisions

| Decision | Choice |
|---|---|
| Data / auth plane | Keep Firebase: **Firebase Auth (Google)** + **Firestore**; rules enforce ACL |
| Privacy of private/team boards | **Gate the `roomKey` behind auth** (server hands key to authorized user; not in link) |
| Auth mechanism | **App-level Google sign-in** (Firebase Auth). Cloudflare Access optional, only on `/admin` |
| MCP | **Remote MCP endpoint in a new backend service**; bot acts as the user via a connect-token |
| MCP base | Fork ideas/tools from `yctimlin/mcp_excalidraw` (26 tools + skill), retarget to the collab board |
| Room server | Fork at `/Users/rus_artur4ik/IdeaProjects/excalidraw-fork/excalidraw-room-acl` (used for deploy) |

## Status (live)

- **Phase 0 done.** Firebase project `excalidraw-team` (number 977923226845); web app registered;
  `.env.development.local` points dev at it; Firestore `(default)` Native DB in **europe-west1**
  (permanent, free tier); Google Auth provider enabled. **Firebase Storage dropped** — board
  images move to a self-hosted filesystem file module in the access-backend (Phase 6);
  `storage` block removed from `firebase.json`.
- **Phase 1 done.** `firestore.rules` (real ACL, incl. constrained `boards` list) deployed;
  `teams/chats-team` seeded (`admins: [artur240101@gmail.com]`). Team docs use flat arrays
  `admins`/`editorEmails`/`viewerEmails`. Deferred: board-list composite indexes (add if queries
  need ordering) and history subcollection migration (with the file work).
- **Phase 2 done.** Auth helpers in `data/firebase.ts` (`signInWithGoogle`, `signOutFromApp`,
  `subscribeToAuthChanges`, `getCurrentUserIdToken`, `getCurrentAppUser`); `auth/AuthContext.tsx`
  (`AuthProvider` + `useAuth`) + `auth/atoms.ts`.
- **Phase 3 done.** Minimal pathname router (`router.ts`, no dep); `pages/HomePage.tsx` (login +
  my/team boards + create), `pages/AdminPage.tsx` (Chats Team member/role mgmt),
  `pages/BoardSettings.tsx`. `ExcalidrawApp` wraps `AuthProvider` + `RoutedApp` (`/` → Home,
  `/admin` → Admin, `/b/:id` + legacy `#room=` → editor). Test mode bypasses the shell.
- **Phase 4 done (core).** `data/boards.ts` (createBoard/loadBoard/listMy/Team/updateBoardPolicy/
  team ops/canWriteBoard); `initializeScene` key-gated `/b/:id` bootstrap (key from Firestore,
  never in URL; access-error scene on denial); `Collab.tsx` sends Firebase ID token via socket
  `auth` + handles `access-denied`; owner board-access UI in `BoardSettings`. Viewer
  `viewModeEnabled` (`boardViewOnlyAtom`), collaborator avatars (Google name + photo broadcast via
  `MOUSE_LOCATION.avatarUrl`; username = Google name), and the in-editor user menu (`AppMainMenu`:
  My boards + Sign out) are all DONE (task #10 complete).
- **Phase 5 done.** Room fork `excalidraw-room-acl`: `src/accessControl.ts` (token verify +
  ACL) wired into `src/index.ts` (`join-room` denies non-readers via `access-denied`;
  `server-broadcast` dropped for viewers; `/internal/acl-changed/:roomId`). Needs
  `GOOGLE_APPLICATION_CREDENTIALS` + `FIREBASE_PROJECT_ID` + `INTERNAL_SECRET` to run.
- **Phase 6 done.** New service `excalidraw-mcp-collab` (Node + Express + firebase-admin +
  MCP Streamable HTTP + socket.io-client): `POST/GET/DELETE /mcp/tokens`, `ALL /mcp` (6 tools;
  mutating ones editor-only), `CollabBot` (custom-token→ID-token exchange → joins room as the
  user → reconcile/broadcast/persist + history `author: 'Бот <name>'`), filesystem `GET/PUT /files/*`.
  Frontend: file fns in `data/firebase.ts` now call the backend (env `VITE_APP_ACCESS_BACKEND_URL`);
  `data/mcpTokens.ts` + "MCP"/"Access" buttons on board cards. Live verification needs creds +
  running room server (see backend README).
- **Phase 7 done.** History `author` = authed `displayName`/email/«Гость» (`Collab.tsx`); bot
  entries render a 🤖 avatar in `HistorySidebar`.
- **Phase 8 (verification):** `yarn test:typecheck` clean; eslint clean; all `excalidraw-app`
  tests pass (10/10) — added missing auth/history/file exports to the test firebase mock
  (pre-existing gap). `yarn build` + live end-to-end (creds, room server, backend) pending deploy.
- **Naming debt:** `saveFilesToFirebase`/`loadFilesFromFirebase` now hit the HTTP file service;
  rename to `*ToServer` later (kept names to avoid churn across collab/share-link/Plus callers).

## 1. Permission model (two axes)

```
Board:
  roomId, ownerUid, ownerEmail, title, type: 'personal' | 'team', teamId?
  readPolicy:  'public' | 'members'              // who may OPEN/read
  writePolicy: 'everyone' | 'whitelist' | 'owner' // owner = owner/team-admins only; others read-only
  editors: string[]                              // emails, used when writePolicy == 'whitelist'
  createdAt, updatedAt

Team:
  teamId, name
  admins:       string[]   // emails, full control (write + manage members)
  editorEmails: string[]   // read-write members
  viewerEmails: string[]   // read-only members
```

- **Personal board**: owner picks `readPolicy` + `writePolicy`.
- **Team board**: `type='team'`, `readPolicy='members'`; write set = `admins` + `editorEmails`; `viewerEmails` are read-only.
- Read axis and write axis are independent and enforced separately on every write path.

## 2. Repositories / components

1. **`excalidraw-local-revision-history`** (this repo, frontend) — auth, routing/pages
   (login, `/home` board list, `/admin`), per-board permission UI, key-gating bootstrap,
   avatars/guest, "Connect MCP" token UI, history author from identity, socket auth token.
2. **`excalidraw-room-acl`** (room fork) — socket auth, per-room ACL, drop scene writes
   from read-only sockets, live ACL refresh.
3. **NEW backend service** `excalidraw-mcp-collab` (Node + Express + Firebase Admin) —
   MCP token mint/revoke, remote MCP endpoint (ported tools), headless collab bot,
   bot history attribution, and **image file storage (filesystem, replaces Firebase Storage)**.
4. **`firebase-project`** — Firestore schema docs, security rules, Chats Team seed,
   Firebase project config (Auth Google provider enabled).

## 3. Firestore data model

Collections (own Firebase project, NOT excalidraw-oss-dev):

- `boards/{roomId}` — metadata + ACL (see model above). **Unencrypted** (rules must read it).
- `boardKeys/{roomId}` — `{ roomKey: string }`. Gated by `canRead`. (Trade-off in §6.)
- `scenes/{roomId}` — existing encrypted scene (`ciphertext`, `iv`, `sceneVersion`). Unchanged shape.
- **History**: currently `scenes/{roomId}~history` + `scenes/{roomId}~history~{entryId}`
  (composite IDs in the `scenes` collection). Firestore rules **cannot** split the `~`
  prefix to find the board → see §4 decision (migrate history to a subcollection).
- `teams/{teamId}` — team membership + roles.
- `mcpTokens/{token}` — `{ uid, email, boardId, role, createdAt, revoked }`. Backend (Admin) only.
- `users/{uid}` — optional profile cache `{ email, displayName, photoURL }`.

## 4. Firestore security rules (sketch)

Helper-function approach; `boards`/`teams` read via `get()`.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function email() { return request.auth.token.email; }
    function board(id) { return get(/databases/$(db)/documents/boards/$(id)).data; }
    function team(id)  { return get(/databases/$(db)/documents/teams/$(id)).data; }
    function isOwner(b)       { return signedIn() && request.auth.uid == b.ownerUid; }
    function isWhitelisted(b) { return signedIn() && email() in b.editors; }
    function teamAdmin(b)     { return b.teamId != null && signedIn() && email() in team(b.teamId).admins; }
    function teamEditor(b)    { return b.teamId != null && signedIn() && team(b.teamId).roles[email()] == 'editor'; }
    function teamMember(b)    { return b.teamId != null && signedIn() && email() in team(b.teamId).memberEmails; }
    function canRead(b)  { return b.readPolicy == 'public' || isOwner(b) || isWhitelisted(b) || teamMember(b) || teamAdmin(b); }
    function canWrite(b) {
      return b.writePolicy == 'everyone'
        || isOwner(b) || teamAdmin(b)
        || (b.writePolicy == 'whitelist' && isWhitelisted(b))
        || teamEditor(b);
    }

    match /boards/{id} {
      allow get:    if canRead(resource.data);
      allow create: if signedIn() && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if isOwner(resource.data) || teamAdmin(resource.data);
      allow list:   if false;
    }
    match /boardKeys/{id} {
      allow get:   if canRead(board(id));
      allow write: if isOwner(board(id)) || teamAdmin(board(id));
    }
    match /scenes/{id} {
      allow get:   if canRead(board(id));
      allow write: if canWrite(board(id));
      allow list:  if false;
    }
    // History as subcollection (see decision below):
    match /boards/{id}/history/{entryId} {
      allow get:   if canRead(board(id));
      allow write: if canWrite(board(id));
      allow list:  if canRead(board(id));
    }
    match /teams/{id} {
      allow get:    if signedIn() && (email() in resource.data.admins || email() in resource.data.memberEmails);
      allow update: if signedIn() && email() in resource.data.admins;   // admin panel edits members/roles
      allow create, delete: if false;                                   // seeded / out-of-band
    }
    match /mcpTokens/{token} { allow read, write: if false; }           // backend Admin only
    match /users/{uid}       { allow read: if signedIn(); allow write: if request.auth.uid == uid; }
  }
}
```

**Decision (history layout):** migrate the shared history from `scenes/{roomId}~history*`
flat docs to a **`boards/{roomId}/history/{entryId}` subcollection** so rules can resolve the
board. This touches the working revision-history feature (read/write paths in `firebase.ts`).
Alternative (keep flat, coarser/again-misleading rules) is rejected.

## 5. Enforcement matrix (defense in depth)

| Path | Read gate | Write gate |
|---|---|---|
| Direct Firestore (`scenes`, `boardKeys`, history) | rules `canRead` | rules `canWrite` |
| Real-time WebSocket (room server) | reject `join-room` if `readPolicy=members` & not authorized | drop `server-broadcast` from viewer sockets (keep volatile) |
| Frontend UX | gated key fetch fails → can't open | `viewModeEnabled=true` for viewers (disables tools) |
| MCP bot | token must map to a `canRead` user | mutating tools 403 for viewer; bot never broadcasts writes |

Frontend UX is **not** enforcement — rules + room server are. Both must agree.

## 6. Key-gating design + trade-off

- **Public board**: `roomKey` stays in the link (`#room=id,key`), `boards` doc says
  `public`/`everyone`. Anonymous connect works exactly as today.
- **Private/team board**: URL is `/b/:roomId` with **no key**. After auth, client reads
  `boardKeys/{roomId}` (rules gate it) → `startCollaboration({roomId, roomKey})`.
- **Trade-off (explicit):** storing `roomKey` in Firestore means the Firebase project
  (i.e. Google, and anyone with Admin creds) can technically decrypt board contents — we
  lose end-to-end secrecy *against the server*, in exchange for real per-user access control.
  Same trust model as Google Docs. True E2E + ACL would require per-user key wrapping
  (encrypt `roomKey` to each authorized user's public key) — **deferred**.
- **Revocation caveat:** removing a user does not retroactively stop them decrypting if they
  cached the key. True read-revocation needs **key rotation + scene re-encryption** — deferred;
  for v1 "remove" prevents future access and blocks the live socket.

## 7. Phased implementation (dependency order)

### Phase 0 — Infra / Firebase project (prereq, mostly console + env)
- Create own Firebase project; enable **Authentication → Google** provider; add authorized domains.
- Generate a **service account** key for the backend (Firebase Admin).
- Frontend env: point `VITE_APP_FIREBASE_CONFIG` to the new project; `VITE_APP_WS_SERVER_URL`
  to the deployed room fork. (`.env.development` / `.env.production`.)
- Room fork + backend env: service account, Firestore project id, `CORS_ORIGIN`.

### Phase 1 — Data model + rules + seed (foundation, no UI)
- `firebase-project/firestore.rules` — replace `allow ... if true` with §4 rules.
- `firebase-project/firestore.indexes.json` — index for board list queries
  (e.g. `boards` by `ownerUid`, by `teamId`).
- `firebase-project/storage.rules` — gate `rooms/{room}` blobs by board ACL (mirror canRead/canWrite).
- Seed script `firebase-project/scripts/seed.mjs` (Admin SDK): create
  `teams/chats-team` `{ name: 'Chats Team', admins: ['artur240101@gmail.com'], members: [], memberEmails: [], roles: {} }`.
- Deploy rules + seed.

### Phase 2 — Auth in the app (Firebase Auth Google)
- `excalidraw-app/data/firebase.ts` — add `firebase/auth`: `getAuth`, `GoogleAuthProvider`,
  `signInWithPopup`, `signOut`, `onAuthStateChanged`, `getIdToken`. Lazy-init like Firestore.
- NEW `excalidraw-app/auth/AuthContext.tsx` — provider + `useAuth()` hook
  (`{ user, loading, signIn, signOut, idToken }`).
- `excalidraw-app/app-jotai.ts` — atoms `currentUserAtom`, `authLoadingAtom`.
- Wrap providers in `excalidraw-app/App.tsx` (`ExcalidrawApp`, ~line 1264).

### Phase 3 — Routing + pages shell
- Add `react-router-dom` (or a minimal pathname switch) in `ExcalidrawApp` (`App.tsx:1264`).
  Routes:
  - `/` → `HomePage` (board list or login).
  - `/admin` → `AdminPage` (teams where I'm admin).
  - `/b/:roomId` → existing `ExcalidrawWrapper` (canvas).
  - Keep `#room=id,key` working (public legacy / share links) — render canvas when hash present.
- NEW `excalidraw-app/pages/HomePage.tsx` — unauth: "Sign in with Google"; auth: my boards
  (`boards where ownerUid==uid`) + team boards (`boards where teamId in myTeams`) + "New board".
- NEW `excalidraw-app/pages/AdminPage.tsx` — list members of Chats Team; add email + role;
  toggle viewer/editor; remove. Writes to `teams/{id}` (rules: admin only).
- NEW `excalidraw-app/components/UserAvatarMenu.tsx` — avatar + sign-out; add to `AppMainMenu.tsx`.

### Phase 4 — Board creation + per-board permissions + key-gating bootstrap
- `excalidraw-app/data/index.ts` — add `getBoardRouteData(pathname)` next to
  `getCollaborationLinkData` (hash); `RE_COLLAB_LINK` at line 131 stays for public links.
- NEW `excalidraw-app/data/boards.ts` — `createBoard()` (gen roomId+roomKey via
  `generateRoomId`/`generateEncryptionKey`, write `boards/{id}` + `boardKeys/{id}`),
  `loadBoard(roomId)` (fetch board + key), `updateBoardPolicy()`, `listMyBoards()`.
- `excalidraw-app/collab/Collab.tsx` — `startCollaboration` (line 520): when invoked for a
  private board, accept a `roomKey` fetched from `boardKeys` instead of the hash; set socket
  `auth: { token }` at the `socketIOClient(...)` call (line ~572).
- `excalidraw-app/App.tsx` — `initializeScene` (line 215): branch private `/b/:roomId`
  (fetch key after auth) vs public `#room` (key from hash, line 248).
- Board settings UI: extend `excalidraw-app/share/ShareDialog.tsx` (or new `BoardSettings.tsx`)
  for owner to set `readPolicy`/`writePolicy`/`editors`.
- View mode for viewers: pass `viewModeEnabled` to `<Excalidraw>` when role==viewer.
- Avatars: authed collaborators use Google `displayName`/`photoURL`; anon → "Гость".

### Phase 5 — Room server ACL (`excalidraw-room-acl/src/index.ts`)
- Add `firebase-admin`. Read `socket.handshake.auth.token` on `connection` (line 52).
- `join-room` (line 55): verify token (Firebase ID token OR mcp connect-token via backend),
  resolve `{ uid/email, role }` from `boards/{roomId}` (+ team). Reject (disconnect) if
  `readPolicy=members` and not authorized. Store `socket.data = { roomId, role }`.
- `server-broadcast` (line 72): if `socket.data.role === 'viewer'` → **drop** (return). Else relay.
- `server-volatile-broadcast` (line 80): always relay (cursor/idle, so viewers show presence).
- Live ACL: add `app.post('/internal/acl-changed/:roomId')` (shared-secret) → re-fetch ACL,
  downgrade/disconnect affected sockets. Backend calls it after ACL writes.

### Phase 6 — Backend service `excalidraw-mcp-collab` (NEW repo/dir)
- Stack: Node 20, Express, `firebase-admin`, `@modelcontextprotocol/sdk` (streamable HTTP),
  `socket.io-client`, plus `@excalidraw/excalidraw` + `@excalidraw/element` for
  `reconcileElements`/element helpers, and the encryption helpers
  (`packages/excalidraw/data/encryption`). Web Crypto via Node `globalThis.crypto.subtle`.
- Endpoints:
  - `POST /mcp/tokens` (Firebase ID token auth) → mint `mcpTokens/{token}` scoped to
    `{ uid, email, boardId, role }`; return token + ready MCP config snippet.
  - `GET /mcp/tokens?board=` / `DELETE /mcp/tokens/:token` → list/revoke (for the UI).
  - `POST /mcp` — streamable MCP endpoint; auth via connect-token; opens a bot session.
- Bot module `bot/CollabBot.ts`: socket.io-client to room (auth = connect-token), fetch gated
  `roomKey` (Admin), maintain element state, apply tool mutations with proper
  `version`/`versionNonce`/fractional-index + `reconcileElements`, `server-broadcast`
  encrypted, persist to `scenes/{roomId}` + history with `author: 'Бот ' + displayName`.
- Tools (ported subset of yctimlin): `create_element`, `update_element`, `delete_element`,
  `query_elements`, `describe_scene` (from data, no DOM), `clear_canvas`, `export_scene`.
  **Deferred (DOM-dependent):** `get_canvas_screenshot`, `create_from_mermaid` (need headless
  render); `export_to_excalidraw_url` (don't leak private boards to excalidraw.com).
- Read-only: viewer token → mutating tools return permission error; bot never broadcasts writes.
- **Image file storage (filesystem)** — replaces Firebase Storage. Endpoints `PUT/GET /files/:roomId/:fileId`
  store opaque client-encrypted blobs on disk (`<DATA_DIR>/rooms/{roomId}/{fileId}` + sidecar iv/metadata);
  ACL: write if `canWrite(board)`, read if `canRead(board)`/public; anon allowed on public boards.
  Frontend swap: replace `saveFilesToFirebase`/`loadFilesFromFirebase` in `excalidraw-app/data/firebase.ts`
  with file-service calls; update callers `Collab.tsx:173,181` + `App.tsx:478`; drop `firebase/storage`
  import; new env `VITE_APP_FILES_SERVER_URL`. (`storage.rules` already orphaned — delete.)

### Phase 7 — History author from identity + bot marker
- `excalidraw-app/collab/Collab.tsx` (author append ~line 352–358): use authed `displayName`
  when signed in; "Гость" when anonymous (instead of self-claimed localStorage username).
- Bot sets `author: 'Бот <displayName>'` (Phase 6).
- `excalidraw-app/components/HistorySidebar.tsx` (author label 228–232, avatar 776–782):
  render a bot marker/icon when author is a bot; keep "(you)" via session id.

### Phase 8 — Verification + deploy
- `yarn test:typecheck`, `yarn test:update`, `yarn fix` (frontend).
- Room fork + backend: build + lint.
- Deploy: Firestore rules + indexes; room fork (pm2/Docker); backend; frontend.
- Manual matrix: public RW anon edit; team viewer (read-only enforced via rules + socket);
  team editor; whitelist personal; MCP connect (editor writes, viewer denied); admin panel
  add/remove/role; history shows real names + "Бот X".

## 8. Open items / deferred

- **History subcollection migration** (Phase 1/4) — reshapes the existing revision-history
  storage; needs care + a migration for any existing data.
- **True read-revocation** (key rotation + re-encryption) — deferred.
- **Per-user key wrapping** for E2E-against-server — deferred (v1 stores key in Firestore).
- **DOM tools for MCP** (screenshot, mermaid) — need headless render; deferred.
- **Abuse control** on public RW boards (rate limit / captcha) — not in scope.
- **Cloudflare Access** on `/admin` — optional infra step, after app-level auth works.

## 9. Infra / deploy checklist
- [ ] Own Firebase project + Google Auth provider + authorized domains
- [ ] Service account key (backend, room server)
- [ ] Firestore rules + indexes deployed; Chats Team seeded
- [ ] Room fork deployed; `VITE_APP_WS_SERVER_URL` points to it; socket auth wired
- [ ] Backend deployed; MCP endpoint URL; shared secret for `/internal/acl-changed`
- [ ] Frontend env switched off excalidraw-oss-dev to own project
