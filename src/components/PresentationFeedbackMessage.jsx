import { useState, useRef, useEffect } from 'react';

export function PresentationFeedbackMessage({ presentation }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const videoRef = useRef(null);

  const feedback = presentation.feedback
    ? (typeof presentation.feedback === 'string' ? JSON.parse(presentation.feedback) : presentation.feedback)
    : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const seekTo = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      clarity: '💡',
      accuracy: '🎯',
      engagement: '🎭',
      pacing: '⏱️',
      filler_words: '💬',
      confidence: '💪',
      structure: '📋',
      delivery: '🎤',
    };
    return icons[category] || '📝';
  };

  if (!feedback) {
    return (
      <div className="flex justify-start mb-4">
        <div className="bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3 text-slate-400">
          <div className="animate-pulse">Analyzing presentation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="w-full max-w-[95%] bg-slate-700 rounded-2xl rounded-bl-md overflow-hidden">
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 bg-slate-600 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎤</span>
            <div>
              <div className="text-white font-medium">{presentation.title}</div>
              <div className="text-slate-400 text-sm">Presentation Feedback</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-white">
              {feedback.overall_score}<span className="text-sm text-slate-400">/10</span>
            </div>
            <span className="text-slate-400">{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="p-4">
            {/* Video player */}
            <div className="relative bg-black rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                src={`/api/presentations/${presentation.id}/video`}
                className="w-full aspect-video object-contain"
                controls
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>

            {/* Summary */}
            <div className="bg-slate-800 rounded-lg p-3 mb-4">
              <p className="text-slate-300 text-sm">{feedback.summary}</p>
            </div>

            {/* Key improvements */}
            {feedback.key_improvements && feedback.key_improvements.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-blue-400 uppercase tracking-wide mb-2">
                  🎯 Key Improvements
                </h4>
                <ul className="space-y-1">
                  {feedback.key_improvements.map((improvement, i) => (
                    <li key={i} className="text-slate-300 text-sm flex gap-2">
                      <span className="text-blue-400">{i + 1}.</span>
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timestamped feedback */}
            <div>
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-2">
                Timestamped Feedback ({feedback.feedback?.length || 0})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {feedback.feedback?.map((item, i) => {
                  const isActive = currentTime >= item.timestamp_seconds &&
                    currentTime < (feedback.feedback[i + 1]?.timestamp_seconds || Infinity);

                  return (
                    <button
                      key={i}
                      onClick={() => seekTo(item.timestamp_seconds)}
                      className={`w-full text-left p-2 rounded-lg border transition-all ${
                        item.type === 'positive'
                          ? 'border-green-500/50 bg-green-900/20'
                          : 'border-orange-500/50 bg-orange-900/20'
                      } ${isActive ? 'ring-2 ring-blue-500' : ''} hover:ring-2 hover:ring-slate-500`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="text-lg">{getCategoryIcon(item.category)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                              {item.timestamp}
                            </span>
                            <span className={`text-xs uppercase ${
                              item.type === 'positive' ? 'text-green-400' : 'text-orange-400'
                            }`}>
                              {item.category}
                            </span>
                          </div>
                          <p className="text-slate-200 text-sm">{item.message}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
