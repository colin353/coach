import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { useAuth } from './hooks/useAuth';
import { ChatMessage } from './components/ChatMessage';
import { SessionList } from './components/SessionList';
import { VoiceButton } from './components/VoiceButton';
import { WorkspaceSelector } from './components/WorkspaceSelector';
import { SessionSummary } from './components/SessionSummary';
import { PresentationRecorder } from './components/PresentationRecorder';
import { Scratchpad } from './components/Scratchpad';
import { LoginPage } from './components/LoginPage';
import { AccessDenied } from './components/AccessDenied';

export default function App() {
  const { user, loading: authLoading, error: authError, login, logout } = useAuth();
  
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [activePresentation, setActivePresentation] = useState(null);
  const [scratchpad, setScratchpad] = useState(null);
  const [showScratchpad, setShowScratchpad] = useState(true);
  const messagesEndRef = useRef(null);

  const { isSpeaking, speak, queueSentence, stop: stopSpeaking } = useSpeechSynthesis();

  const handleFinalResult = useCallback((text) => {
    setPendingText((prev) => (prev + ' ' + text).trim());
    setInterimText('');
  }, []);

  const handleInterimResult = useCallback((text) => {
    setInterimText(text);
  }, []);

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onResult: handleFinalResult,
    onInterim: handleInterimResult,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Load workspaces on mount (only when authenticated)
  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user]);

  // Load sessions when workspace changes
  useEffect(() => {
    fetchSessions();
    // Clear current session when switching workspaces
    setCurrentSessionId(null);
    setCurrentSession(null);
    setMessages([]);
  }, [currentWorkspace]);

  // Load voices
  useEffect(() => {
    window.speechSynthesis.getVoices();
  }, []);

  const fetchWorkspaces = async () => {
    const res = await fetch('/api/workspaces');
    const data = await res.json();
    setWorkspaces(data);
  };

  const fetchSessions = async () => {
    const url = currentWorkspace 
      ? `/api/sessions?workspaceId=${currentWorkspace.id}`
      : '/api/sessions';
    const res = await fetch(url);
    const data = await res.json();
    setSessions(data);
  };

  const createWorkspace = async (name) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const workspace = await res.json();
    setWorkspaces((prev) => [workspace, ...prev]);
    setCurrentWorkspace(workspace);
  };

  const createNewSession = async () => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: currentWorkspace?.id }),
    });
    const session = await res.json();
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(session.id);
    setCurrentSession(session);
    setMessages([]);
    setScratchpad(null);
    setPendingText('');
  };

  const loadSession = async (sessionId) => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await res.json();
    setCurrentSessionId(sessionId);
    setCurrentSession(data);
    setMessages(data.messages || []);
    setScratchpad(data.scratchpad || null);
    setShowScratchpad(true);
    setPendingText('');
  };

  const completeSession = async () => {
    if (!currentSessionId || isCompleting) return;
    
    setIsCompleting(true);
    try {
      const res = await fetch(`/api/sessions/${currentSessionId}/complete`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.session) {
        setCurrentSession(data.session);
        // Update session in the list
        setSessions(prev => prev.map(s => 
          s.id === currentSessionId ? { ...s, ...data.session } : s
        ));
      }
    } catch (error) {
      console.error('Complete session error:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const discardSession = async () => {
    if (!currentSessionId) return;
    
    if (!confirm('Discard this session? This cannot be undone.')) return;
    
    try {
      await fetch(`/api/sessions/${currentSessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== currentSessionId));
      setCurrentSessionId(null);
      setCurrentSession(null);
      setMessages([]);
    } catch (error) {
      console.error('Discard session error:', error);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || !currentSessionId) return;

    const userMessage = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setPendingText('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: text.trim(),
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let spokenUpTo = 0; // Track what we've already queued for TTS

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);

                // Check for complete sentences to speak
                const unspoken = fullContent.slice(spokenUpTo);
                const sentenceMatch = unspoken.match(/^(.+?[.!?])\s+/);
                if (sentenceMatch) {
                  queueSentence(sentenceMatch[1]);
                  spokenUpTo += sentenceMatch[0].length;
                }
              }
              if (data.done) {
                // Speak any remaining text
                const remaining = fullContent.slice(spokenUpTo).trim();
                if (remaining) {
                  queueSentence(remaining);
                }
                if (fullContent) {
                  setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }]);
                }
                setStreamingContent('');
              }
              
              // Handle tool execution
              if (data.tool === 'complete_session') {
                if (data.status === 'executing') {
                  setIsCompleting(true);
                } else if (data.status === 'completed' && data.result?.session) {
                  // Update session with completion data
                  setCurrentSession(data.result.session);
                  setSessions(prev => prev.map(s => 
                    s.id === currentSessionId ? { ...s, ...data.result.session } : s
                  ));
                  setIsCompleting(false);
                }
              }
              
              // Handle presentation practice tool
              if (data.tool === 'start_presentation_practice') {
                if (data.status === 'completed' && data.result?.presentation) {
                  setActivePresentation(data.result.presentation);
                }
              }
              
              // Handle scratchpad tools
              if (data.tool === 'write_scratchpad' || data.tool === 'edit_scratchpad') {
                if (data.status === 'completed' && data.result?.scratchpad !== undefined) {
                  setScratchpad(data.result.scratchpad);
                  setShowScratchpad(true);
                }
              }
              
              if (data.error) {
                console.error('Stream error:', data.error);
              }
            } catch (e) {
              // Skip unparseable
            }
          }
        }
      }
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setIsLoading(false);
      fetchSessions(); // Refresh session list
    }
  };

  const handleVoiceButtonClick = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    // If there's pending text and we're not listening, send it
    const currentText = (pendingText + ' ' + interimText).trim();
    if (!isListening && currentText) {
      sendMessage(currentText);
      setPendingText('');
      setInterimText('');
      return;
    }

    if (isListening) {
      stopListening();
      // Small delay to capture any final speech recognition results
      setTimeout(() => {
        // Combine pending text with any remaining interim text
        const finalText = (pendingText + ' ' + interimText).trim();
        if (finalText) {
          sendMessage(finalText);
          setInterimText('');
        }
      }, 300);
    } else {
      if (!currentSessionId) {
        createNewSession().then(() => startListening());
      } else {
        startListening();
      }
    }
  };

  const displayText = (pendingText + ' ' + interimText).trim();

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Access denied
  if (authError?.type === 'access_denied') {
    return <AccessDenied email={authError.email} onLogout={logout} />;
  }

  // Not authenticated
  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        {/* User info */}
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <span className="text-sm text-slate-400 truncate" title={user.email}>
            {user.email}
          </span>
          <button
            onClick={logout}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            title="Sign out"
          >
            Logout
          </button>
        </div>
        
        {/* Workspace Selector */}
        <div className="p-3 border-b border-slate-700">
          <WorkspaceSelector
            workspaces={workspaces}
            currentWorkspace={currentWorkspace}
            onSelectWorkspace={setCurrentWorkspace}
            onCreateWorkspace={createWorkspace}
          />
        </div>
        
        {/* Session List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <button
              onClick={createNewSession}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-4 font-medium transition-colors"
            >
              + New Session
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-4 text-slate-500 text-sm text-center">
                No sessions yet
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`w-full text-left p-4 border-b border-slate-700 hover:bg-slate-700 transition-colors ${
                    currentSessionId === session.id ? 'bg-slate-700' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {session.completed === 1 && (
                      <span className="text-green-400 text-xs">✓</span>
                    )}
                    <span className="font-medium text-sm truncate flex-1">{session.title}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(session.started_at).toLocaleDateString()}
                    {session.message_count > 0 && ` · ${session.message_count} messages`}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main content area with chat and scratchpad */}
      <div className="flex-1 flex">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">AI Career Coach</h1>
              <p className="text-sm text-slate-400">Your personal career development partner</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Scratchpad toggle button */}
              {scratchpad && !showScratchpad && (
                <button
                  onClick={() => setShowScratchpad(true)}
                  className="text-slate-400 hover:text-white p-2 text-sm transition-colors"
                  title="Show scratchpad"
                >
                  📝
                </button>
              )}
              {currentSessionId && (
                <button
                  onClick={discardSession}
                  className="text-slate-400 hover:text-red-400 p-2 text-sm transition-colors"
                  title="Discard session"
                >
                  🗑️
                </button>
              )}
              {currentSessionId && messages.length > 0 && currentSession?.completed !== 1 && (
                <button
                  onClick={completeSession}
                  disabled={isCompleting}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded-lg py-2 px-4 text-sm font-medium transition-colors"
                >
                  {isCompleting ? 'Completing...' : '✓ Complete Session'}
                </button>
              )}
              {currentSession?.completed === 1 && (
                <span className="text-green-400 text-sm flex items-center gap-1">
                  ✓ Completed
                </span>
              )}
            </div>
          </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {!currentSessionId ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <div className="text-6xl mb-4">🎯</div>
                <div className="text-xl mb-2">Welcome to your coaching session</div>
                <div className="text-sm">Tap the microphone to start a conversation</div>
              </div>
            </div>
          ) : messages.length === 0 && !streamingContent ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <div className="text-4xl mb-4">👋</div>
                <div className="text-lg">Ready when you are</div>
                <div className="text-sm">Tap the microphone and tell me what's on your mind</div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} isLatest={i === messages.length - 1} />
              ))}
              {streamingContent && (
                <ChatMessage message={{ role: 'assistant', content: streamingContent }} isLatest />
              )}
              {currentSession?.completed === 1 && currentSession?.summary && (
                <SessionSummary summary={currentSession.summary} />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area - hidden for completed sessions */}
        {currentSession?.completed !== 1 && (
          <div className="border-t border-slate-700 bg-slate-800 p-6">
            {/* Transcription preview */}
            {displayText && (
              <div className="mb-4 p-3 bg-slate-700 rounded-lg text-slate-300 min-h-[60px]">
                {displayText}
                {interimText && <span className="text-slate-500">|</span>}
              </div>
            )}

            {/* Voice button */}
            <div className="flex justify-center">
              <VoiceButton
                isListening={isListening}
                isSpeaking={isSpeaking}
                isLoading={isLoading}
                onClick={handleVoiceButtonClick}
                disabled={!isSupported}
              />
            </div>

            {!isSupported && (
              <div className="text-center text-red-400 mt-2 text-sm">
                Speech recognition not supported in this browser
              </div>
            )}
          </div>
        )}
        </div>

        {/* Scratchpad Panel */}
        {scratchpad && showScratchpad && (
          <Scratchpad 
            content={scratchpad} 
            onClose={() => setShowScratchpad(false)} 
          />
        )}
      </div>

      {/* Presentation Recorder Modal */}
      {activePresentation && (
        <PresentationRecorder
          presentation={activePresentation}
          onComplete={(result) => {
            setActivePresentation(null);
            // Add the feedback as a message in the chat
            setMessages((prev) => [...prev, { 
              role: 'presentation_feedback', 
              content: JSON.stringify(result) 
            }]);
          }}
          onCancel={() => setActivePresentation(null)}
        />
      )}
    </div>
  );
}
