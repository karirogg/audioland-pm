// routes/config.js - Client configuration endpoint

const express = require('express');
const router = express.Router();
const config = require('../config');

// Config endpoint - tells client whether to use Ably or WebSocket
router.get('/config', (req, res) => {
  res.json({
    useAbly: config.useAbly,
    nodeEnv: config.nodeEnv,
  });
});

module.exports = router;
