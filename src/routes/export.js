// routes/export.js - CSV Export API

const express = require('express');
const router = express.Router();
const { dbAll, dbGet } = require('../database/helpers');

// Helper to escape CSV values
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Export all projects as CSV
router.get('/export/csv', async (req, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.is_admin === 1;

    let verkefni;
    if (isAdmin) {
      verkefni = await dbAll(`
        SELECT v.*, u.nafn as owner_name,
          COALESCE((SELECT SUM(timi_minutur) FROM timaskraning WHERE verkefni_id = v.id AND tegund = 'timi'), 0) as total_minutes
        FROM verkefni v
        LEFT JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
      `);
    } else {
      verkefni = await dbAll(`
        SELECT v.*,
          COALESCE((SELECT SUM(timi_minutur) FROM timaskraning WHERE verkefni_id = v.id AND tegund = 'timi'), 0) as total_minutes
        FROM verkefni v
        WHERE v.user_id = ? OR v.user_id IS NULL
        ORDER BY v.created_at DESC
      `, [userId]);
    }

    const headers = [
      'Verkefnanúmer', 'Nafn', 'Staða', 'Lesari', 'Stofa', 'Framleiðsla',
      'Pródúser', 'Móttekið', 'Skilað', 'Tími (mín)', 'Kúnni'
    ];

    const rows = verkefni.map(v => [
      v.verkefnanumer,
      v.nafn,
      v.stada,
      v.lesari,
      v.stofa,
      v.framleidsla,
      v.produser,
      v.mottekid,
      v.skilad,
      v.total_minutes,
      v.kunni
    ].map(escapeCSV).join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    // UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="verkefni.csv"');
    res.send(bom + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export single project with time entries
router.get('/verkefni/:id/csv', async (req, res) => {
  try {
    const verkefni = await dbGet('SELECT * FROM verkefni WHERE id = ?', [req.params.id]);
    if (!verkefni) {
      return res.status(404).json({ error: 'Verkefni fannst ekki' });
    }

    const timi = await dbAll(
      'SELECT * FROM timaskraning WHERE verkefni_id = ? ORDER BY dagsetning',
      [req.params.id]
    );

    const lines = [];

    // Project info
    lines.push('VERKEFNI');
    lines.push(`Verkefnanúmer,${escapeCSV(verkefni.verkefnanumer)}`);
    lines.push(`Nafn,${escapeCSV(verkefni.nafn)}`);
    lines.push(`Staða,${escapeCSV(verkefni.stada)}`);
    lines.push(`Lesari,${escapeCSV(verkefni.lesari)}`);
    lines.push(`Stofa,${escapeCSV(verkefni.stofa)}`);
    lines.push(`Framleiðsla,${escapeCSV(verkefni.framleidsla)}`);
    lines.push(`Móttekið,${escapeCSV(verkefni.mottekid)}`);
    lines.push(`Skilað,${escapeCSV(verkefni.skilad)}`);
    if (verkefni.kunni) lines.push(`Kúnni,${escapeCSV(verkefni.kunni)}`);
    lines.push('');

    // Time entries
    lines.push('TÍMASKRÁNING');
    lines.push('Tegund,Titill,Dagsetning,Tími (mín)');
    timi.forEach(t => {
      lines.push([t.tegund, t.titill, t.dagsetning, t.timi_minutur].map(escapeCSV).join(','));
    });
    lines.push('');

    // Summary
    const totalMinutes = timi.filter(t => t.tegund === 'timi').reduce((s, t) => s + (t.timi_minutur || 0), 0);
    const totalCalls = timi.filter(t => t.tegund === 'simtal').length;
    const totalEmails = timi.filter(t => t.tegund === 'email').length;
    const totalMeetings = timi.filter(t => t.tegund === 'fundur').length;

    lines.push('SAMTALS');
    lines.push(`Tími (mín),${totalMinutes}`);
    lines.push(`Símtöl,${totalCalls}`);
    lines.push(`Email,${totalEmails}`);
    lines.push(`Fundir,${totalMeetings}`);

    const csv = lines.join('\n');
    const filename = `${verkefni.verkefnanumer || 'verkefni'}.csv`;

    // UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(bom + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
