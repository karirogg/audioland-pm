// booth/routes.js - Booth API routes

const express = require('express');
const router = express.Router();
const config = require('../config');
const { getBoothState } = require('./state');
const { broadcastToBooth } = require('./broadcast');

// Ably reference (will be set from index.js)
let ablyRest = null;

function setAblyRest(ably) {
  ablyRest = ably;
}

// Get current booth state
router.get('/state', (req, res) => {
  res.json(getBoothState());
});

// Send to booth
router.post('/send', async (req, res) => {
  const { nafn, handrit, lesari, take, googleDocId } = req.body;
  try {
    await broadcastToBooth({
      type: 'handrit',
      nafn,
      handrit,
      lesari,
      googleDocId,
      take: take || 1,
    });
    res.json({ message: 'Sent í booth' });
  } catch (err) {
    console.error('Booth send error:', err);
    res.status(500).json({ error: 'Failed to send to booth' });
  }
});

module.exports = { router, setAblyRest };
