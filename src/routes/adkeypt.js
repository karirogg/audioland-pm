// routes/adkeypt.js - Purchased music

const express = require('express');
const router = express.Router();
const { dbAll, dbRun } = require('../database/helpers');

// Get purchased music for a project
router.get('/verkefni/:id/adkeypt', async (req, res) => {
  try {
    const adkeypt = await dbAll(
      'SELECT * FROM adkeypt WHERE verkefni_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(adkeypt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add purchased music
router.post('/verkefni/:id/adkeypt', async (req, res) => {
  try {
    const { titill, heimild, url, kostnadur } = req.body;
    const result = await dbRun(
      `
      INSERT INTO adkeypt (verkefni_id, titill, heimild, url, kostnadur)
      VALUES (?, ?, ?, ?, ?)
    `,
      [req.params.id, titill || '', heimild || '', url || '', kostnadur || 0]
    );
    res.json({ id: result.lastInsertRowid, message: 'Lagi bætt við' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete purchased music
router.delete('/adkeypt/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM adkeypt WHERE id = ?', [req.params.id]);
    res.json({ message: 'Lagi eytt' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
