// routes/kunnar.js - Customers API

const express = require('express');
const router = express.Router();
const { dbAll, dbRun } = require('../database/helpers');

// Get all kunnar
router.get('/', async (req, res) => {
  try {
    const kunnar = await dbAll('SELECT * FROM kunnar ORDER BY nafn');
    res.json(kunnar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add kunni
router.post('/', async (req, res) => {
  try {
    const { nafn, netfang, simi } = req.body;
    if (!nafn) {
      return res.status(400).json({ error: 'Nafn vantar' });
    }
    const result = await dbRun(
      'INSERT INTO kunnar (nafn, netfang, simi) VALUES (?, ?, ?)',
      [nafn, netfang || '', simi || '']
    );
    res.json({ id: result.lastInsertRowid, message: 'Kúnni bætt við' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
