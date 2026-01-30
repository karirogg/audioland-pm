// routes/sessions.js - Session booking API

const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../database/helpers');

// Get sessions for a project
router.get('/verkefni/:id/sessions', async (req, res) => {
  try {
    const sessions = await dbAll(
      'SELECT * FROM sessions WHERE verkefni_id = ? ORDER BY dags, timi',
      [req.params.id]
    );
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create session
router.post('/verkefni/:id/sessions', async (req, res) => {
  try {
    const { dags, timi, lengd, lesari, athugasemd, emails } = req.body;
    const result = await dbRun(
      `INSERT INTO sessions (verkefni_id, dags, timi, lengd, lesari, athugasemd, emails)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, dags || '', timi || '', lengd || 60, lesari || '', athugasemd || '', emails || '']
    );
    res.json({ id: result.lastInsertRowid, message: 'Lota búin til' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update session
router.put('/sessions/:id', async (req, res) => {
  try {
    const { dags, timi, lengd, lesari, athugasemd, emails } = req.body;
    await dbRun(
      `UPDATE sessions SET dags=?, timi=?, lengd=?, lesari=?, athugasemd=?, emails=?
       WHERE id=?`,
      [dags || '', timi || '', lengd || 60, lesari || '', athugasemd || '', emails || '', req.params.id]
    );
    res.json({ message: 'Lota uppfærð' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete session
router.delete('/sessions/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM sessions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Lotu eytt' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download iCal file for session
router.get('/sessions/:id/ics', async (req, res) => {
  try {
    const session = await dbGet('SELECT * FROM sessions WHERE id = ?', [req.params.id]);
    if (!session) {
      return res.status(404).json({ error: 'Lota fannst ekki' });
    }

    // Get project name for event title
    const verkefni = await dbGet('SELECT nafn FROM verkefni WHERE id = ?', [session.verkefni_id]);
    const projectName = verkefni?.nafn || 'Upptaka';

    // Build date-time
    const dateStr = session.dags || new Date().toISOString().split('T')[0];
    const timeStr = session.timi || '09:00';
    const lengd = session.lengd || 60;

    // Parse date and time
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    const startDate = new Date(year, month - 1, day, hours, minutes);
    const endDate = new Date(startDate.getTime() + lengd * 60000);

    // Format for iCal (YYYYMMDDTHHMMSS)
    const formatIcalDate = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    };

    const uid = `session-${session.id}@bessi.audioland.is`;
    const now = formatIcalDate(new Date());

    let description = '';
    if (session.lesari) description += `Lesari: ${session.lesari}\\n`;
    if (session.athugasemd) description += `${session.athugasemd}`;

    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bessi//Audioland//IS',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatIcalDate(startDate)}`,
      `DTEND:${formatIcalDate(endDate)}`,
      `SUMMARY:${projectName}${session.lesari ? ` - ${session.lesari}` : ''}`,
      description ? `DESCRIPTION:${description}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="session-${session.id}.ics"`);
    res.send(ical);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
