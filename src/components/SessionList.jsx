export function SessionList({ sessions, currentSessionId, onSelectSession, onNewSession }) {
  return (
    <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <button
          onClick={onNewSession}
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
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left p-4 border-b border-slate-700 hover:bg-slate-700 transition-colors ${
                currentSessionId === session.id ? 'bg-slate-700' : ''
              }`}
            >
              <div className="font-medium text-sm truncate">{session.title}</div>
              <div className="text-xs text-slate-500 mt-1">
                {new Date(session.started_at).toLocaleDateString()}
                {session.message_count > 0 && ` · ${session.message_count} messages`}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
