// routes/reference.js - Reference data (stofur, framleidsla)

const express = require('express');
const router = express.Router();
const { dbAll } = require('../database/helpers');

// Get advertising agencies
router.get('/stofur', async (req, res) => {
  try {
    res.json(await dbAll('SELECT * FROM auglysingar_stofur ORDER BY nafn'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get production companies
router.get('/framleidsla', async (req, res) => {
  try {
    res.json(await dbAll('SELECT * FROM framleidsla ORDER BY nafn'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
