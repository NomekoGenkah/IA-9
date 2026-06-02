# IA-9 — Permutation State-Space Universe

A **fully static, frontend-only** web app that renders the **entire** state-space of the
permutations of 1–9 at once: all **9! = 362,880** nodes drawn as a single WebGL point field.
Each node is a permutation (e.g. `362841957`); edges connect states reachable by a single
adjacent swap. The layout is the Mahonian "diamond" — Y is the inversion count (distance to
`123456789`), colour is parity (the even/odd bipartition).

All computation runs **in the browser** — there is no backend, no API, no server. The app
can be served from any static host (e.g. GitHub Pages).

---

## Quick Start

```bash
cd frontend
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

Or via Docker (local dev convenience only):

```bash
docker compose up --build   # frontend on http://localhost:5173
```

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
├── frontend/                       # the entire app — self-contained, static
│   ├── src/
│   │   ├── api/
│   │   │   └── graphApi.js         # local logic adapter (no network, async shims)
│   │   ├── graph/
│   │   │   ├── permIndex.js        # rank/unrank/inversions/neighbours
│   │   │   ├── solve.js            # minimum adjacent-swap path (local)
│   │   │   ├── universe.js         # whole-graph metadata (local, no enumeration)
│   │   │   ├── layoutWorker.js     # builds full layout off-thread (typed arrays)
│   │   │   └── pointField.js       # WebGL point/line renderer (one draw call)
│   │   ├── pages/
│   │   │   └── GlobalUniverse.jsx  # full 362,880-node WebGL map (the whole UI)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.js              # base: '/IA-9/' for GitHub Pages
│   ├── package.json
│   └── Dockerfile
│
├── .github/workflows/deploy.yml    # builds & deploys frontend to GitHub Pages
├── docker-compose.yml              # local dev only (frontend service)
└── README.md
```

---

## How it stays serverless

The total graph has **9! = 362,880 nodes**, but it is never materialized. Everything is
pure indexing math (`rank`/`unrank`/`countInversions`) that runs in the browser:

- `frontend/src/graph/permIndex.js` is the authoritative indexing source.
- `solve.js` computes a state's minimum path locally (bubble-sort over inversions).
- `universe.js` computes whole-graph metadata locally (Mahonian inversion distribution),
  with no enumeration.
- `graphApi.js` keeps the original `solvePath` / `getUniverse` signatures (now async shims
  over local functions), so the UI code is unchanged.

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

The indexing math (`rank`, `unrank`, `inversions`, `inversionDistribution`) lives in
`frontend/src/graph/` (`permIndex.js`, `universe.js`).

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

## Local logic (formerly the API)

These were REST endpoints; they are now plain functions running in the browser.

| Function | Location | Description |
|----------|----------|-------------|
| `solvePath(id)` | `graph/solve.js` | Minimum adjacent-swap path to `123456789` |
| `getUniverse()` / `UNIVERSE_META` | `graph/universe.js` | Whole-graph metadata (total, target, inversion distribution) |
| `rank` / `unrank` / `neighborRanks` | `graph/permIndex.js` | Permutation indexing and neighbours |

States are validated to contain digits 1–9 each exactly once.

---

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` builds `frontend/` and publishes `frontend/dist` to Pages on
every push to `main`. To enable: **Settings → Pages → Build and deployment → Source: GitHub
Actions**. The site is served at `https://<user>.github.io/IA-9/`.

The Pages sub-path is set via `base: '/IA-9/'` in `vite.config.js`. If you fork/rename the
repo, update that (or pass `VITE_BASE=/your-repo/ npm run build`).

A static `npm run build` (output in `frontend/dist/`) can also be hosted on any static host
(Netlify, Vercel, Cloudflare Pages, S3…).

---

## Local Development

```bash
cd frontend
npm install
npm run dev        # Vite dev server on port 5173
npm run build      # static production build → frontend/dist
npm run preview    # serve the production build locally
```

---

## Extending the Graph

The architecture supports richer transition rules without restructuring:

- **New transition rules:** Add a neighbour function in `frontend/src/graph/permIndex.js`.
- **Search algorithms (BFS/DFS):** Operate over ranks using `neighborRanks` as the primitive.
- **Different solve strategies:** Swap out `frontend/src/graph/solve.js`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App | React 18, Vite 4 — static, frontend-only |
| Graph viz | Custom WebGL renderer + Web Worker layout (no external graph lib) |
| Compute | Pure in-browser permutation indexing (no backend) |
| Hosting | Static (GitHub Pages via GitHub Actions) |
