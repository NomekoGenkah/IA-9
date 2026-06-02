/**
 * Local solve — minimum-length path from a state to the sorted target.
 * Pure, runs in-browser (no network).
 *
 * Each adjacent swap reduces the inversion count by exactly 1, so bubble-sort
 * yields the shortest path (length = number of inversions, max 36).
 */

import { TARGET } from './permIndex.js';

const deserialize = (str) => str.split('').map(Number);

export function solvePath(startState) {
  let path;
  if (startState === TARGET) {
    path = [startState];
  } else {
    path = [startState];
    let arr = startState.split('').map(Number);

    for (let step = 0; step < 37; step++) {
      let swapped = false;
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] > arr[i + 1]) {
          const next = [...arr];
          [next[i], next[i + 1]] = [next[i + 1], next[i]];
          arr = next;
          path.push(arr.join(''));
          swapped = true;
          break;
        }
      }
      if (!swapped) break;
      if (arr.join('') === TARGET) break;
    }
  }

  return {
    start: startState,
    target: TARGET,
    steps: path.length - 1,
    path: path.map((state, i) => ({
      id: state,
      state,
      step: i,
      array: deserialize(state),
    })),
  };
}
