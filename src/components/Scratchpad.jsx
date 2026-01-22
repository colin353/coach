import ReactMarkdown from 'react-markdown';
import { useState, useCallback } from 'react';

export function Scratchpad({ content, onClose }) {
  const [width, setWidth] = useState(384); // 24rem = 384px
  const [isResizing, setIsResizing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e) => {
      const delta = startX - e.clientX;
      const newWidth = Math.max(200, Math.min(800, startWidth + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [content]);

  if (!content) return null;

  return (
    <div 
      className="border-l border-slate-700 bg-slate-800 flex flex-col h-full relative"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors ${isResizing ? 'bg-blue-500' : 'bg-transparent'}`}
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-750">
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <span className="text-slate-200 font-medium">Scratchpad</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="text-slate-400 hover:text-white p-1 text-sm"
            title="Copy markdown to clipboard"
          >
            {copied ? '✓' : '📋'}
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            title="Hide scratchpad"
          >
            ✕
          </button>
        </div>
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
