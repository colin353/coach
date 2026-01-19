import { useState, useRef, useEffect } from 'react';

export function PresentationReview({ presentation, onClose }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
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

  const getCategoryColor = (type) => {
    return type === 'positive' ? 'border-green-500 bg-green-900/20' : 'border-orange-500 bg-orange-900/20';
  };

  if (!feedback) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white">Loading feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex z-50 overflow-hidden">
      {/* Left side - Video player */}
      <div className="w-1/2 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            📊 {presentation.title} - Review
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Video player */}
        <div className="relative bg-black rounded-lg overflow-hidden flex-1">
          <video
            ref={videoRef}
            src={`/api/presentations/${presentation.id}/video`}
            className="w-full h-full object-contain"
            controls
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>

        {/* Overall score and summary */}
        <div className="mt-4 bg-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="text-4xl font-bold text-white">
              {feedback.overall_score}<span className="text-xl text-slate-400">/10</span>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                  style={{ width: `${feedback.overall_score * 10}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-slate-300 text-sm">{feedback.summary}</p>
        </div>
      </div>

      {/* Right side - Feedback list */}
      <div className="w-1/2 border-l border-slate-700 flex flex-col">
        {/* Key improvements */}
        {feedback.key_improvements && feedback.key_improvements.length > 0 && (
          <div className="p-4 border-b border-slate-700 bg-slate-800">
            <h3 className="text-sm font-medium text-blue-400 uppercase tracking-wide mb-2">
              🎯 Key Improvements
            </h3>
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
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
            Timestamped Feedback ({feedback.feedback?.length || 0})
          </h3>
          
          <div className="space-y-3">
            {feedback.feedback?.map((item, i) => {
              const isActive = currentTime >= item.timestamp_seconds && 
                currentTime < (feedback.feedback[i + 1]?.timestamp_seconds || Infinity);
              
              return (
                <button
                  key={i}
                  onClick={() => seekTo(item.timestamp_seconds)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${getCategoryColor(item.type)} ${
                    isActive ? 'ring-2 ring-blue-500' : ''
                  } hover:ring-2 hover:ring-slate-500`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-xl">{getCategoryIcon(item.category)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-slate-700 px-2 py-0.5 rounded text-slate-300">
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
    </div>
  );
}
