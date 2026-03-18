/**
 * Chat with AI Assistant
 * Interactive chat interface for conversing with the AI assistant
 */

import { useEffect, useRef, useState } from 'react';
import { Card } from '~/components/ui/card';
import { ScrollArea } from '~/components/ui/scroll-area';
import { MessageList } from '~/components/chat/MessageList';
import { MessageInput } from '~/components/chat/MessageInput';
import { ThreeTierModelSelector } from '~/components/chat/ThreeTierModelSelector';
import { ThinkingToggle } from '~/components/chat/ThinkingToggle';
import { Button } from '~/components/ui/button';
import { Trash2, MessageCircle } from 'lucide-react';
import { useConversation } from '~/hooks/useConversation';
import { useStreamingChat } from '~/hooks/useStreamingChat';
import { useCredentials } from '~/hooks/useCredentials';
import { useProvidersByCredential } from '~/hooks/useProvidersByCredential';
import { useModelsByCredentialAndProvider } from '~/hooks/useModelsByCredentialAndProvider';
import { toast, Toaster } from 'sonner';

const DEFAULT_WORKSPACE_ID = '9d753529-cc68-4a23-9063-68ac0e952403';

export default function Chat() {
  const [selectedCredential, setSelectedCredential] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);

  const {
    conversation,
    messages,
    isLoading,
    deleteAndCreateNew,
  } = useConversation(DEFAULT_WORKSPACE_ID);

  const {
    streamingMessage,
    isStreaming,
    sendMessage,
  } = useStreamingChat(conversation?.id);

  // Fetch credentials, providers, and models for three-tier selection
  const { data: credentials = [], isLoading: isLoadingCredentials } = useCredentials();
  const { data: providers = [], isLoading: isLoadingProviders } = useProvidersByCredential(selectedCredential);
  const { data: models = [], isLoading: isLoadingModels } = useModelsByCredentialAndProvider(
    selectedCredential,
    selectedProvider
  );

  // Restore credential from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chat-selected-credential');
    if (saved) {
      setSelectedCredential(saved);
    }
  }, []);

  // Restore thinking mode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chat-thinking-enabled');
    if (saved !== null) {
      setThinkingEnabled(saved === 'true');
    }
  }, []);

  // Persist thinking mode to localStorage on change
  useEffect(() => {
    localStorage.setItem('chat-thinking-enabled', String(thinkingEnabled));
  }, [thinkingEnabled]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, streamingMessage]);

  const handleSendMessage = async (message: string) => {
    if (!conversation?.id) {
      toast.error('No active conversation');
      return;
    }

    if (!selectedModel) {
      toast.error('Please select a model first');
      return;
    }

    try {
      await sendMessage(message, selectedModel, thinkingEnabled);
    } catch (error) {
      toast.error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleClearConversation = async () => {
    try {
      await deleteAndCreateNew();
      toast.success('Conversation cleared');
    } catch (error) {
      toast.error(`Failed to clear conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const showEmptyState = messages.length === 0 && !streamingMessage && !isLoading;

  return (
    <>
      <Toaster />
      <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">Chat with AI Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Ask questions about your projects and get insights
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearConversation}
              disabled={isLoading || isStreaming}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Three-Tier Model Selector */}
      <ThreeTierModelSelector
        credentials={credentials}
        providers={providers}
        models={models}
        selectedCredential={selectedCredential}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        onCredentialChange={setSelectedCredential}
        onProviderChange={setSelectedProvider}
        onModelChange={setSelectedModel}
        isLoadingCredentials={isLoadingCredentials}
        isLoadingProviders={isLoadingProviders}
        isLoadingModels={isLoadingModels}
        disabled={isStreaming}
      />

      {/* Thinking Mode Toggle */}
      <div className="px-4 py-2 border-b bg-muted/10">
        <div className="flex items-center justify-end max-w-5xl mx-auto">
          <ThinkingToggle
            enabled={thinkingEnabled}
            onChange={setThinkingEnabled}
            disabled={isStreaming}
          />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-5xl mx-auto px-6 py-6">
          {showEmptyState ? (
            <div className="h-full flex items-center justify-center">
              <Card className="p-12 max-w-2xl w-full">
                <div className="flex flex-col items-center text-center space-y-4">
                  <MessageCircle className="h-12 w-12 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Start a conversation</h2>
                  <p className="text-muted-foreground">
                    Ask me anything about your projects, sessions, or observability data.
                  </p>
                  <div className="grid gap-2 w-full mt-4">
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3"
                      onClick={() => handleSendMessage('Tell me about my recent projects')}
                    >
                      Tell me about my recent projects
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3"
                      onClick={() => handleSendMessage('Analyze my recent sessions')}
                    >
                      Analyze my recent sessions
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-auto py-3"
                      onClick={() => handleSendMessage('What are my most used tools?')}
                    >
                      What are my most used tools?
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <MessageList
                messages={messages.map(m => ({
                  ...m,
                  timestamp: m.createdAt,
                  thinkingContent: m.thinkingContent,
                }))}
                streamingMessage={streamingMessage}
                isLoading={isLoading}
              />
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="border-t bg-background">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <MessageInput
            onSend={handleSendMessage}
            disabled={isLoading || isStreaming || !conversation?.id}
            isLoading={isStreaming}
          />
        </div>
      </div>
    </div>
    </>
  );
}
