// routes/lesendur.js - Voice actors API

const express = require('express');
const router = express.Router();
const { dbAll, dbRun } = require('../database/helpers');

// Get all lesendur
router.get('/', async (req, res) => {
  try {
    const lesendur = await dbAll('SELECT * FROM lesendur ORDER BY nafn');
    res.json(lesendur);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add lesari
router.post('/', async (req, res) => {
  try {
    const { nafn, netfang, simi } = req.body;
    if (!nafn) {
      return res.status(400).json({ error: 'Nafn vantar' });
    }
    const result = await dbRun(
      'INSERT INTO lesendur (nafn, netfang, simi) VALUES (?, ?, ?)',
      [nafn, netfang || '', simi || '']
    );
    res.json({ id: result.lastInsertRowid, message: 'Lesari bætt við' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
