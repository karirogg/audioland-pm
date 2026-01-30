// routes/tengilidir.js - Contacts API with auto-fill support

const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../database/helpers');

// Get all contacts, optionally filtered by type
router.get('/', async (req, res) => {
  try {
    const { tegund } = req.query;
    let tengilidir;
    if (tegund) {
      tengilidir = await dbAll(
        'SELECT * FROM tengilidir WHERE tegund = ? ORDER BY nafn',
        [tegund]
      );
    } else {
      tengilidir = await dbAll('SELECT * FROM tengilidir ORDER BY tegund, nafn');
    }
    res.json(tengilidir);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get contact by type and name (for auto-fill)
router.get('/lookup', async (req, res) => {
  try {
    const { tegund, nafn } = req.query;
    if (!tegund || !nafn) {
      return res.status(400).json({ error: 'tegund and nafn required' });
    }
    const contact = await dbGet(
      'SELECT * FROM tengilidir WHERE tegund = ? AND nafn = ?',
      [tegund, nafn]
    );
    res.json(contact || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or update contact
router.post('/', async (req, res) => {
  try {
    const { tegund, nafn, simi, netfang } = req.body;
    if (!tegund || !nafn) {
      return res.status(400).json({ error: 'tegund and nafn required' });
    }

    // Use INSERT OR REPLACE to update if exists
    await dbRun(
      `INSERT INTO tengilidir (tegund, nafn, simi, netfang)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tegund, nafn) DO UPDATE SET
       simi = excluded.simi,
       netfang = excluded.netfang`,
      [tegund, nafn, simi || '', netfang || '']
    );
    res.json({ message: 'Tengiliður vistaður' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
