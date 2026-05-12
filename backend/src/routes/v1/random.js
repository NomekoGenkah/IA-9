const router = require('express').Router();
const { randomState, deserializeState } = require('../../graph/permutation');

router.get('/', (_req, res) => {
  const state = randomState();
  res.json({
    id: state,
    state,
    array: deserializeState(state),
  });
});

module.exports = router;
