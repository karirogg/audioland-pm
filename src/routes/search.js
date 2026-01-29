// routes/search.js - Full text search

const express = require('express');
const router = express.Router();
const { dbAll } = require('../database/helpers');

router.get('/search', async (req, res) => {
  try {
    const { q, lesari, stofa, stada, from, to } = req.query;
    const userId = req.user?.id;
    const isAdmin = req.user?.is_admin === 1;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;
    let sql = `
      SELECT id, nafn, lesari, stofa, stada, handrit, mottekid, skilad, created_at
      FROM verkefni
      WHERE handrit LIKE ?
    `;
    const params = [searchTerm];

    // Filter by user unless admin
    if (!isAdmin) {
      sql += ' AND (user_id = ? OR user_id IS NULL)';
      params.push(userId);
    }

    if (lesari) {
      sql += ' AND lesari LIKE ?';
      params.push(`%${lesari}%`);
    }
    if (stofa) {
      sql += ' AND stofa LIKE ?';
      params.push(`%${stofa}%`);
    }
    if (stada) {
      sql += ' AND stada = ?';
      params.push(stada);
    }
    if (from) {
      sql += ' AND (mottekid >= ? OR created_at >= ?)';
      params.push(from, from);
    }
    if (to) {
      sql += ' AND (mottekid <= ? OR created_at <= ?)';
      params.push(to, to);
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    const results = await dbAll(sql, params);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
