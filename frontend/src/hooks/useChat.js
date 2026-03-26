// src/hooks/useChat.js
import { useState, useRef, useEffect, useCallback } from 'react';
import { generateNaturalLanguage } from '../utils/nlTemplate';

const MAX_DISPLAY_MESSAGES = 20; // 10 exchanges (user+assistant each)

export function useChat({ highlightHook, streamHook, fullGraphData, fgRef, lockedNodeRef }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [action, setAction] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  // Each entry: { role: 'user'|'assistant', content: string, result?: any, action?: string }

  const chatHistoryRef = useRef(chatHistory);
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  const { setHighlightFromResult, clearHighlight, setHighlightedIds, setExpandedIds } = highlightHook;
  const { startNarrationStream, abortNarration, resetNarration, setNarrationText } = streamHook;

  const appendChat = useCallback((userMsg, assistantMsg) => {
    // This is called by useStream when narration finishes streaming.
    // We update the last assistant message (which was a placeholder) with final text.
    setChatHistory((prev) => {
      const updated = [...prev];
      // Find the last assistant message and update its content
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === 'assistant' && updated[i]._streaming) {
          updated[i] = { ...updated[i], content: assistantMsg, _streaming: false };
          break;
        }
      }
      return updated.slice(-MAX_DISPLAY_MESSAGES);
    });
  }, []);

  const handleQuery = useCallback(async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage = query.trim();
    setQuery('');
    setLoading(true);
    setError(null);
    setAction(null);
    resetNarration();
    abortNarration();
    clearHighlight();
    lockedNodeRef.current = null;

    // Immediately add the user's message to chat history
    setChatHistory((prev) => [...prev, { role: 'user', content: userMessage }].slice(-MAX_DISPLAY_MESSAGES));

    try {
      const res = await fetch('http://localhost:3000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage }),
      });

      const data = await res.json();

      if (data.answer) {
        // Error / direct answer from engine
        setChatHistory((prev) =>
          [...prev, { role: 'assistant', content: data.answer }].slice(-MAX_DISPLAY_MESSAGES)
        );
        setError(data.answer);
      } else {
        setAction(data.action);
        setResult(data.result);

        const initialNarration = generateNaturalLanguage(data.result, data.action) || '';
        setNarrationText(initialNarration);

        // Add a streaming assistant placeholder
        setChatHistory((prev) =>
          [...prev, {
            role: 'assistant',
            content: initialNarration,
            result: data.result,
            action: data.action,
            _streaming: true,
          }].slice(-MAX_DISPLAY_MESSAGES)
        );

        const filteredIds = setHighlightFromResult(data.action, data.result);

        setTimeout(() => {
          const nodes = fullGraphData?.nodes?.filter((n) => filteredIds.has(String(n.id))) || [];
          if (nodes.length === 0) return;
          try {
            fgRef.current?.zoomToFit?.(400, 50, nodes);
          } catch {
            // ignore
          }
        }, 300);

        void startNarrationStream({
          queryText: userMessage,
          actionType: data.action,
          resultData: data.result,
          chatHistoryRef,
          onChatAppend: appendChat,
        });
      }
    } catch {
      const errText = 'Failed to connect to backend engine.';
      setError(errText);
      setChatHistory((prev) =>
        [...prev, { role: 'assistant', content: errText }].slice(-MAX_DISPLAY_MESSAGES)
      );
    } finally {
      setLoading(false);
    }
  }, [query, fullGraphData, fgRef, lockedNodeRef, setHighlightFromResult, clearHighlight, resetNarration, abortNarration, startNarrationStream, appendChat, setNarrationText]);

  return {
    query,
    setQuery,
    loading,
    error,
    result,
    action,
    chatHistory,
    handleQuery,
  };
}
