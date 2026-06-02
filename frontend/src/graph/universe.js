/**
 * Local universe metadata — describes the whole state space.
 * Pure, runs in-browser (no network).
 *
 * Everything here is cheap, computed once, with no enumeration of the 362,880
 * permutations. The global map view uses it for its stats/legend.
 */

import { TOTAL, MAX_LEVEL, TARGET } from './permIndex.js';

// Exact count of permutations of [1..n] by inversion number, via the generating
// polynomial product_{i=1..n}(1 + q + ... + q^{i-1}). No enumeration.
function inversionDistribution(n = 9) {
  let dist = [1];
  for (let i = 1; i <= n; i++) {
    const next = new Array(dist.length + i - 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      for (let j = 0; j < i; j++) next[k + j] += dist[k];
    }
    dist = next;
  }
  return dist; // length = MAX_LEVEL + 1
}

const LEVELS = inversionDistribution(); // permutations grouped by inversion count

export const UNIVERSE_META = Object.freeze({
  total: TOTAL,                   // 362880
  target: TARGET,                 // the 0-inversion node every solve path leads to
  maxLevel: MAX_LEVEL,            // 36
  levelCount: MAX_LEVEL + 1,      // 37 layers (0..36 inversions)
  // levels[k] = number of permutations with exactly k inversions (Mahonian row).
  levels: LEVELS,
  peakLevel: LEVELS.indexOf(Math.max(...LEVELS)), // widest layer (18)
  peakSize: Math.max(...LEVELS),
});
