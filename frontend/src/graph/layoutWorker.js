/**
 * Layout worker — builds the full 362,880-node layout off the main thread.
 *
 * Output is a set of flat typed arrays (transferred, not copied) so the main
 * thread never holds per-node objects:
 *   positions[2r], positions[2r+1]   world x,y of rank r
 *   level[r]                          inversion count (0..36) of rank r
 *   levelOffset[L]                    start index of level L inside rankByIndex
 *   levelSize[L]                      number of nodes in level L
 *   rankByIndex[levelOffset[L]+i]     the rank sitting at column i of level L
 *
 * The last two enable O(1) picking: from a world point we derive (L, column)
 * and read the rank directly — no spatial search over 362k points.
 *
 * Layout = the Mahonian "diamond": Y is inversion count (distance to the
 * 123456789 target), X spreads each level around the centre.
 */

import { TOTAL, MAX_LEVEL, unrankArr, inversionsOfArr } from './permIndex.js';

function build() {
  const positions = new Float32Array(TOTAL * 2);
  const level = new Uint8Array(TOTAL);
  const levelSize = new Int32Array(MAX_LEVEL + 1);
  const levelOffset = new Int32Array(MAX_LEVEL + 2);
  const rankByIndex = new Int32Array(TOTAL);

  // Pass 1 — classify every rank by its inversion count.
  for (let r = 0; r < TOTAL; r++) {
    const L = inversionsOfArr(unrankArr(r));
    level[r] = L;
    levelSize[L]++;
  }

  // Prefix offsets into rankByIndex.
  for (let L = 0; L <= MAX_LEVEL; L++) levelOffset[L + 1] = levelOffset[L] + levelSize[L];

  // Layout scale: keep columns 1 world-unit apart; pick row height so the
  // diamond reads slightly wider than tall (the Mahonian shape is naturally wide).
  let maxSize = 0;
  for (let L = 0; L <= MAX_LEVEL; L++) if (levelSize[L] > maxSize) maxSize = levelSize[L];
  const colSpacing = 1;
  const rowHeight = Math.max(1, maxSize / 70);

  // Pass 2 — place each node and record its column slot.
  const cursor = Int32Array.from(levelOffset); // running write head per level
  for (let r = 0; r < TOTAL; r++) {
    const L = level[r];
    const slot = cursor[L]++;
    const i = slot - levelOffset[L];
    positions[r * 2] = (i - (levelSize[L] - 1) / 2) * colSpacing;
    positions[r * 2 + 1] = (MAX_LEVEL - L) * rowHeight; // identity (L=0) on top
    rankByIndex[slot] = r;
  }

  const bounds = {
    minX: -((maxSize - 1) / 2) * colSpacing,
    maxX: ((maxSize - 1) / 2) * colSpacing,
    minY: 0,
    maxY: MAX_LEVEL * rowHeight,
  };

  return {
    positions, level, levelSize, levelOffset, rankByIndex,
    rowHeight, colSpacing, bounds, total: TOTAL, maxLevel: MAX_LEVEL,
  };
}

self.onmessage = () => {
  const t0 = (self.performance || Date).now();
  const data = build();
  const buildMs = Math.round((self.performance || Date).now() - t0);
  self.postMessage({ ...data, buildMs }, [
    data.positions.buffer,
    data.level.buffer,
    data.levelSize.buffer,
    data.levelOffset.buffer,
    data.rankByIndex.buffer,
  ]);
};
