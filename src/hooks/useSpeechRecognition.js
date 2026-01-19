import { useState, useEffect, useRef, useCallback } from 'react';

export function useSpeechRecognition({ onResult, onInterim }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript && onResult) {
        onResult(finalTranscript);
      }
      if (interimTranscript && onInterim) {
        onInterim(interimTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Restart if we're still supposed to be listening
      if (recognitionRef.current?.shouldRestart) {
        recognition.start();
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onResult, onInterim]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.shouldRestart = true;
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.shouldRestart = false;
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
