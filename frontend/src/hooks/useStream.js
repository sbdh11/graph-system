// src/hooks/useStream.js
import { useState, useRef, useCallback } from 'react';
import { generateNaturalLanguage } from '../utils/nlTemplate';

export function useStream() {
  const [narrationText, setNarrationText] = useState('');
  const [narrationStreaming, setNarrationStreaming] = useState(false);
  const narrationAbortRef = useRef(null);

  const abortNarration = useCallback(() => {
    if (narrationAbortRef.current) {
      try {
        narrationAbortRef.current.abort();
      } catch {
        // ignore
      }
      narrationAbortRef.current = null;
    }
  }, []);

  const startNarrationStream = useCallback(async ({ queryText, actionType, resultData, chatHistoryRef, onChatAppend }) => {
    abortNarration();

    const deterministicFallback = generateNaturalLanguage(resultData, actionType) || '';
    setNarrationText((prev) => (prev ? prev : deterministicFallback));
    setNarrationStreaming(true);

    const controller = new AbortController();
    narrationAbortRef.current = controller;

    try {
      const res = await fetch('http://localhost:3000/narrate_stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          action: actionType,
          result: resultData,
          messages: chatHistoryRef?.current || [],
        }),
        signal: controller.signal,
      });

      const startTimeoutMs = 2500;
      const abortTimer = setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }, startTimeoutMs);

      if (!res.ok || !res.body) {
        clearTimeout(abortTimer);
        const fallback = generateNaturalLanguage(resultData, actionType) || 'Here is the flow analysis:';
        setNarrationText(fallback);
        setNarrationStreaming(false);
        onChatAppend?.(queryText, fallback);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let text = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        clearTimeout(abortTimer);
        text += chunk;
        setNarrationText(text);
      }

      const tail = decoder.decode();
      if (tail) {
        text += tail;
        setNarrationText(text);
      }

      setNarrationStreaming(false);
      onChatAppend?.(queryText, text);
    } catch {
      const fallback = generateNaturalLanguage(resultData, actionType) || 'Here is the flow analysis:';
      setNarrationText(fallback);
      setNarrationStreaming(false);
    }
  }, [abortNarration]);

  const resetNarration = useCallback(() => {
    setNarrationText('');
    setNarrationStreaming(false);
  }, []);

  return {
    narrationText,
    narrationStreaming,
    startNarrationStream,
    abortNarration,
    resetNarration,
    setNarrationText,
  };
}
