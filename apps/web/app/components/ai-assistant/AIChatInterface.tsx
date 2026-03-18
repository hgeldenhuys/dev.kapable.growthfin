/**
 * Integration: AI Chat Interface
 * Combines all chat components with state management + voice
 */

import { useAIChat } from '../../hooks/ai-assistant/useAIChat';
import { useVoiceChat } from '../../hooks/ai-assistant/useVoiceChat';
import { AIChatMessageList } from './AIChatMessageList';
import { AIChatInput } from './AIChatInput';
import { AIChatTypingIndicator } from './AIChatTypingIndicator';

export interface AIChatInterfaceProps {
  workspaceId: string;
  userId: string;
}

export function AIChatInterface({ workspaceId, userId }: AIChatInterfaceProps) {
  const { messages, isLoading, isSending, sendMessage, clearConversation } = useAIChat({
    workspaceId,
    userId,
  });

  const voice = useVoiceChat({ workspaceId, userId });

  const handleSend = async (message: string) => {
    // Check for /clear command
    if (message === '/clear') {
      await clearConversation();
      return;
    }

    await sendMessage(message);
  };

  return (
    <>
      {isLoading && messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      ) : (
        <>
          <AIChatMessageList
            messages={messages}
            onSpeak={voice.speakMessage}
            onStopSpeaking={voice.stopSpeaking}
            isSpeaking={voice.isSpeaking}
            isSpeakLoading={voice.isSpeakLoading}
          />
          {isSending && <AIChatTypingIndicator />}
        </>
      )}

      <AIChatInput
        onSend={handleSend}
        onVoiceSend={voice.stopAndSend}
        isLoading={isSending}
        isRecording={voice.isRecording}
        isTranscribing={voice.isTranscribing}
        recordingDuration={voice.recordingDuration}
        onStartRecording={voice.startRecording}
        onCancelRecording={voice.cancelRecording}
        recordingError={voice.recordingError}
      />
    </>
  );
}
