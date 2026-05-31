/**
 * Core permutation logic — stateless pure functions.
 * A "state" is a 9-character string of digits 1-9, each appearing exactly once.
 */

function validateState(state) {
  if (typeof state !== 'string' || state.length !== 9) return false;
  const digits = state.split('').map(Number);
  if (digits.some((d) => isNaN(d) || d < 1 || d > 9)) return false;
  return [...digits].sort((a, b) => a - b).join('') === '123456789';
}

// Transition rule: swap every pair of adjacent elements.
function generateNeighbors(state) {
  if (!validateState(state)) return [];
  const arr = state.split('');
  const neighbors = [];
  for (let i = 0; i < arr.length - 1; i++) {
    const next = [...arr];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    neighbors.push(next.join(''));
  }
  return neighbors;
}

function randomState() {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

const serializeState = (arr) => arr.join('');
const deserializeState = (str) => str.split('').map(Number);

// ── Indexing & metrics (factorial number system) ────────────────────────────
// These let any permutation be addressed by a single integer (its rank,
// 0 .. 9!-1) without ever storing the graph. The frontend layout worker mirrors
// this math so both sides agree on positions.

const N = 9;
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880]; // 0! .. 9!
const TOTAL = FACT[N]; // 362880
const MAX_INVERSIONS = (N * (N - 1)) / 2; // 36

// Number of inversions = graph distance to the sorted target (each adjacent
// swap changes the inversion count by exactly 1).
function countInversions(state) {
  let inv = 0;
  for (let i = 0; i < N; i++) {
    const a = state.charCodeAt(i);
    for (let j = i + 1; j < N; j++) {
      if (a > state.charCodeAt(j)) inv++;
    }
  }
  return inv;
}

// Map a permutation string -> its rank in lexicographic order (0-based).
function rank(state) {
  const elems = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let r = 0;
  for (let i = 0; i < N; i++) {
    const d = state.charCodeAt(i) - 48;
    const idx = elems.indexOf(d);
    r += idx * FACT[N - 1 - i];
    elems.splice(idx, 1);
  }
  return r;
}

// Map a rank -> its permutation string. Inverse of rank().
function unrank(r) {
  const elems = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let rem = r;
  const out = [];
  for (let i = N; i >= 1; i--) {
    const f = FACT[i - 1];
    const idx = Math.floor(rem / f);
    rem -= idx * f;
    out.push(elems[idx]);
    elems.splice(idx, 1);
  }
  return out.join('');
}

// Exact count of permutations of [1..n] by inversion number, via the
// generating polynomial product_{i=1..n}(1 + q + ... + q^{i-1}). No enumeration.
function inversionDistribution(n = N) {
  let dist = [1];
  for (let i = 1; i <= n; i++) {
    const next = new Array(dist.length + i - 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      for (let j = 0; j < i; j++) next[k + j] += dist[k];
    }
    dist = next;
  }
  return dist; // length = MAX_INVERSIONS + 1
}

module.exports = {
  validateState,
  generateNeighbors,
  randomState,
  serializeState,
  deserializeState,
  countInversions,
  rank,
  unrank,
  inversionDistribution,
  TOTAL,
  MAX_INVERSIONS,
};
