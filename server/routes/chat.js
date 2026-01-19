import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { buildSystemPrompt } from '../prompts.js';
import { TOOLS } from '../tools.js';
import { executeTool } from '../toolExecutor.js';

const router = Router();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

router.post('/', async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message required' });
  }

  // Get current session to find workspace
  const currentSession = db.prepare('SELECT workspace_id FROM sessions WHERE id = ?').get(sessionId);
  const workspaceId = currentSession?.workspace_id;

  // Save user message
  const userMsgId = uuid();
  db.prepare(
    'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)'
  ).run(userMsgId, sessionId, 'user', message);

  // Get conversation history
  const history = db.prepare(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId);

  // Get context from previous sessions (same workspace only)
  const previousSessions = workspaceId
    ? db.prepare(`
        SELECT * FROM sessions 
        WHERE id != ? AND summary IS NOT NULL AND workspace_id = ?
        ORDER BY started_at DESC 
        LIMIT 3
      `).all(sessionId, workspaceId)
    : db.prepare(`
        SELECT * FROM sessions 
        WHERE id != ? AND summary IS NOT NULL AND workspace_id IS NULL
        ORDER BY started_at DESC 
        LIMIT 3
      `).all(sessionId);

  // Get facts from completed sessions (same workspace only)
  const facts = workspaceId
    ? db.prepare(`
        SELECT f.content FROM facts f
        JOIN sessions s ON s.id = f.session_id
        WHERE s.completed = 1 AND s.workspace_id = ?
        ORDER BY f.created_at DESC
        LIMIT 30
      `).all(workspaceId)
    : db.prepare(`
        SELECT f.content FROM facts f
        JOIN sessions s ON s.id = f.session_id
        WHERE s.completed = 1 AND s.workspace_id IS NULL
        ORDER BY f.created_at DESC
        LIMIT 30
      `).all();

  const systemPrompt = buildSystemPrompt(previousSessions, facts);

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
        tools: TOOLS,
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
    let toolCalls = [];
    let currentToolCall = null;
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
            const delta = parsed.choices?.[0]?.delta;
            
            // Handle text content
            if (delta?.content) {
              fullContent += delta.content;
              res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
            }
            
            // Handle tool calls
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.index !== undefined) {
                  // Initialize or get existing tool call
                  if (!toolCalls[tc.index]) {
                    toolCalls[tc.index] = { id: '', name: '', arguments: '' };
                  }
                  currentToolCall = toolCalls[tc.index];
                }
                if (tc.id) {
                  currentToolCall.id = tc.id;
                }
                if (tc.function?.name) {
                  currentToolCall.name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  currentToolCall.arguments += tc.function.arguments;
                }
              }
            }
          } catch (e) {
            // Skip unparseable chunks
          }
        }
      }
    }

    // Save assistant message (text content only)
    if (fullContent) {
      const assistantMsgId = uuid();
      db.prepare(
        'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)'
      ).run(assistantMsgId, sessionId, 'assistant', fullContent);
    }

    // Signal that text is done
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

    // Execute any tool calls
    const validToolCalls = toolCalls.filter(tc => tc && tc.name);
    
    for (const toolCall of validToolCalls) {
      let args = {};
      try {
        if (toolCall.arguments) {
          args = JSON.parse(toolCall.arguments);
        }
      } catch (e) {
        console.error('Failed to parse tool arguments:', toolCall.arguments);
      }

      // Signal that we're executing a tool
      res.write(`data: ${JSON.stringify({ tool: toolCall.name, status: 'executing' })}\n\n`);

      // Execute the tool
      const result = await executeTool(toolCall.name, args, sessionId);

      // Send tool result
      res.write(`data: ${JSON.stringify({ tool: toolCall.name, status: 'completed', result })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

export default router;
