import { PresentationFeedbackMessage } from './PresentationFeedbackMessage';

export function ChatMessage({ message, isLatest }) {
  const isUser = message.role === 'user';
  
  // Check if this is a presentation feedback message
  if (message.role === 'presentation_feedback') {
    try {
      const presentation = JSON.parse(message.content);
      return <PresentationFeedbackMessage presentation={presentation} />;
    } catch (e) {
      console.error('Failed to parse presentation feedback:', e);
    }
  }
  
  // Clean up display text (remove PAUSE markers)
  const displayContent = message.content.replace(/<PAUSE>/gi, '');

  return (
    <div className={`message-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-slate-700 text-slate-100 rounded-bl-md'
        }`}
      >
        {!isUser && (
          <div className="text-xs text-slate-400 mb-1 font-medium">Alex</div>
        )}
        <div className="whitespace-pre-wrap">{displayContent}</div>
      </div>
    </div>
  );
}
