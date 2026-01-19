import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';

const router = Router();

// Get all workspaces
router.get('/', (req, res) => {
  const workspaces = db.prepare(`
    SELECT w.*, COUNT(s.id) as session_count
    FROM workspaces w
    LEFT JOIN sessions s ON s.workspace_id = w.id
    GROUP BY w.id
    ORDER BY w.created_at DESC
  `).all();
  res.json(workspaces);
});

// Create new workspace
router.post('/', (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const id = uuid();
  db.prepare(
    'INSERT INTO workspaces (id, name, description) VALUES (?, ?, ?)'
  ).run(id, name, description || null);
  
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  res.json(workspace);
});

// Get workspace by id
router.get('/:id', (req, res) => {
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  res.json(workspace);
});

// Update workspace
router.patch('/:id', (req, res) => {
  const { name, description } = req.body;
  const updates = [];
  const values = [];
  
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  
  if (updates.length > 0) {
    values.push(req.params.id);
    db.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  res.json(workspace);
});

// Delete workspace (and all its sessions/messages/facts)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  // Get all session IDs for this workspace
  const sessions = db.prepare('SELECT id FROM sessions WHERE workspace_id = ?').all(id);
  const sessionIds = sessions.map(s => s.id);
  
  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM facts WHERE session_id IN (${placeholders})`).run(...sessionIds);
    db.prepare(`DELETE FROM messages WHERE session_id IN (${placeholders})`).run(...sessionIds);
    db.prepare(`DELETE FROM sessions WHERE workspace_id = ?`).run(id);
  }
  
  db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
