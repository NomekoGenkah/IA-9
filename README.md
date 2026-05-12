# IA-9 — Permutation Graph Explorer

A fullstack web application for exploring the state-space graph of permutations of numbers 1–9.  
Each node is a permutation (e.g. `362841957`). Edges connect states reachable by a single adjacent swap.  
The graph is never precomputed — it expands lazily, one node at a time, driven by user interaction.

---

## Quick Start

```bash
docker compose up --build
```

- **Frontend:** http://localhost:5173  
- **Backend API:** http://localhost:3001/api/v1/health

---

## Usage

1. The app loads with a single random starting node.
2. **Click any node** to fetch and render its neighbors.
3. Keep clicking to explore the graph progressively.
4. Use **+ Random** to jump to a new unexplored node.
5. Use **Fit** to re-center the view.
6. Use **Reset** to clear and start from a new seed.

---

## Architecture

```
IA-9/
├── backend/
│   ├── src/
│   │   ├── graph/
│   │   │   ├── permutation.js      # pure functions: validate, generate, random
│   │   │   └── graphEngine.js      # lazy graph cache (singleton)
│   │   ├── routes/v1/
│   │   │   ├── health.js
│   │   │   ├── state.js
│   │   │   ├── neighbors.js
│   │   │   └── random.js
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
│   │   │   ├── cytoscapeConfig.js  # styles + cose layout params
│   │   │   └── graphManager.js     # cytoscape wrapper: add/connect/layout
│   │   ├── components/
│   │   │   ├── GraphControls.jsx
│   │   │   ├── NodeInfo.jsx
│   │   │   └── StatusBar.jsx
│   │   ├── pages/
│   │   │   └── GraphExplorer.jsx   # main page: cytoscape lifecycle + interaction
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

## Lazy Graph Generation

The total graph has **9! = 362,880 nodes**. Loading it upfront would be impractical.

Instead, the backend uses a **lazy expansion model**:

- `graphEngine.js` holds an in-memory `Map` of known nodes.
- A node starts as a **stub** (known ID, no neighbors computed yet).
- Only when `GET /api/v1/neighbors/:id` is called does the engine compute that node's neighbors (by generating all adjacent-swap permutations) and cache the result.
- Neighbor stubs are registered as known but unexplored.
- The frontend mirrors this: nodes appear as dashed/dim until clicked, then expand and transition to a solid explored style.

This means the working set in memory at any time is only the explored frontier — not the full 362,880-node graph.

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
| Graph viz | Cytoscape.js (cose layout) |
| Backend | Node.js 20, Express 4 |
| Containers | Docker, Docker Compose |
