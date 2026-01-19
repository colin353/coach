import { v4 as uuid } from 'uuid';
import db from './db.js';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Execute the complete_session tool
export async function executeCompleteSession(sessionId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return { error: 'Session not found' };
  }

  const messages = db.prepare(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId);

  if (messages.length === 0) {
    return { error: 'No messages in session' };
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
      return { error: 'Failed to extract facts' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to parse extraction response:', content);
      return { error: 'Failed to parse extraction' };
    }

    const extracted = JSON.parse(jsonMatch[0]);
    const { title, facts, summary } = extracted;

    // Update session with title and summary
    db.prepare(`
      UPDATE sessions 
      SET title = ?, summary = ?, completed = 1, ended_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(title, JSON.stringify(summary), sessionId);

    // Store facts
    const insertFact = db.prepare(
      'INSERT INTO facts (id, session_id, content) VALUES (?, ?, ?)'
    );
    for (const fact of facts || []) {
      insertFact.run(uuid(), sessionId, fact);
    }

    const updatedSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    const storedFacts = db.prepare('SELECT * FROM facts WHERE session_id = ?').all(sessionId);

    return { session: updatedSession, facts: storedFacts };
  } catch (error) {
    console.error('Complete session error:', error);
    return { error: error.message };
  }
}

// Start presentation practice - just creates the record, frontend handles recording
function executeStartPresentationPractice(sessionId, args) {
  const id = uuid();
  const title = args.title || 'Presentation Practice';
  
  db.prepare(
    'INSERT INTO presentations (id, session_id, title, status) VALUES (?, ?, ?, ?)'
  ).run(id, sessionId, title, 'recording');
  
  const presentation = db.prepare('SELECT * FROM presentations WHERE id = ?').get(id);
  return { presentation };
}

// Tool executor dispatcher
export async function executeTool(toolName, args, sessionId) {
  switch (toolName) {
    case 'complete_session':
      return executeCompleteSession(sessionId);
    case 'start_presentation_practice':
      return executeStartPresentationPractice(sessionId, args);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
