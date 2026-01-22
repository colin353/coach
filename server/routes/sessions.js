import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';

const router = Router();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Get all sessions (optionally filtered by workspace)
router.get('/', (req, res) => {
  const { workspaceId } = req.query;
  const userId = req.user.id;

  let query = `
    SELECT s.*, COUNT(m.id) as message_count
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
  `;

  if (workspaceId) {
    query += ` WHERE s.workspace_id = ? AND s.user_id = ?`;
  } else {
    query += ` WHERE s.workspace_id IS NULL AND s.user_id = ?`;
  }

  query += ` GROUP BY s.id ORDER BY s.started_at DESC`;

  const sessions = workspaceId
    ? db.prepare(query).all(workspaceId, userId)
    : db.prepare(query).all(userId);

  res.json(sessions);
});

// Create new session
router.post('/', (req, res) => {
  const id = uuid();
  const title = req.body.title || `Session ${new Date().toLocaleDateString()}`;
  const workspaceId = req.body.workspaceId || null;
  const userId = req.user.id;

  db.prepare('INSERT INTO sessions (id, title, workspace_id, user_id) VALUES (?, ?, ?, ?)').run(id, title, workspaceId, userId);

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  res.json(session);
});

// Get session with messages
router.get('/:id', (req, res) => {
  const userId = req.user.id;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, userId);
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
  const userId = req.user.id;
  const { title, summary, action_items, ended_at } = req.body;
  
  // Verify ownership
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
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

// Delete session and its messages/facts
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Verify ownership
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Delete associated facts and messages first
  db.prepare('DELETE FROM facts WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  
  res.json({ success: true });
});

// Get recent sessions for context
router.get('/:id/context', (req, res) => {
  const userId = req.user.id;
  const recentSessions = db.prepare(`
    SELECT * FROM sessions 
    WHERE id != ? AND summary IS NOT NULL AND user_id = ?
    ORDER BY started_at DESC 
    LIMIT 5
  `).all(req.params.id, userId);
  res.json(recentSessions);
});

// Get all facts (for context in new sessions)
router.get('/facts/all', (req, res) => {
  const userId = req.user.id;
  const facts = db.prepare(`
    SELECT f.*, s.title as session_title
    FROM facts f
    JOIN sessions s ON s.id = f.session_id
    WHERE s.user_id = ?
    ORDER BY f.created_at DESC
    LIMIT 50
  `).all(userId);
  res.json(facts);
});

// Complete a session - extract facts, generate title, and create summary
router.post('/:id/complete', async (req, res) => {
  const userId = req.user.id;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const messages = db.prepare(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  if (messages.length === 0) {
    return res.status(400).json({ error: 'No messages in session' });
  }

  // Build conversation transcript
  const transcript = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n\n');

  const extractionPrompt = `You are analyzing a coaching conversation. Extract and generate the following:

1. A short title (3-6 words) that captures the main topic discussed
2. Key facts learned about the user (max 5 facts, each one sentence)
3. A session summary containing:
   - Key insights from the conversation (2-4 bullet points)
   - Suggested next steps/action items (2-4 concrete actions)
   - Recommended reading or research topics (2-3 suggestions with brief descriptions)

Facts should be things worth remembering for future conversations, such as:
- Career goals or aspirations
- Current job situation or challenges
- Skills, interests, or values mentioned
- Decisions made or actions planned
- Important context about their life/work

Respond in this exact JSON format:
{
  "title": "Short Title Here",
  "facts": [
    "Fact one about the user.",
    "Fact two about the user."
  ],
  "summary": {
    "insights": [
      "Key insight from the conversation",
      "Another important realization"
    ],
    "nextSteps": [
      "Concrete action item 1",
      "Concrete action item 2"
    ],
    "reading": [
      {"topic": "Topic name", "description": "Brief description of why this is relevant"},
      {"topic": "Another topic", "description": "Brief description"}
    ]
  }
}

Only include genuinely useful content. If the conversation was brief or shallow, include fewer items.

CONVERSATION:
${transcript}`;

  try {
    const response = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Copilot-Integration-Id': 'vscode-chat',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4.5',
        messages: [{ role: 'user', content: extractionPrompt }],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Extraction API error:', response.status, error);
      return res.status(500).json({ error: 'Failed to extract facts' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to parse extraction response:', content);
      return res.status(500).json({ error: 'Failed to parse extraction' });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    const { title, facts, summary } = extracted;

    // Update session with title and summary
    db.prepare(`
      UPDATE sessions 
      SET title = ?, summary = ?, completed = 1, ended_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(title, JSON.stringify(summary), req.params.id);

    // Store facts
    const insertFact = db.prepare(
      'INSERT INTO facts (id, session_id, content) VALUES (?, ?, ?)'
    );
    for (const fact of facts || []) {
      insertFact.run(uuid(), req.params.id, fact);
    }

    const updatedSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    const storedFacts = db.prepare('SELECT * FROM facts WHERE session_id = ?').all(req.params.id);

    res.json({ session: updatedSession, facts: storedFacts });
  } catch (error) {
    console.error('Complete session error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
