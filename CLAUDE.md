# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**Sharecode** is a real-time collaborative code editor. Users create rooms, share the URL, and edit code together with live cursor/selection sync. Rooms auto-delete 5 minutes after the last participant disconnects.

Tech stack: Go backend (stdlib `net/http`, `gorilla/websocket`) + React/TypeScript frontend (CodeMirror 6, Yjs CRDT, Vite, Tailwind).

## Development commands

### Backend
```sh
go build ./cmd/server          # compile
go run ./cmd/server            # run (serves frontend/dist at /)
go test ./...                  # run all tests
go test ./internal/ws/...      # run tests in a specific package
```

### Frontend
```sh
cd frontend
npm install                    # install deps
npm run dev                    # dev server on :5173 (proxies /api and /ws to :8080)
npm run build                  # tsc + vite build → frontend/dist
```

### Running the full stack locally
Start the Go server first (`go run ./cmd/server`), then `npm run dev` in `frontend/`. Vite proxies API and WebSocket requests to `:8080`.

### Docker
```sh
docker compose up --build      # builds multi-stage image and starts on :8080
```

## Architecture

### Backend packages

| Package | Responsibility |
|---|---|
| `cmd/server` | Entry point: wires `Store`, `Registry`, `Handler`, and the SPA fallback file server |
| `internal/room` | `Room` (content + close-timer) and `Store` (thread-safe in-memory map, rate-limits 10 rooms per IP) |
| `internal/ws` | `Registry` (roomID → Hub map), `Hub` (goroutine per room: fan-out, Yjs sync), `Client` (read/write pumps) |
| `internal/api` | HTTP handler: REST endpoints + WebSocket upgrade |

**Room lifecycle:** `POST /api/rooms` creates a `Room` in the `Store` and spawns a `Hub` goroutine registered in `Registry`. `DELETE /api/rooms/{id}` calls `hub.Shutdown()` which closes all client connections. When the last client disconnects, the Hub starts a 5-minute `time.AfterFunc` that deletes the room from `Store` and `Registry` and stops the Hub.

### WebSocket / Yjs protocol

The backend speaks a subset of the [y-websocket protocol](https://github.com/yjs/y-websocket):

- **messageSync (0) / syncStep1 (0):** client sends on connect; server replies with an empty syncStep2 (all updates were pushed individually at register time).
- **messageSync (0) / syncStep2 (update) (2):** a Yjs document update; server stores it in `Room.Updates` and fans out to all other clients.
- **messageAwareness (1):** cursor/selection awareness; server forwards to all other clients without storing.

New clients receive all accumulated `Room.Updates` replayed in order, then an empty syncStep2 (`[0,1,2,0,0]`) to signal sync completion.

### Frontend data flow

```
RoomPage
  └── useYjs(roomId, nickname)   → Y.Doc + WebsocketProvider + yText + yMeta
  └── useRoom(provider, yMeta)   → participants (from awareness), language (from yMeta)
  └── Editor                     → CodeMirror 6 view bound to yText via yCollab
  └── Toolbar                    → language selector (writes to yMeta), font/theme controls
  └── ParticipantList            → displays awareness participants with their colors
```

`yText` (`Y.Text` named `"content"`) is the shared document. `yMeta` (`Y.Map` named `"meta"`) stores the shared language selection. Awareness (ephemeral, not persisted) carries `{ name, color }` per participant.

`useYjs` initializes the `Y.Doc` and `WebsocketProvider` once via a ref to avoid re-creation on re-renders. The provider connects to `/ws/<roomId>` using the same host as the page (ws/wss is inferred from http/https).

### Routing
- `/` — `LandingPage`: create a room via `POST /api/rooms`, redirect to `/room/:id`
- `/room/:id` — `RoomPage`: checks room exists via `GET /api/rooms/:id`, prompts for nickname, then loads the editor
- `*` — redirects to `/`

The Go server serves `frontend/dist` as a SPA (unknown paths fall back to `index.html`).
