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
  const { verkefniId, nafn, handrit, lesari, take, googleDocId } = req.body;
  try {
    await broadcastToBooth({
      type: 'handrit',
      verkefniId,
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

// Update handrit in booth (for live editing)
router.post('/update-handrit', async (req, res) => {
  const { verkefniId, handrit, nafn, lesari } = req.body;
  const currentState = getBoothState();

  // Only update if this is the same project currently in booth
  if (currentState.verkefniId && currentState.verkefniId === verkefniId) {
    try {
      await broadcastToBooth({
        type: 'handrit',
        verkefniId,
        nafn: nafn || currentState.nafn,
        handrit,
        lesari: lesari || currentState.lesari,
        take: currentState.take,
      });
      res.json({ message: 'Booth updated' });
    } catch (err) {
      console.error('Booth update error:', err);
      res.status(500).json({ error: 'Failed to update booth' });
    }
  } else {
    res.json({ message: 'Not the active project in booth', skipped: true });
  }
});

module.exports = { router, setAblyRest };
