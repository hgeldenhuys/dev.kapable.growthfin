/**
 * EventTypeRouter Component
 *
 * Routes to the appropriate view component based on event type
 * Extensible for adding new event-specific views in Phase 2
 */

import type { HookEvent } from '~/hooks/useHookEvent';
import { StopEventView } from './views/StopEventView';
import { GenericEventView } from './views/GenericEventView';

interface EventTypeRouterProps {
  event: HookEvent;
}

export function EventTypeRouter({ event }: EventTypeRouterProps) {
  switch (event.eventName) {
    case 'Stop':
    case 'SubagentStop':
      return <StopEventView event={event} />;

    // Add more custom views here in Phase 2:
    // case 'PreToolUse':
    //   return <PreToolUseView event={event} />;
    // case 'PostToolUse':
    //   return <PostToolUseView event={event} />;
    // case 'UserPromptSubmit':
    //   return <UserPromptSubmitView event={event} />;

    default:
      return <GenericEventView event={event} />;
  }
}
