import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { COACH_SYSTEM_PROMPT, buildContextPrompt } from '../prompts.js';

const router = Router();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

router.post('/', async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message required' });
  }

  // Save user message
  const userMsgId = uuid();
  db.prepare(
    'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)'
  ).run(userMsgId, sessionId, 'user', message);

  // Get conversation history
  const history = db.prepare(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId);

  // Get context from previous sessions
  const previousSessions = db.prepare(`
    SELECT * FROM sessions 
    WHERE id != ? AND summary IS NOT NULL
    ORDER BY started_at DESC 
    LIMIT 3
  `).all(sessionId);

  const systemPrompt = COACH_SYSTEM_PROMPT + buildContextPrompt(previousSessions);

  // Build messages array for Claude
  const messages = history.map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

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
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('API error:', response.status, error);
      res.write(`data: ${JSON.stringify({ error: `API error: ${response.status}` })}\n\n`);
      res.end();
      return;
    }

    let fullContent = '';
    let buffer = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // Skip unparseable chunks
          }
        }
      }
    }

    // Save assistant message
    const assistantMsgId = uuid();
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(assistantMsgId, sessionId, 'assistant', fullContent);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

export default router;
