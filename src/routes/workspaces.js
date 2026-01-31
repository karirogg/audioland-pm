// routes/workspaces.js - Workspace management routes

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { dbAll, dbGet, dbRun } = require('../database/helpers');

// Get user's workspaces
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Ekki innskráður' });
    }

    const workspaces = await dbAll(`
      SELECT w.*, wm.role
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = ?
      ORDER BY w.nafn
    `, [userId]);

    res.json(workspaces);
  } catch (err) {
    console.error('Error fetching workspaces:', err);
    res.status(500).json({ error: 'Villa við að sækja workspaces' });
  }
});

// Create new workspace
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Ekki innskráður' });
    }

    const { nafn } = req.body;
    if (!nafn) {
      return res.status(400).json({ error: 'Nafn vantar' });
    }

    // Create slug from name
    const slug = nafn.toLowerCase()
      .replace(/[áàâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/[ýỳŷÿ]/g, 'y')
      .replace(/[ðþ]/g, 'd')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if slug exists
    const existing = await dbGet('SELECT id FROM workspaces WHERE slug = ?', [slug]);
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    // Create workspace
    const result = await dbRun(
      'INSERT INTO workspaces (nafn, slug, owner_id) VALUES (?, ?, ?)',
      [nafn, finalSlug, userId]
    );

    const workspaceId = result.lastInsertRowid;

    // Add creator as owner
    await dbRun(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [workspaceId, userId, 'owner']
    );

    res.json({
      id: workspaceId,
      nafn,
      slug: finalSlug,
      role: 'owner'
    });
  } catch (err) {
    console.error('Error creating workspace:', err);
    res.status(500).json({ error: 'Villa við að búa til workspace' });
  }
});

// Get workspace members
router.get('/:id/members', async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.id;

    // Check if user is member
    const membership = await dbGet(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Ekki aðgangur' });
    }

    const members = await dbAll(`
      SELECT u.id, u.nafn, u.email, u.mynd, wm.role, wm.created_at
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.role, u.nafn
    `, [workspaceId]);

    res.json(members);
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: 'Villa við að sækja meðlimi' });
  }
});

// Create invite
router.post('/:id/invite', async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user?.id;
    const { email, role = 'member' } = req.body;

    // Check if user is admin/owner
    const membership = await dbGet(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId]
    );

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ error: 'Ekki heimild til að bjóða' });
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    await dbRun(
      'INSERT INTO invites (workspace_id, email, role, token, expires_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, email?.toLowerCase(), role, token, expiresAt]
    );

    const workspace = await dbGet('SELECT nafn FROM workspaces WHERE id = ?', [workspaceId]);

    res.json({
      token,
      inviteUrl: `/invite/${token}`,
      workspace: workspace?.nafn,
      expiresAt
    });
  } catch (err) {
    console.error('Error creating invite:', err);
    res.status(500).json({ error: 'Villa við að búa til boð' });
  }
});

// Accept invite
router.post('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Þú þarft að skrá þig inn fyrst' });
    }

    const invite = await dbGet(
      'SELECT * FROM invites WHERE token = ? AND used_at IS NULL',
      [token]
    );

    if (!invite) {
      return res.status(404).json({ error: 'Boð fannst ekki eða er útrunnið' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Boð er útrunnið' });
    }

    // Check if already member
    const existing = await dbGet(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [invite.workspace_id, userId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Þú ert nú þegar meðlimur' });
    }

    // Add to workspace
    await dbRun(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [invite.workspace_id, userId, invite.role]
    );

    // Mark invite as used
    await dbRun(
      'UPDATE invites SET used_at = ? WHERE id = ?',
      [new Date().toISOString(), invite.id]
    );

    const workspace = await dbGet('SELECT * FROM workspaces WHERE id = ?', [invite.workspace_id]);

    res.json({
      message: 'Velkomin í ' + workspace.nafn,
      workspace
    });
  } catch (err) {
    console.error('Error accepting invite:', err);
    res.status(500).json({ error: 'Villa við að samþykkja boð' });
  }
});

// Get invite info (public)
router.get('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await dbGet(`
      SELECT i.*, w.nafn as workspace_nafn
      FROM invites i
      JOIN workspaces w ON i.workspace_id = w.id
      WHERE i.token = ? AND i.used_at IS NULL
    `, [token]);

    if (!invite) {
      return res.status(404).json({ error: 'Boð fannst ekki' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Boð er útrunnið' });
    }

    res.json({
      workspace: invite.workspace_nafn,
      role: invite.role,
      email: invite.email
    });
  } catch (err) {
    console.error('Error fetching invite:', err);
    res.status(500).json({ error: 'Villa' });
  }
});

module.exports = router;
