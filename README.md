# ATLAS_DASH

Web dashboard for Brandpreneur ops: documents, tasks, CRM, forms, Hermes chat, VPS folders, and an in-browser VPS shell. Served at [atlasdash.brandpreneur.net](https://atlasdash.brandpreneur.net).

## Stack

- **React 19 + Vite + TypeScript** — browser UI
- **Zustand + Dexie** — client state and IndexedDB persistence
- **TipTap** — rich text editor
- **`server/`** — Node API on the VPS (`/fs/*`, `/hermes/*`, `/terminal`)
- **Caddy + Docker Compose** — TLS, basic-auth, static web + API

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:1420](http://localhost:1420).

Full gate:

```bash
npm run check
```

Server tests (when touching `server/`):

```bash
cd server
npm test
```

## Deploy

See [docs/ATLAS_DASH_DEPLOY.md](docs/ATLAS_DASH_DEPLOY.md) and the `/atlas-dash-vps-deploy` skill.

## Notes

- Desktop/Tauri packaging has been removed; this repo is web-only.
- Historical plans under `docs/` that mention Tauri or the old TABS desktop app are evidence only.
