export function VoiceButton({ isListening, isSpeaking, isLoading, onClick, disabled }) {
  const getButtonState = () => {
    if (isLoading) return 'loading';
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    return 'idle';
  };

  const state = getButtonState();

  const stateStyles = {
    idle: 'bg-blue-600 hover:bg-blue-700',
    listening: 'bg-red-500',
    speaking: 'bg-green-500',
    loading: 'bg-yellow-500',
  };

  const stateIcons = {
    idle: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    ),
    listening: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="2"/>
      </svg>
    ),
    speaking: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
    ),
    loading: (
      <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
      </svg>
    ),
  };

  return (
    <div className="relative">
      {state === 'listening' && (
        <div className="absolute inset-0 rounded-full bg-red-500 animate-pulse-ring" />
      )}
      <button
        onClick={onClick}
        disabled={disabled || state === 'loading'}
        className={`relative w-20 h-20 rounded-full ${stateStyles[state]} text-white flex items-center justify-center transition-all shadow-lg disabled:opacity-50`}
      >
        {stateIcons[state]}
      </button>
      <div className="text-center mt-2 text-sm text-slate-400">
        {state === 'idle' && 'Tap to speak'}
        {state === 'listening' && 'Listening...'}
        {state === 'speaking' && 'Speaking...'}
        {state === 'loading' && 'Thinking...'}
      </div>
    </div>
  );
}
