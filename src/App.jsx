import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { ChatMessage } from './components/ChatMessage';
import { SessionList } from './components/SessionList';
import { VoiceButton } from './components/VoiceButton';

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
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

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Load voices
  useEffect(() => {
    window.speechSynthesis.getVoices();
  }, []);

  const fetchSessions = async () => {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    setSessions(data);
  };

  const createNewSession = async () => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = await res.json();
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(session.id);
    setMessages([]);
    setPendingText('');
  };

  const loadSession = async (sessionId) => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await res.json();
    setCurrentSessionId(sessionId);
    setMessages(data.messages || []);
    setPendingText('');
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
                setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }]);
                setStreamingContent('');
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

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <SessionList
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={loadSession}
        onNewSession={createNewSession}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 p-4">
          <h1 className="text-xl font-semibold">AI Career Coach</h1>
          <p className="text-sm text-slate-400">Your personal career development partner</p>
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
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
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
      </div>
    </div>
  );
}
