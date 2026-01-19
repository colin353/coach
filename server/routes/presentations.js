import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { writeFile, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECORDINGS_DIR = join(__dirname, '../../data/recordings');

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Create a new presentation record
router.post('/', (req, res) => {
  const { sessionId, title } = req.body;
  
  const id = uuid();
  db.prepare(
    'INSERT INTO presentations (id, session_id, title, status) VALUES (?, ?, ?, ?)'
  ).run(id, sessionId, title || 'Untitled Presentation', 'recording');
  
  const presentation = db.prepare('SELECT * FROM presentations WHERE id = ?').get(id);
  res.json(presentation);
});

// Upload recording files
router.post('/:id/upload', async (req, res) => {
  const { id } = req.params;
  const { audio, video, duration } = req.body;
  
  const presentation = db.prepare('SELECT * FROM presentations WHERE id = ?').get(id);
  if (!presentation) {
    return res.status(404).json({ error: 'Presentation not found' });
  }

  try {
    // Save audio file
    let audioPath = null;
    if (audio) {
      const audioBuffer = Buffer.from(audio.split(',')[1], 'base64');
      audioPath = join(RECORDINGS_DIR, `${id}-audio.webm`);
      await writeFile(audioPath, audioBuffer);
    }

    // Save video file
    let videoPath = null;
    if (video) {
      const videoBuffer = Buffer.from(video.split(',')[1], 'base64');
      videoPath = join(RECORDINGS_DIR, `${id}-video.webm`);
      await writeFile(videoPath, videoBuffer);
    }

    // Update presentation record
    db.prepare(`
      UPDATE presentations 
      SET audio_path = ?, video_path = ?, duration_seconds = ?, status = 'uploaded'
      WHERE id = ?
    `).run(audioPath, videoPath, duration, id);

    const updated = db.prepare('SELECT * FROM presentations WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze presentation with Gemini
router.post('/:id/analyze', async (req, res) => {
  const { id } = req.params;
  
  const presentation = db.prepare('SELECT * FROM presentations WHERE id = ?').get(id);
  if (!presentation) {
    return res.status(404).json({ error: 'Presentation not found' });
  }

  if (!presentation.audio_path) {
    return res.status(400).json({ error: 'No audio recording found' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    // Update status
    db.prepare('UPDATE presentations SET status = ? WHERE id = ?').run('analyzing', id);

    // Read audio file
    const audioBuffer = await readFile(presentation.audio_path);
    const audioBase64 = audioBuffer.toString('base64');

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: 'audio/webm',
                  data: audioBase64,
                },
              },
              {
                text: `You are an expert presentation coach providing detailed, actionable feedback on a recorded presentation.

Analyze this presentation audio and provide timestamped feedback. Focus on:
- Clarity: Is the message clear? Are ideas well-structured?
- Accuracy: Are claims supported? Any logical issues?
- Engagement: Is the delivery compelling? Does it hold attention?
- Pacing: Is the speed appropriate? Are there awkward pauses?
- Filler words: Note excessive "um", "uh", "like", "you know"
- Confidence: Does the speaker sound confident and authoritative?

IMPORTANT: Maintain a ratio of approximately 90% constructive criticism to 10% positive feedback. Be direct and specific. The goal is improvement, not validation.

Respond in this exact JSON format:
{
  "overall_score": 7.5,
  "summary": "Brief 2-3 sentence overall assessment",
  "feedback": [
    {
      "timestamp": "0:00",
      "timestamp_seconds": 0,
      "type": "criticism",
      "category": "clarity",
      "message": "Specific feedback about what happened at this moment"
    },
    {
      "timestamp": "0:45",
      "timestamp_seconds": 45,
      "type": "positive",
      "category": "engagement",
      "message": "Specific positive feedback"
    }
  ],
  "key_improvements": [
    "Top improvement suggestion 1",
    "Top improvement suggestion 2",
    "Top improvement suggestion 3"
  ]
}

Provide at least 5-10 pieces of timestamped feedback, more for longer presentations. Be specific about what was said and how to improve it.`,
              },
            ],
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', response.status, error);
      db.prepare('UPDATE presentations SET status = ? WHERE id = ?').run('error', id);
      return res.status(500).json({ error: 'Failed to analyze presentation' });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to parse Gemini response:', content);
      db.prepare('UPDATE presentations SET status = ? WHERE id = ?').run('error', id);
      return res.status(500).json({ error: 'Failed to parse analysis' });
    }

    const feedback = JSON.parse(jsonMatch[0]);

    // Update presentation with feedback
    db.prepare(`
      UPDATE presentations 
      SET feedback = ?, status = 'completed'
      WHERE id = ?
    `).run(JSON.stringify(feedback), id);

    const updated = db.prepare('SELECT * FROM presentations WHERE id = ?').get(id);
    
    // Save feedback as a message in the chat history
    const messageId = uuid();
    const messageContent = JSON.stringify(updated);
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(messageId, presentation.session_id, 'presentation_feedback', messageContent);

    res.json(updated);
  } catch (error) {
    console.error('Analysis error:', error);
    db.prepare('UPDATE presentations SET status = ? WHERE id = ?').run('error', id);
    res.status(500).json({ error: error.message });
  }
});

// Get presentation by ID
router.get('/:id', (req, res) => {
  const presentation = db.prepare('SELECT * FROM presentations WHERE id = ?').get(req.params.id);
  if (!presentation) {
    return res.status(404).json({ error: 'Presentation not found' });
  }
  res.json(presentation);
});

// Serve recording files
router.get('/:id/video', async (req, res) => {
  const presentation = db.prepare('SELECT video_path FROM presentations WHERE id = ?').get(req.params.id);
  if (!presentation?.video_path) {
    return res.status(404).json({ error: 'Video not found' });
  }
  res.sendFile(presentation.video_path);
});

router.get('/:id/audio', async (req, res) => {
  const presentation = db.prepare('SELECT audio_path FROM presentations WHERE id = ?').get(req.params.id);
  if (!presentation?.audio_path) {
    return res.status(404).json({ error: 'Audio not found' });
  }
  res.sendFile(presentation.audio_path);
});

export default router;
