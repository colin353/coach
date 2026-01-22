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

## Authentication (Production)

In production, the app requires Google OAuth authentication. Users must be whitelisted in `config/allowed-users.json`.

### Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Create an OAuth 2.0 Client ID (Web application)
5. Add your callback URL: `https://your-domain.com/auth/google/callback`

### Environment Variables (Production)

```bash
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export SESSION_SECRET="random-secret-string"  # Generate a secure random string
export GOOGLE_CALLBACK_URL="https://your-domain.com/auth/google/callback"  # Optional, defaults to /auth/google/callback
export NODE_ENV="production"
export GITHUB_TOKEN=$(gh auth token)
```

### Managing User Access

Edit `config/allowed-users.json` to add or remove authorized email addresses:

```json
{
  "allowedEmails": [
    "user@example.com",
    "another@example.com"
  ]
}
```

The whitelist is hot-reloadable - changes take effect immediately without restarting the server.

### Development Mode

In development (`NODE_ENV !== 'production'`), authentication is bypassed and a simulated user (`dev@localhost`) is used.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **AI**: Claude Haiku 4.5 via GitHub Copilot API
- **Voice**: Web Speech API (recognition + synthesis)
