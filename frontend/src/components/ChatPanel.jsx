// src/components/ChatPanel.jsx
import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { RenderResult } from './RenderResult';

const AssistantBubble = ({ children }) => (
  <div className="flex gap-3">
    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold text-xs shadow-md">
      D
    </div>
    <div className="flex flex-col gap-3 flex-1 min-w-0">{children}</div>
  </div>
);

const UserBubble = ({ content }) => (
  <div className="flex gap-3 justify-end">
    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-sm max-w-[85%]">
      {content}
    </div>
  </div>
);

export const ChatPanel = ({
  query,
  setQuery,
  handleQuery,
  loading,
  chatHistory,
  narrationText,
  narrationStreaming,
  error,
  result,
  action,
}) => {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom whenever chat history changes or narration updates
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      // ScrollArea uses a viewport child
      const viewport = el.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [chatHistory, narrationText, loading]);

  return (
    <div className="flex flex-col w-full h-full bg-card/80 backdrop-blur-xl">
      <div className="px-6 py-5 border-b border-border bg-card">
        <h2 className="font-semibold text-base text-foreground">Chat with Graph</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Order to Cash Process</p>
      </div>

      <div className="flex-1 overflow-hidden min-h-0" ref={scrollRef}>
        <ScrollArea className="h-full">
          <div className="space-y-5 px-6 py-6">
            {/* Welcome message */}
            <AssistantBubble>
              <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-sm p-4 text-sm text-foreground shadow-sm">
                <p>Hi! I can help you analyze the <strong className="font-medium">Order to Cash</strong> process.</p>
                <div className="mt-3 text-muted-foreground">
                  Try asking:<br />
                  <span className="text-foreground font-mono bg-background px-1.5 py-0.5 rounded text-xs border border-border/50 shadow-sm inline-block mt-1">trace billing 91150083</span>
                </div>
              </div>
            </AssistantBubble>

            {/* Conversation history */}
            {chatHistory.map((msg, idx) => {
              if (msg.role === 'user') {
                return <UserBubble key={idx} content={msg.content} />;
              }

              // Assistant message
              const isLastAssistant = idx === chatHistory.length - 1 && msg.role === 'assistant';
              const displayText = isLastAssistant && msg._streaming
                ? (narrationText || msg.content || 'Generating narrative...')
                : msg.content;

              return (
                <AssistantBubble key={idx}>
                  <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-sm p-4 text-sm text-foreground shadow-sm leading-relaxed">
                    {displayText}
                  </div>
                  {msg.result && <RenderResult action={msg.action} result={msg.result} />}
                </AssistantBubble>
              );
            })}

            {/* Loading indicator */}
            {loading && (
              <AssistantBubble>
                <div className="bg-muted/50 border border-border py-2.5 px-5 rounded-full text-sm text-muted-foreground shadow-sm inline-flex items-center gap-2 w-fit">
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  <span className="ml-2">Running query...</span>
                </div>
              </AssistantBubble>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 bg-card border-t border-border shrink-0">
        <form onSubmit={handleQuery} className="relative flex items-center shadow-sm rounded-xl bg-background border border-border focus-within:ring-2 ring-primary/20 transition-all">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Analyze anything..."
            className="pr-12 py-6 bg-transparent border-0 focus-visible:ring-0 text-sm"
          />
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            size="icon"
            variant="ghost"
            className="absolute right-1.5 h-9 w-9 rounded-lg hover:bg-muted text-foreground/70 transition-transform"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
};
