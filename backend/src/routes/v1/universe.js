const router = require('express').Router();
const {
  TOTAL,
  MAX_INVERSIONS,
  inversionDistribution,
} = require('../../graph/permutation');

const TARGET = '123456789';

// Metadata about the *entire* state space — cheap, computed once, no enumeration.
// The frontend "universe" (global map) view uses this for its stats/legend and
// to cross-check the layout it builds locally in a Web Worker.
const LEVELS = inversionDistribution(); // permutations grouped by inversion count
const META = Object.freeze({
  total: TOTAL,                 // 362880
  target: TARGET,               // the 0-inversion node every solve path leads to
  maxLevel: MAX_INVERSIONS,     // 36
  levelCount: MAX_INVERSIONS + 1, // 37 layers (0..36 inversions)
  // levels[k] = number of permutations with exactly k inversions (Mahonian row).
  levels: LEVELS,
  peakLevel: LEVELS.indexOf(Math.max(...LEVELS)), // widest layer (18)
  peakSize: Math.max(...LEVELS),
});

router.get('/', (_req, res) => {
  res.json(META);
});

module.exports = router;
