# IA-9 — Permutation State-Space Universe

A fullstack web application that renders the **entire** state-space of the permutations
of 1–9 at once: all **9! = 362,880** nodes drawn as a single WebGL point field.
Each node is a permutation (e.g. `362841957`); edges connect states reachable by a single
adjacent swap. The layout is the Mahonian "diamond" — Y is the inversion count (distance to
`123456789`), colour is parity (the even/odd bipartition).

---

## Quick Start

```bash
docker compose up --build
```

- **Frontend:** http://localhost:5173  
- **Backend API:** http://localhost:3001/api/v1/health

---

## Usage

1. The app loads the full 362,880-node map (built once in a Web Worker).
2. **Scroll** to zoom, **drag** to pan, **double-click** a node to zoom into it.
3. Zoom in past the threshold and each visible node's **3×3 matrix** fades in.
4. **Click** a node to select it, then **resolver** to travel its minimum path to
   `123456789` step by step (← / → / ▶ auto-play).
5. Use **Ajustar** to re-fit the whole map.

> The UI is in Spanish.

---

## Architecture

```
IA-9/
├── backend/
│   ├── src/
│   │   ├── graph/
│   │   │   ├── permutation.js      # pure fns: validate, generate, rank/unrank, inversions
│   │   │   └── graphEngine.js      # lazy graph cache (singleton)
│   │   ├── routes/v1/
│   │   │   ├── health.js
│   │   │   ├── state.js
│   │   │   ├── neighbors.js
│   │   │   ├── random.js
│   │   │   ├── solve.js
│   │   │   └── universe.js         # whole-graph metadata (no enumeration)
│   │   ├── app.js                  # Express app + routing
│   │   └── server.js               # HTTP server entry point
│   ├── package.json
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── graphApi.js         # REST client (relative URLs, proxied by Vite)
│   │   ├── graph/
│   │   │   ├── permIndex.js        # rank/unrank/inversions/neighbours
│   │   │   ├── layoutWorker.js     # builds full layout off-thread (typed arrays)
│   │   │   └── pointField.js       # WebGL point/line renderer (one draw call)
│   │   ├── pages/
│   │   │   └── GlobalUniverse.jsx  # full 362,880-node WebGL map (the whole UI)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## Backend graph engine (lazy)

The total graph has **9! = 362,880 nodes**. The backend never materializes it: it exposes
pure indexing math (`rank`/`unrank`/`countInversions`) plus on-demand endpoints.

- `graphEngine.js` keeps an in-memory `Map` and computes a node's neighbours only when
  `GET /api/v1/neighbors/:id` is called (still available for ad-hoc queries / future tools).
- `permutation.js` is the authoritative indexing source, mirrored on the frontend so both
  sides agree on positions without shipping the graph.

---

## Global Universe View

The whole UI is the **Universe**: it shows **all 362,880 states at once** without breaking
efficiency.

How it stays cheap:

- **No per-node objects.** Every permutation is addressed by an integer rank
  (`0 .. 362879`). Its id is derived on demand via `unrank()`; the graph is never
  materialized as strings or edge lists.
- **Layout precomputed in a Web Worker.** Positions are built once into flat
  `Float32Array`/`Uint8Array` buffers (~3 MB) and transferred to the main thread —
  no force layout at runtime.
- **One WebGL draw call** renders all nodes as GPU points (`frontend/src/graph/pointField.js`).
  Pan/zoom only updates a uniform.
- **Edges stay lazy.** The 1.45 M edges are never drawn in bulk — only the hovered
  node's 8 neighbours and the highlighted `solve` path (constant-width quads).
- **LOD labels.** Nodes are GL points when zoomed out; once you zoom in past a
  threshold, the 3×3 matrices of the *visible* nodes fade in on a 2D overlay
  (only viewport-visible nodes are enumerated, so cost stays bounded).
  Double-click a node to jump straight to that zoom level.
- **Journey mode.** Select a node and hit `solve` to travel its minimum path to
  `123456789` one swap at a time: the camera flies to each node (← / → step,
  ▶ auto-play), the travelled portion of the path lights up, and the current
  node is framed. One layer up per step (inversions decrease monotonically).

The layout is the **Mahonian diamond**: the Y axis is the inversion count (= graph
distance to `123456789`, the `solve` target), and colour encodes parity — the
bipartite split into 181,440 even / 181,440 odd permutations. Picking is O(1) via a
`(layer, column) → rank` reverse index.

Backend math (`rank`, `unrank`, `countInversions`, `inversionDistribution`) lives in
`backend/src/graph/permutation.js` and is mirrored in `frontend/src/graph/permIndex.js`.

---

## State Model

A state is a 9-character string: `"362841957"`.

**Transition rule (current):** swap any two adjacent elements.

```
123456789  →  213456789  (swap positions 0,1)
           →  132456789  (swap positions 1,2)
           →  ...        (8 total neighbors)
```

Every permutation has exactly **8 neighbors** (8 possible adjacent swaps).

The graph is symmetric and undirected — swapping back is always a valid transition.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Server health + cache stats |
| GET | `/api/v1/random` | Random valid permutation |
| GET | `/api/v1/state/:id` | Node info (explored status, neighbor count) |
| GET | `/api/v1/neighbors/:id` | Expand node — returns all neighbors |
| GET | `/api/v1/solve/:id` | Minimum adjacent-swap path to `123456789` |
| GET | `/api/v1/universe` | Whole-graph metadata (total, target, inversion distribution) |

All states are validated: must contain digits 1–9 each exactly once.

---

## Local Development (without Docker)

**Backend:**
```bash
cd backend
npm install
npm run dev       # nodemon on port 3001
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev       # Vite on port 5173, proxies /api → localhost:3001
```

---

## Extending the Graph

The architecture is designed to support richer transition rules without restructuring:

- **New transition rules:** Add a function in `permutation.js` and wire it in `graphEngine.js`.
- **Search algorithms (BFS/DFS):** Add `services/searchService.js`; `expandNode` is the traversal primitive.
- **Persistence:** Replace the `Map` in `graphEngine.js` with a SQLite/Redis adapter.
- **Conditional transitions:** Add rule predicates to `generateNeighbors` or compose multiple rule sets.
- **Inference/annotation layers:** Add a `services/inferenceService.js` that annotates nodes before returning them.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 4 |
| Graph viz | Custom WebGL renderer + Web Worker layout (no external graph lib) |
| Backend | Node.js 20, Express 4 |
| Containers | Docker, Docker Compose |
