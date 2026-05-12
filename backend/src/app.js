const express = require('express');
const cors = require('cors');

const healthRouter = require('./routes/v1/health');
const stateRouter = require('./routes/v1/state');
const neighborsRouter = require('./routes/v1/neighbors');
const randomRouter = require('./routes/v1/random');
const solveRouter = require('./routes/v1/solve');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/state', stateRouter);
app.use('/api/v1/neighbors', neighborsRouter);
app.use('/api/v1/random', randomRouter);
app.use('/api/v1/solve', solveRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
