import { useState } from 'react';

export function WorkspaceSelector({ 
  workspaces, 
  currentWorkspace, 
  onSelectWorkspace, 
  onCreateWorkspace 
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = () => {
    if (newName.trim()) {
      onCreateWorkspace(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors w-full"
      >
        <span className="text-lg">📁</span>
        <span className="flex-1 text-left truncate">
          {currentWorkspace?.name || 'General'}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 rounded-lg shadow-lg border border-slate-600 z-10 max-h-64 overflow-y-auto">
          {/* General (no workspace) */}
          <button
            onClick={() => {
              onSelectWorkspace(null);
              setIsOpen(false);
            }}
            className={`w-full text-left px-3 py-2 hover:bg-slate-600 text-sm flex items-center gap-2 ${
              !currentWorkspace ? 'bg-slate-600' : ''
            }`}
          >
            <span>📁</span>
            <span>General</span>
          </button>

          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                onSelectWorkspace(ws);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-slate-600 text-sm flex items-center gap-2 ${
                currentWorkspace?.id === ws.id ? 'bg-slate-600' : ''
              }`}
            >
              <span>📁</span>
              <span className="flex-1 truncate">{ws.name}</span>
              <span className="text-xs text-slate-400">{ws.session_count}</span>
            </button>
          ))}

          <div className="border-t border-slate-600">
            {isCreating ? (
              <div className="p-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Workspace name..."
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={handleCreate}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 rounded"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setNewName('');
                    }}
                    className="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-xs py-1 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full text-left px-3 py-2 hover:bg-slate-600 text-sm text-blue-400 flex items-center gap-2"
              >
                <span>+</span>
                <span>New Workspace</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
