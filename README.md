# AI Career Coach

A voice-first AI coaching application for career development conversations.

## Features

- 🎤 Real-time voice transcription (Web Speech API)
- 🔊 Text-to-speech responses (Web Speech Synthesis)
- 💬 Streaming AI responses via Claude Haiku 4.5
- 📝 Persistent session history with SQLite
- 🎯 Career coaching persona with GROW-inspired structure

## Prerequisites

- Node.js 18+
- Chrome browser (for best speech recognition support)
- GitHub Copilot subscription

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your GitHub token:
   ```bash
   export GITHUB_TOKEN=$(gh auth token)
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in Chrome

## Usage

1. Click the microphone button to start speaking
2. The coach (Alex) will respond with voice and text
3. Your conversations are automatically saved
4. Use the sidebar to view past sessions or start new ones

## Production Build

```bash
npm run build
npm start
```

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **AI**: Claude Haiku 4.5 via GitHub Copilot API
- **Voice**: Web Speech API (recognition + synthesis)
