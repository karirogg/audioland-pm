// routes/timi.js - Time tracking

const express = require('express');
const router = express.Router();
const { dbAll, dbRun } = require('../database/helpers');

// Get time entries for a project
router.get('/verkefni/:id/timi', async (req, res) => {
  try {
    const timi = await dbAll(
      'SELECT * FROM timaskraning WHERE verkefni_id = ? ORDER BY dagsetning DESC',
      [req.params.id]
    );
    res.json(timi);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add time entry
router.post('/verkefni/:id/timi', async (req, res) => {
  try {
    const { tegund, titill, lysing, timi_minutur, dagsetning } = req.body;
    const result = await dbRun(
      `
      INSERT INTO timaskraning (verkefni_id, tegund, titill, lysing, timi_minutur, dagsetning)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        req.params.id,
        tegund || '',
        titill || '',
        lysing || '',
        timi_minutur || 0,
        dagsetning || '',
      ]
    );
    res.json({ id: result.lastInsertRowid, message: 'Tímaskráning bætt við' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete time entry
router.delete('/timi/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM timaskraning WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tímaskráning eytt' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
