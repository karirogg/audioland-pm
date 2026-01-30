// routes/verkefni.js - Projects CRUD

const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../database/helpers');

// Get all projects
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.is_admin === 1;

    let verkefni;
    if (isAdmin) {
      // Admin sees all projects
      verkefni = await dbAll(`
        SELECT v.*, u.nafn as owner_name,
          COALESCE((SELECT SUM(timi_minutur) FROM timaskraning WHERE verkefni_id = v.id AND tegund = 'timi'), 0) as total_minutes
        FROM verkefni v
        LEFT JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
      `);
    } else {
      // Regular user sees only their projects
      verkefni = await dbAll(`
        SELECT v.*,
          COALESCE((SELECT SUM(timi_minutur) FROM timaskraning WHERE verkefni_id = v.id AND tegund = 'timi'), 0) as total_minutes
        FROM verkefni v
        WHERE v.user_id = ? OR v.user_id IS NULL
        ORDER BY v.created_at DESC
      `, [userId]);
    }
    res.json(verkefni);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const verkefni = await dbGet('SELECT * FROM verkefni WHERE id = ?', [req.params.id]);
    if (!verkefni) return res.status(404).json({ error: 'Verkefni fannst ekki' });
    res.json(verkefni);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create project
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    let google_doc_id = '';
    if (b.google_doc_url) {
      const match = b.google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) google_doc_id = match[1];
    }

    // Generate verkefnanumer: YYMM-NNN
    const now = new Date();
    const prefix = now.toISOString().slice(2, 4) + now.toISOString().slice(5, 7);
    const existing = await dbAll(
      'SELECT verkefnanumer FROM verkefni WHERE verkefnanumer LIKE ? ORDER BY verkefnanumer DESC LIMIT 1',
      [prefix + '-%']
    );
    let seq = 1;
    if (existing.length > 0 && existing[0].verkefnanumer) {
      const lastNum = parseInt(existing[0].verkefnanumer.split('-')[1]) || 0;
      seq = lastNum + 1;
    }
    const verkefnanumer = prefix + '-' + String(seq).padStart(3, '0');

    const userId = req.user?.id;

    const result = await dbRun(
      `
      INSERT INTO verkefni (user_id, verkefnanumer, nafn, mynd, framleidsla, produser, produser_simi, produser_netfang,
        stofa, tengill_nafn, tengill_simi, tengill_netfang, art_director, art_director_simi,
        copywriter, copywriter_simi, lesari, handrit, google_doc_url, google_doc_id,
        tonlist_titill, tonlist_heimild, tonlist_url, tonlist_kostnadur,
        stada, athugasemdir, payday_tengill, dropbox_slod, mottekid, skilad,
        kunni, kunni_tengill, kunni_simi, kunni_netfang)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      [
        userId,
        verkefnanumer,
        b.nafn || '',
        b.mynd || '',
        b.framleidsla || '',
        b.produser || '',
        b.produser_simi || '',
        b.produser_netfang || '',
        b.stofa || '',
        b.tengill_nafn || '',
        b.tengill_simi || '',
        b.tengill_netfang || '',
        b.art_director || '',
        b.art_director_simi || '',
        b.copywriter || '',
        b.copywriter_simi || '',
        b.lesari || '',
        b.handrit || '',
        b.google_doc_url || '',
        google_doc_id,
        b.tonlist_titill || '',
        b.tonlist_heimild || '',
        b.tonlist_url || '',
        b.tonlist_kostnadur || 0,
        b.stada || 'Í vinnslu',
        b.athugasemdir || '',
        b.payday_tengill || '',
        b.dropbox_slod || '',
        b.mottekid || '',
        b.skilad || '',
        b.kunni || '',
        b.kunni_tengill || '',
        b.kunni_simi || '',
        b.kunni_netfang || '',
      ]
    );
    res.json({ id: result.lastInsertRowid, message: 'Verkefni búið til' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update project image
router.post('/:id/mynd', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { mynd } = req.body;
    if (!mynd) return res.status(400).json({ error: 'Enga mynd' });

    await dbRun(
      'UPDATE verkefni SET mynd = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [mynd, req.params.id]
    );
    res.json({ message: 'Mynd vistuð' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update project
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.is_admin === 1;

    // Check ownership
    const verkefni = await dbGet('SELECT user_id FROM verkefni WHERE id = ?', [req.params.id]);
    if (!verkefni) {
      return res.status(404).json({ error: 'Verkefni fannst ekki' });
    }
    if (!isAdmin && verkefni.user_id && verkefni.user_id !== userId) {
      return res.status(403).json({ error: 'Þú hefur ekki aðgang að þessu verkefni' });
    }

    const b = req.body;
    let google_doc_id = '';
    if (b.google_doc_url) {
      const match = b.google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) google_doc_id = match[1];
    }

    await dbRun(
      `
      UPDATE verkefni SET nafn=?, mynd=?, framleidsla=?, produser=?, produser_simi=?, produser_netfang=?,
        stofa=?, tengill_nafn=?, tengill_simi=?, tengill_netfang=?, art_director=?, art_director_simi=?,
        copywriter=?, copywriter_simi=?, lesari=?, handrit=?, google_doc_url=?, google_doc_id=?,
        tonlist_titill=?, tonlist_heimild=?, tonlist_url=?, tonlist_kostnadur=?,
        stada=?, athugasemdir=?, payday_tengill=?, dropbox_slod=?, mottekid=?, skilad=?,
        kunni=?, kunni_tengill=?, kunni_simi=?, kunni_netfang=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `,
      [
        b.nafn || '',
        b.mynd || '',
        b.framleidsla || '',
        b.produser || '',
        b.produser_simi || '',
        b.produser_netfang || '',
        b.stofa || '',
        b.tengill_nafn || '',
        b.tengill_simi || '',
        b.tengill_netfang || '',
        b.art_director || '',
        b.art_director_simi || '',
        b.copywriter || '',
        b.copywriter_simi || '',
        b.lesari || '',
        b.handrit || '',
        b.google_doc_url || '',
        google_doc_id,
        b.tonlist_titill || '',
        b.tonlist_heimild || '',
        b.tonlist_url || '',
        b.tonlist_kostnadur || 0,
        b.stada || 'Í vinnslu',
        b.athugasemdir || '',
        b.payday_tengill || '',
        b.dropbox_slod || '',
        b.mottekid || '',
        b.skilad || '',
        b.kunni || '',
        b.kunni_tengill || '',
        b.kunni_simi || '',
        b.kunni_netfang || '',
        req.params.id,
      ]
    );
    res.json({ message: 'Verkefni uppfært' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.is_admin === 1;

    // Check ownership
    const verkefni = await dbGet('SELECT user_id FROM verkefni WHERE id = ?', [req.params.id]);
    if (!verkefni) {
      return res.status(404).json({ error: 'Verkefni fannst ekki' });
    }
    if (!isAdmin && verkefni.user_id && verkefni.user_id !== userId) {
      return res.status(403).json({ error: 'Þú hefur ekki aðgang að þessu verkefni' });
    }

    await dbRun('DELETE FROM timaskraning WHERE verkefni_id = ?', [req.params.id]);
    await dbRun('DELETE FROM adkeypt WHERE verkefni_id = ?', [req.params.id]);
    await dbRun('DELETE FROM sessions WHERE verkefni_id = ?', [req.params.id]);
    await dbRun('DELETE FROM verkefni WHERE id = ?', [req.params.id]);
    res.json({ message: 'Verkefni eytt' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
