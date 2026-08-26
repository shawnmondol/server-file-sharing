# Shared Files

A self-hosted file gallery for a Raspberry Pi 5, reachable only over a Tailscale
tailnet. Browse a folder tree as a thumbnail grid, filter by file type, sort by
name / size / date, and upload, download, or delete — from a desktop browser or
as an installed PWA on iOS.

The library lives at `~/Documents/SharedFiles` by default. The filesystem is the
source of truth: files added over SSH, Samba, or `scp` appear in the gallery
immediately, and anything the app deletes is gone from disk.

---

## What it does

- **Gallery view** — thumbnail grid with real image previews and video poster
  frames, folder drill-in, and a breadcrumb trail.
- **Filters** — type chips generated from what is actually in the folder, across
  17 categories (images, video, audio, documents, spreadsheets, presentations,
  archives, code, text, data, e-books, fonts, design, disk images, apps, and so
  on) with live counts.
- **Sorting** — name, size, or date added, ascending or descending. Folders
  always lead.
- **Search** — recursive filename search from the current folder down.
- **Upload** — drag and drop anywhere, or the Upload button. Streams to disk with
  per-file progress, transfer rate, ETA, cancel, and automatic rename on name
  collision.
- **Download** — single files stream directly with range support; multi-select
  and folders download as a ZIP.
- **Delete** — multi-select with a confirmation sheet. Permanent, no trash.
- **Inspector** — size, kind, dates, owner and mode, full path, SHA-256, and
  entry count for ZIP archives. A sidebar on desktop, a sheet on phones.
- **Offline state** — when the tailnet route drops, the cached listing stays
  visible and write actions are disabled rather than failing silently.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js 22 | Native `arm64` builds for `sharp` and `better-sqlite3` on the Pi. |
| API | Fastify 5 + TypeScript | Streaming multipart uploads and range requests without buffering. |
| Index | SQLite (better-sqlite3) | Caches SHA-256 digests and thumbnail state. A cache, not a source of truth. |
| Thumbnails | sharp + ffmpeg | sharp for images, one ffmpeg poster frame for video. |
| Frontend | React 19 + Vite 6 + Tailwind 4 | Small bundle, responsive from phone to desktop. |
| PWA | vite-plugin-pwa (Workbox) | Installable on iOS and desktop; caches the shell and thumbnails. |
| Front door | `tailscale serve` | HTTPS termination plus the caller identity the app authenticates on. |

---

## Requirements

On the Pi:

- **Node.js 22 or newer** — `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`
- **ffmpeg** (only for video poster frames) — `sudo apt install -y ffmpeg`
- **Tailscale**, logged in — `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`
- **build-essential** — `sudo apt install -y build-essential python3`, in case a
  native module has to compile rather than fetch a prebuilt binary.

---

## Setup

```bash
git clone https://github.com/shawnmondol/server-file-sharing.git 
cd ~/apps/server-file-sharing

npm install
cp .env.example .env
$EDITOR .env          # set SHARE_ROOT and, if you want one, ALLOWED_USERS

mkdir -p ~/Documents/SharedFiles
npm run build
npm start
```

