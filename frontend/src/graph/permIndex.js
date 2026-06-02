/**
 * Permutation indexing for the global "universe" view — pure, no dependencies.
 *
 * The whole point: a permutation of 1-9 is fully described by a single integer
 * (its rank, 0 .. 362879). We never store the 362,880 strings — we derive any
 * id from its rank on demand. This is what keeps the global view cheap.
 */

export const N = 9;
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880]; // 0! .. 9!
export const TOTAL = FACT[N];               // 362880
export const MAX_LEVEL = (N * (N - 1)) / 2; // 36 = max inversions
export const TARGET = '123456789';

// rank -> permutation array [d0..d8] (avoids string alloc; used in hot loops).
export function unrankArr(r) {
  const elems = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let rem = r;
  const out = new Array(N);
  for (let i = 0; i < N; i++) {
    const f = FACT[N - 1 - i];
    const idx = (rem / f) | 0;
    rem -= idx * f;
    out[i] = elems[idx];
    elems.splice(idx, 1);
  }
  return out;
}

export const unrank = (r) => unrankArr(r).join('');

// permutation string -> rank.
export function rank(state) {
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

// Inversions of a permutation array = graph distance to TARGET.
export function inversionsOfArr(arr) {
  let inv = 0;
  for (let i = 0; i < N; i++) {
    const a = arr[i];
    for (let j = i + 1; j < N; j++) if (a > arr[j]) inv++;
  }
  return inv;
}

// The 8 neighbours of a state (one adjacent swap each), as rank integers.
export function neighborRanks(state) {
  const out = new Array(N - 1);
  for (let i = 0; i < N - 1; i++) {
    const arr = state.split('');
    const t = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = t;
    out[i] = rank(arr.join(''));
  }
  return out;
}
