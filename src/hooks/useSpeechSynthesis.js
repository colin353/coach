import { useState, useCallback, useRef, useEffect } from 'react';
import * as tts from '@diffusionstudio/vits-web';

const VOICE_ID = 'en_US-hfc_female-medium';

// Strip markdown formatting
function preprocessText(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold**
    .replace(/\*([^*]+)\*/g, '$1')       // *italic*
    .replace(/__([^_]+)__/g, '$1')       // __bold__
    .replace(/_([^_]+)_/g, '$1')         // _italic_
    .replace(/`([^`]+)`/g, '$1')         // `code`
    .replace(/#{1,6}\s*/g, '')           // # headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [links](url)
    .replace(/[*_~`]/g, '')              // stray markers
    .replace(/<PAUSE>/gi, '');           // remove pause markers
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
      const text = queueRef.current.shift();

      try {
        if (isModelReady) {
          const wav = await tts.predict({
            text: text,
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
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = resolve;
            utterance.onerror = resolve;
            window.speechSynthesis.speak(utterance);
          });
        }
      } catch (error) {
        console.error('TTS error:', error);
      }
    }

    isProcessingRef.current = false;
    setIsSpeaking(false);
    audioRef.current = null;
  }, [isModelReady]);

  // Queue a sentence for speaking (for streaming)
  const queueSentence = useCallback((sentence) => {
    const cleaned = preprocessText(sentence);
    if (cleaned.trim()) {
      queueRef.current.push(cleaned);
      processQueue();
    }
  }, [processQueue]);

  // Speak full text at once
  const speak = useCallback(async (text) => {
    stop();
    abortRef.current = false;
    
    const sentences = splitIntoSentences(text);
    queueRef.current.push(...sentences);
    
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
