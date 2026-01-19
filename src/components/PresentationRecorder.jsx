import { useState, useRef, useEffect, useCallback } from 'react';

export function PresentationRecorder({ presentation, onComplete, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Request camera/mic access on mount
  useEffect(() => {
    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 1280, height: 720 },
          audio: true,
        });
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError('Could not access camera/microphone. Please allow permissions.');
        console.error('Media access error:', err);
      }
    }
    
    setupMedia();
    
    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    videoChunksRef.current = [];
    audioChunksRef.current = [];

    // Video recorder (video + audio)
    const videoRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp9,opus',
    });
    videoRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        videoChunksRef.current.push(e.data);
      }
    };
    mediaRecorderRef.current = videoRecorder;

    // Audio-only recorder for Gemini
    const audioStream = new MediaStream(streamRef.current.getAudioTracks());
    const audioRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus',
    });
    audioRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };
    audioRecorderRef.current = audioRecorder;

    videoRecorder.start(1000);
    audioRecorder.start(1000);
    
    startTimeRef.current = Date.now();
    setIsRecording(true);
    setIsPaused(false);

    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      audioRecorderRef.current?.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      audioRecorderRef.current?.resume();
      setIsPaused(false);
      
      const pausedDuration = duration;
      startTimeRef.current = Date.now() - (pausedDuration * 1000);
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
  }, [duration]);

  const stopRecording = useCallback(async () => {
    clearInterval(timerRef.current);
    
    return new Promise((resolve) => {
      let completedCount = 0;
      const checkComplete = () => {
        completedCount++;
        if (completedCount === 2) resolve();
      };

      mediaRecorderRef.current.onstop = checkComplete;
      audioRecorderRef.current.onstop = checkComplete;

      mediaRecorderRef.current.stop();
      audioRecorderRef.current.stop();
    });
  }, []);

  const handleFinish = async () => {
    setIsUploading(true);
    
    try {
      await stopRecording();

      // Create blobs
      const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

      // Convert to base64
      const videoBase64 = await blobToBase64(videoBlob);
      const audioBase64 = await blobToBase64(audioBlob);

      // Upload to server
      const uploadRes = await fetch(`/api/presentations/${presentation.id}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video: videoBase64,
          audio: audioBase64,
          duration,
        }),
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      // Trigger analysis
      const analyzeRes = await fetch(`/api/presentations/${presentation.id}/analyze`, {
        method: 'POST',
      });

      if (!analyzeRes.ok) {
        throw new Error('Analysis failed');
      }

      const result = await analyzeRes.json();
      onComplete(result);
    } catch (err) {
      setError(err.message);
      setIsUploading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            🎤 {presentation.title}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white"
            disabled={isUploading}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        {/* Video preview */}
        <div className="relative bg-black rounded-lg overflow-hidden mb-4">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {/* Recording indicator */}
          {isRecording && !isPaused && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-medium">REC</span>
            </div>
          )}

          {/* Timer */}
          <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-1 rounded text-white font-mono">
            {formatTime(duration)}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isUploading || !!error}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <span className="w-4 h-4 bg-white rounded-full" />
              Start Recording
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={resumeRecording}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                >
                  ▶ Resume
                </button>
              ) : (
                <button
                  onClick={pauseRecording}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-medium"
                >
                  ⏸ Pause
                </button>
              )}
              <button
                onClick={handleFinish}
                disabled={isUploading || duration < 5}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium"
              >
                {isUploading ? 'Analyzing...' : '✓ Finish & Analyze'}
              </button>
            </>
          )}
        </div>

        {isUploading && (
          <div className="mt-4 text-center text-slate-400">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full mb-2" />
            <p>Uploading and analyzing your presentation...</p>
            <p className="text-sm">This may take a minute.</p>
          </div>
        )}

        <p className="text-slate-500 text-sm text-center mt-4">
          Tip: Record at least 30 seconds for meaningful feedback
        </p>
      </div>
    </div>
  );
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
