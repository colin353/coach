import ReactMarkdown from 'react-markdown';

export function Scratchpad({ content, onClose }) {
  if (!content) return null;

  return (
    <div className="w-96 border-l border-slate-700 bg-slate-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-750">
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <span className="text-slate-200 font-medium">Scratchpad</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
          title="Hide scratchpad"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="prose prose-invert prose-sm max-w-none
          prose-headings:text-slate-200 prose-headings:font-semibold
          prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
          prose-p:text-slate-300 prose-p:leading-relaxed
          prose-strong:text-slate-200
          prose-ul:text-slate-300 prose-ol:text-slate-300
          prose-li:marker:text-slate-500
          prose-table:border-collapse
          prose-th:border prose-th:border-slate-600 prose-th:bg-slate-700 prose-th:px-3 prose-th:py-2 prose-th:text-slate-200
          prose-td:border prose-td:border-slate-600 prose-td:px-3 prose-td:py-2 prose-td:text-slate-300
          prose-code:text-blue-300 prose-code:bg-slate-700 prose-code:px-1 prose-code:rounded
          prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700
          prose-hr:border-slate-600
          prose-blockquote:border-l-slate-500 prose-blockquote:text-slate-400
        ">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
