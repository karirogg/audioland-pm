// routes/ably-token.js - Ably token authentication

const express = require('express');
const router = express.Router();
const config = require('../config');
const { getAblyRest } = require('../realtime/ably');

// Ably token auth for clients (production only)
router.get('/ably-token', async (req, res) => {
  const ablyRest = getAblyRest();

  if (!config.isProduction || !ablyRest) {
    return res.status(400).json({ error: 'Ably not available in development mode' });
  }

  try {
    const tokenRequest = await ablyRest.auth.createTokenRequest({
      capability: { booth: ['subscribe', 'history'] },
    });
    res.json(tokenRequest);
  } catch (err) {
    console.error('Ably token error:', err);
    res.status(500).json({ error: 'Failed to create token' });
  }
});

module.exports = router;
