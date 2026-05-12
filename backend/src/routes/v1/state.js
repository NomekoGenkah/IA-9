const router = require('express').Router();
const engine = require('../../graph/graphEngine');
const { validateState, deserializeState } = require('../../graph/permutation');

router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (!validateState(id)) {
    return res.status(400).json({ error: 'Invalid state', received: id });
  }

  const node = engine.getNodeInfo(id);

  res.json({
    id,
    state: id,
    array: deserializeState(id),
    explored: node.neighbors !== null,
    neighborCount: node.neighbors ? node.neighbors.length : null,
    exploredAt: node.exploredAt,
  });
});

module.exports = router;
