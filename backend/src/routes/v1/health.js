const router = require('express').Router();
const engine = require('../../graph/graphEngine');

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stats: engine.getStats(),
  });
});

module.exports = router;
