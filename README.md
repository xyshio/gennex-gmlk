# gennex

Solo genealogy app. Family tree + tabular browser with JSON-file storage and (planned) GEDCOM import/export.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- TanStack Query + TanStack Table
- Zod (input validation)
- File-based storage at `data/family.json`

## Quick start

```bash
cd c:/work/gennex
npm install
npm run dev
```

Open http://localhost:3000

## Where data lives

- `data/family.json` — single source of truth for persons + relationships
- `data/photos/{personId}/{uuid}.jpg` — photo binaries (UI lands later)
- `data/family.{YYYY-MM-DD}.bak.json` — automatic daily backup (overwritten same day)

Back up = copy `data/` directory. Commit it to git for full history.

## Deployment

- `npm run build` → standalone Next.js output in `.next/standalone/`
- Copy `.next/standalone/` + `data/` to any Node-capable VPS / Docker host
- **Not Vercel-compatible** — filesystem is ephemeral on serverless platforms

## Roadmap

- [x] Persons CRUD (table + form)
- [x] Relationships data model + REST API
- [ ] Relationships UI (add spouse / parent / child from person page)
- [ ] Photo upload + per-person gallery
- [ ] Visual tree view (react-flow + dagre)
- [ ] GEDCOM import (start with MyHeritage export)
- [ ] GEDCOM export
- [ ] Full-text search across notes / places
