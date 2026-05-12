const router = require('express').Router();
const engine = require('../../graph/graphEngine');
const { validateState, deserializeState } = require('../../graph/permutation');

router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (!validateState(id)) {
    return res.status(400).json({ error: 'Invalid state', received: id });
  }

  const node = engine.expandNode(id);

  const neighbors = node.neighbors.map((nId) => {
    const nInfo = engine.getNodeInfo(nId);
    return {
      id: nId,
      state: nId,
      array: deserializeState(nId),
      explored: nInfo.neighbors !== null,
    };
  });

  res.json({
    id,
    state: id,
    neighbors,
    total: neighbors.length,
  });
});

module.exports = router;
