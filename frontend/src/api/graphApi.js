// All requests go through Vite's proxy (/api → backend service).
const BASE = '/api/v1';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

export const getState     = (id) => fetchJson(`${BASE}/state/${id}`);
export const getNeighbors = (id) => fetchJson(`${BASE}/neighbors/${id}`);
export const getRandom    = ()   => fetchJson(`${BASE}/random`);
export const getHealth    = ()   => fetchJson(`${BASE}/health`);
export const solvePath    = (id) => fetchJson(`${BASE}/solve/${id}`);
