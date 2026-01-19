import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';

const router = Router();

// Get all sessions
router.get('/', (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*, COUNT(m.id) as message_count
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.started_at DESC
  `).all();
  res.json(sessions);
});

// Create new session
router.post('/', (req, res) => {
  const id = uuid();
  const title = req.body.title || `Session ${new Date().toLocaleDateString()}`;
  
  db.prepare('INSERT INTO sessions (id, title) VALUES (?, ?)').run(id, title);
  
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  res.json(session);
});

// Get session with messages
router.get('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const messages = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  
  res.json({ ...session, messages });
});

// Update session (title, summary, action_items)
router.patch('/:id', (req, res) => {
  const { title, summary, action_items, ended_at } = req.body;
  const updates = [];
  const values = [];
  
  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (summary !== undefined) { updates.push('summary = ?'); values.push(summary); }
  if (action_items !== undefined) { updates.push('action_items = ?'); values.push(JSON.stringify(action_items)); }
  if (ended_at !== undefined) { updates.push('ended_at = ?'); values.push(ended_at); }
  
  if (updates.length > 0) {
    values.push(req.params.id);
    db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  res.json(session);
});

// Get recent sessions for context
router.get('/:id/context', (req, res) => {
  const recentSessions = db.prepare(`
    SELECT * FROM sessions 
    WHERE id != ? AND summary IS NOT NULL
    ORDER BY started_at DESC 
    LIMIT 5
  `).all(req.params.id);
  res.json(recentSessions);
});

export default router;