The app listens on `127.0.0.1:8081`. That is deliberate — see
[Security model](#security-model). Publish it to the tailnet:

```bash
sudo tailscale serve --bg --https 443 http://127.0.0.1:8081
tailscale serve status         # prints the https://<host>.<tailnet>.ts.net URL
```

Open that URL from any device on your tailnet.

### Running alongside another app

A Pi usually ends up hosting more than one thing. Two slots can collide, and
they are independent of each other:

**The loopback port.** `PORT` defaults to `8081`. If something else already has
it, pick another and set it in `.env` — the server names the conflict on startup
rather than failing with a bare `EADDRINUSE`.

```bash
sudo lsof -nP -iTCP -sTCP:LISTEN     # what is already listening
```

**The tailnet front door.** `tailscale serve` config is per-node and additive,
so adding this app does not disturb an existing one. Tailscale terminates TLS on
ports 443, 8443, and 10000. If another app already holds 443, give this one 8443:

```bash
sudo tailscale serve --bg --https 8443 http://127.0.0.1:8081
tailscale serve status               # shows every mapping on this node
```

Prefer a second port over mounting both apps under one hostname with
`--set-path`. `host:port` is a distinct browser origin, so the two apps get
separate storage and — the part that actually bites — separate service worker
scopes. This app registers a worker at scope `/` with a navigation fallback,
which on a shared origin would intercept navigations meant for the other app.

> **Do not run `tailscale serve reset`.** It clears the node's entire serve
> config, including whatever else you are hosting. To remove just this app:
> `sudo tailscale serve --https 8443 off`.

### Run it as a service

```bash
sudo cp deploy/fileshare.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fileshare

systemctl status fileshare
journalctl -u fileshare -f
```

Edit `User`, `WorkingDirectory`, and `ExecStart` in the unit first if you did not
clone to `~/apps/server-file-sharing` as the `pi` user. The unit reads no
configuration of its own — everything comes from `.env`.

### Install it on an iPhone or iPad

1. Open the `https://<host>.<tailnet>.ts.net` URL in **Safari** (not Chrome —
   only Safari can add to the home screen).
2. Share → **Add to Home Screen**.
3. Launch it from the home screen. It runs full-screen with no browser chrome.

HTTPS is what makes this work; `tailscale serve` provides a real certificate, so
no warnings and no manual trust step. On desktop Chrome or Edge, use the install
icon in the address bar.

### Updating

```bash
cd ~/apps/server-file-sharing
git pull
npm install
npm run build
sudo systemctl restart fileshare
```

---

## Configuration

All configuration is environment variables, read from `.env` in the project root.
`.env` is gitignored. `.env.example` is the documented template — copy it, do not
edit it in place, and never commit the copy.

| Variable | Default | Notes |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Leave on loopback. `tailscale serve` reaches it there. |
| `PORT` | `8081` | Any free loopback port. See [Running alongside another app](#running-alongside-another-app). |
| `NODE_ENV` | `development` | Set to `production` on the Pi (the systemd unit does). |
| `SHARE_ROOT` | `~/Documents/SharedFiles` | The library. Everything is confined to it. |
| `DATA_DIR` | `~/.local/share/fileshare` | Thumbnails and the SQLite index. Must be outside `SHARE_ROOT`; the app refuses to start otherwise. |
| `MAX_UPLOAD_BYTES` | `8589934592` (8 GiB) | Per-file ceiling. |
| `AUTH_MODE` | `tailscale` | `tailscale` or `none`. See below. |
| `ALLOWED_USERS` | *(empty)* | Comma-separated tailnet logins. Empty means any authenticated tailnet user. |
| `WRITE_USERS` | *(empty)* | Logins allowed to upload and delete. Empty means every allowed user can write. |
| `ENABLE_VIDEO_THUMBNAILS` | `true` | Set `false` if you have not installed ffmpeg. |
| `FFMPEG_PATH` | `ffmpeg` | Override if ffmpeg is not on `PATH`. |
| `THUMBNAIL_SIZE` | `480` | Long edge, in pixels. |
| `MAX_HASH_BYTES` | `2147483648` (2 GiB) | Files above this skip SHA-256 rather than pin the CPU. `0` disables the limit. |

### Read-only accounts

Give someone browse and download access without letting them change anything:

```dotenv
ALLOWED_USERS=you@example.com,housemate@example.com
WRITE_USERS=you@example.com
```

The UI hides Upload, New folder, and Delete for read-only users, and the server
rejects those routes with a 403 regardless of what the client sends.

---

## Security model

There are no secrets in this repository, and none are needed to run it.

**Identity comes from Tailscale.** `tailscale serve` terminates TLS on the Pi and
proxies to loopback, injecting the caller's tailnet login as a request header. It
strips that header from inbound requests, so a client cannot forge it. The app
additionally refuses any request that did not arrive over loopback, and rejects
requests with no identity at all.

**This is why `HOST` must stay `127.0.0.1`.** Binding to `0.0.0.0` would let
anything on your LAN reach the app directly, bypassing `tailscale serve` — and
then the identity header really would be forgeable. The loopback check is a
backstop, not the primary control.

**`AUTH_MODE=none` disables all of this** and treats every request as a trusted
local user. It exists so you can run `npm run dev` on a laptop. Never set it on
the Pi; the server logs a warning at startup if you do.

**Path confinement.** Every client-supplied path is normalised, rejected if it
contains `..`, a path separator in a name segment, or control characters, then
resolved with `realpath` and checked against the share root — so a symlink inside
the library pointing at `/etc` is neither listed nor readable.

**What is deliberately not exposed.** `/api/session` reports the hostname but not
the absolute share path, which would leak the account name of whoever runs the
service. Server errors above 500 return a generic message rather than an
exception that might name internal paths.

---

## Development

```bash
npm install
npm run dev:server     # API on :8081, watch mode
npm run dev:web        # Vite on :5173, proxies /api to :8081
```

For local development set `AUTH_MODE=none` in `.env` so requests are not rejected
for lacking a Tailscale identity, and point `SHARE_ROOT` at a scratch directory.

```bash
npm run typecheck      # both workspaces
npm run build          # web bundle, then server to server/dist
```

The service worker is disabled in dev (`devOptions.enabled: false`) so you are
never debugging a stale cache. To exercise the real PWA, run `npm run build` and
serve the built output through the API server.

### Layout

```
server/src
  config.ts              env parsing, path expansion, startup invariants
  index.ts               Fastify wiring, error handling, static hosting
  lib/auth.ts            Tailscale identity + read/write authorization
  lib/paths.ts           path normalisation and share-root confinement
  lib/filetypes.ts       extension → category, kind, and MIME
  lib/library.ts         directory listing, recursive search, sorting, disk usage
  lib/thumbnails.ts      sharp + ffmpeg generation with an on-disk cache
  lib/details.ts         streamed SHA-256, ZIP entry count
  lib/db.ts              SQLite cache for digests and thumbnail state
  lib/maintenance.ts     startup sweep for orphaned upload temp files
  routes/                session, files, transfer

web/src
  App.tsx                selection, dialogs, drag-and-drop, keyboard
  hooks/useBrowse.ts     navigation state, synced to the URL
  hooks/useUploads.ts    XHR upload queue with progress and cancel
  hooks/useConnection.ts reachability polling for the offline state
  components/            title bar, gallery, inspector, dialogs, overlays
  lib/                   API client, formatting, shared types
```

### API

All routes require an identity except `GET /api/health`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness. Unauthenticated, used for the offline banner. |
| `GET` | `/api/session` | Current user, disk usage, category list. |
| `GET` | `/api/browse` | `?path&q&category&sort&direction` — entries, chip counts, breadcrumbs. |
| `GET` | `/api/details` | `?path` — SHA-256, archive entry count. |
| `GET` | `/api/thumbnail` | `?path` — cached JPEG, 404 when unavailable. |
| `GET` | `/api/preview` | `?path` — inline bytes with range support. |
| `GET` | `/api/download` | `?path` — attachment with range support. |
| `POST` | `/api/upload` | `?path` — streaming multipart. Write access. |
| `POST` | `/api/folders` | `{path, name}`. Write access. |
| `POST` | `/api/delete` | `{paths[]}` — per-path results. Write access. |
| `POST` | `/api/bundles` | `{paths[]}` → single-use token. |
| `GET` | `/api/bundles/:token` | Streams the ZIP. Token is bound to the requesting user. |

---

## Notes and limits

- **Deletes are permanent.** There is no trash. The confirmation sheet says so.
- **Thumbnails** cover formats sharp can decode (JPEG, PNG, WebP, AVIF, HEIC,
  TIFF, GIF) plus a video poster frame via ffmpeg. SVG and camera raw fall back
  to a type badge. Generation is capped at two concurrent jobs so a large gallery
  does not saturate the Pi.
- **Archive entry counts** are read from the ZIP central directory. `.tar.gz` and
  friends would have to be decompressed end to end, so they are left blank.
- **Search** walks up to 12 levels deep and 20,000 entries from the current
  folder, which keeps a pathological tree from turning one keystroke into a
  minutes-long walk.
- **Hidden files** (anything starting with `.`) are never listed, uploaded to, or
  deleted.
- **SHA-256** is skipped above `MAX_HASH_BYTES` and cached against mtime and size
  otherwise, so the inspector is instant on the second open.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| "No Tailscale identity on this request" | You reached the app directly rather than through `tailscale serve`. Use the `.ts.net` URL. `tailscale serve status` shows the mapping. |
| No video thumbnails | `which ffmpeg`, and `ENABLE_VIDEO_THUMBNAILS=true`. |
| `sharp` fails to load after an upgrade | `npm rebuild sharp` — prebuilt binaries are tied to the Node major version. |
| Uploads fail at a certain size | `MAX_UPLOAD_BYTES`, then free space (`df -h ~/Documents/SharedFiles`). |
| Won't add to home screen on iOS | Must be Safari, and must be the HTTPS `.ts.net` URL. |
| Stale UI after a deploy | Hard-reload once; the service worker takes over on the next launch. |
