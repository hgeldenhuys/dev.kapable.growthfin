/**
 * US-AI-009: Chat Widget Component
 * Floating chat widget in bottom-right corner
 */

import { MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useAIChatStore } from '../../stores/aiChatStore';
import { AIChatHeader } from './AIChatHeader';
import { AIChatInterface } from './AIChatInterface';
import { AIChatUnconfigured } from './AIChatUnconfigured';
import { useAIChat } from '../../hooks/ai-assistant/useAIChat';
import { useAIConfig } from '../../hooks/ai-assistant/useAIConfig';
import { cn } from '../../lib/utils';

export interface AIChatWidgetProps {
  workspaceId: string;
  userId: string;
  className?: string;
}

export function AIChatWidget({ workspaceId, userId, className }: AIChatWidgetProps) {
  const { isMinimized, minimize, maximize, voiceMode, toggleVoiceMode } = useAIChatStore();
  const { clearConversation } = useAIChat({ workspaceId, userId });
  const { data: config, isLoading } = useAIConfig(workspaceId);

  const handleClear = async () => {
    await clearConversation();
  };

  // Don't show widget while loading config
  if (isLoading) return null;

  // Check if AI is configured (either with direct API key OR LLM config)
  const isConfigured = config?.hasApiKey === true || !!config?.llmConfigId;

  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      <AnimatePresence mode="wait">
        {isMinimized ? (
          <motion.div
            key="minimized"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              onClick={maximize}
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              size="icon"
              data-testid="ai-chat-toggle"
            >
              <MessageSquare className="h-6 w-6" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
            className="w-[400px] max-w-[calc(100vw-2rem)]"
          >
            <Card className="flex flex-col shadow-2xl border-2 overflow-hidden h-[600px] max-h-[calc(100vh-6rem)] pb-0">
              <AIChatHeader
                onMinimize={minimize}
                onClear={handleClear}
                voiceMode={voiceMode}
                onToggleVoiceMode={toggleVoiceMode}
              />
              {!isConfigured ? (
                <AIChatUnconfigured workspaceId={workspaceId} />
              ) : (
                <AIChatInterface workspaceId={workspaceId} userId={userId} />
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
