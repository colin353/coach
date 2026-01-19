import { useState, useCallback, useRef, useEffect } from 'react';
import * as tts from '@diffusionstudio/vits-web';

const VOICE_ID = 'en_US-hfc_female-medium';
const PAUSE_MS = 300; // milliseconds for <PAUSE>

// Strip markdown and extract pauses
function preprocessText(text) {
  // Remove markdown formatting
  let cleaned = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold**
    .replace(/\*([^*]+)\*/g, '$1')       // *italic*
    .replace(/__([^_]+)__/g, '$1')       // __bold__
    .replace(/_([^_]+)_/g, '$1')         // _italic_
    .replace(/`([^`]+)`/g, '$1')         // `code`
    .replace(/#{1,6}\s*/g, '')           // # headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [links](url)
    .replace(/[*_~`]/g, '');             // stray markers

  return cleaned;
}

// Split text into speakable segments (sentences + pause markers)
function splitIntoSegments(text) {
  const cleaned = preprocessText(text);
  const segments = [];
  
  // Split on <PAUSE> first
  const parts = cleaned.split(/<PAUSE>/gi);
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part) {
      segments.push({ type: 'speech', text: part });
    }
    // Add pause between parts (not after last)
    if (i < parts.length - 1) {
      segments.push({ type: 'pause', duration: PAUSE_MS });
    }
  }
  
  return segments;
}

// Split text into sentences for streaming
function splitIntoSentences(text) {
  const cleaned = preprocessText(text);
  // Split on sentence endings, keeping the punctuation
  const sentences = cleaned.match(/[^.!?]+[.!?]+[\s]*/g) || [cleaned];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const audioRef = useRef(null);
  const abortRef = useRef(false);
  const queueRef = useRef([]);
  const isProcessingRef = useRef(false);

  // Preload the model on mount
  useEffect(() => {
    tts.download(VOICE_ID, (progress) => {
      console.log(`TTS model: ${Math.round((progress.loaded * 100) / progress.total)}%`);
    }).then(() => {
      setIsModelReady(true);
      console.log('TTS model ready');
    }).catch((err) => {
      console.error('TTS model download failed:', err);
    });
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    setIsSpeaking(true);

    while (queueRef.current.length > 0 && !abortRef.current) {
      const segment = queueRef.current.shift();
      
      if (segment.type === 'pause') {
        await new Promise(resolve => setTimeout(resolve, segment.duration));
        continue;
      }

      try {
        if (isModelReady) {
          const wav = await tts.predict({
            text: segment.text,
            voiceId: VOICE_ID,
          });

          if (abortRef.current) break;

          const audio = new Audio();
          audio.src = URL.createObjectURL(wav);
          audioRef.current = audio;

          await new Promise((resolve, reject) => {
            audio.onended = resolve;
            audio.onerror = reject;
            audio.play().catch(reject);
          });
        } else {
          // Fallback to browser TTS
          await new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(segment.text);
            utterance.onend = resolve;
            utterance.onerror = resolve;
            window.speechSynthesis.speak(utterance);
          });
        }
      } catch (error) {
        console.error('TTS segment error:', error);
      }
    }

    isProcessingRef.current = false;
    setIsSpeaking(false);
    audioRef.current = null;
  }, [isModelReady]);

  // Queue a sentence for speaking (for streaming)
  const queueSentence = useCallback((sentence) => {
    const segments = splitIntoSegments(sentence);
    queueRef.current.push(...segments);
    processQueue();
  }, [processQueue]);

  // Speak full text at once
  const speak = useCallback(async (text) => {
    stop();
    abortRef.current = false;
    
    const sentences = splitIntoSentences(text);
    for (const sentence of sentences) {
      const segments = splitIntoSegments(sentence);
      queueRef.current.push(...segments);
    }
    
    processQueue();
  }, [processQueue]);

  const stop = useCallback(() => {
    abortRef.current = true;
    queueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    isProcessingRef.current = false;
  }, []);

  return {
    isSpeaking,
    isModelReady,
    speak,
    queueSentence,
    stop,
  };
}
