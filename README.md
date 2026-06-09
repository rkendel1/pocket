# Passion Curator MVP

Device-friendly full-stack MVP for a personal inspiration aggregator with a lightweight insight engine.

## What is included

- **Half-sheet capture**: title, link/media, note, tags, board, lane, mood, optional public sharing.
- **Organization views**: Kanban lanes, moodboard grid, timeline, and a connection graph.
- **Discover**: live search, recommendations from your own library, and opt-in public curations.
- **Analysis**: topic clustering, interest heatmap, reflection digest, and generated passion report.
- **Infrastructure**: React + Vite frontend, Express API, SQLite persistence, polling-based multi-device sync.

## Run locally

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:8787`

## Scripts

- `npm run dev` – run frontend + backend together
- `npm run lint` – lint frontend/backend TypeScript
- `npm run test` – focused insight engine tests
- `npm run build` – build frontend
- `npm run start:server` – run backend API only
