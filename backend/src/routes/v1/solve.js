const router = require('express').Router();
const { validateState, deserializeState } = require('../../graph/permutation');

const TARGET = '123456789';

// Bubble-sort path: each adjacent swap reduces inversions by exactly 1,
// so this gives the minimum-length path (length = number of inversions, max 36).
function solvePath(startState) {
  if (startState === TARGET) return [startState];

  const path = [startState];
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

  return path;
}

router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (!validateState(id)) {
    return res.status(400).json({ error: 'Invalid state', received: id });
  }

  const path = solvePath(id);

  res.json({
    start: id,
    target: TARGET,
    steps: path.length - 1,
    path: path.map((state, i) => ({
      id: state,
      state,
      step: i,
      array: deserializeState(state),
    })),
  });
});

module.exports = router;
