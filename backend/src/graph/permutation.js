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

module.exports = {
  validateState,
  generateNeighbors,
  randomState,
  serializeState,
  deserializeState,
};
