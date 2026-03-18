import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { useAudioPlayer } from './AudioPlayerProvider';
import type { AudioQueueItem } from './AudioPlayerProvider';

function QueueItem({
  item,
  isCurrent,
  onRemove,
}: {
  item: AudioQueueItem;
  isCurrent: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-md ${
        isCurrent
          ? 'bg-primary/10 border border-primary'
          : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {item.messagePreview}
        </p>
        <p className="text-xs text-muted-foreground">
          {isCurrent ? 'Now Playing' : 'Queued'}
        </p>
      </div>
      {!isCurrent && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => onRemove(item.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function AudioPlayerQueue() {
  const { currentTrack, queue, removeFromQueue, clearQueue } = useAudioPlayer();

  const hasItems = currentTrack || queue.length > 0;

  if (!hasItems) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">No audio in queue</p>
        <p className="text-xs mt-1">
          Click the play button on any message to start
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-semibold">
          Queue ({currentTrack ? 1 : 0} + {queue.length})
        </h3>
        {hasItems && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearQueue}
            className="h-7 text-xs"
          >
            Clear All
          </Button>
        )}
      </div>

      <ScrollArea className="h-[300px] px-4">
        <div className="flex flex-col gap-2 pb-4">
          {currentTrack && (
            <QueueItem
              item={currentTrack}
              isCurrent={true}
              onRemove={removeFromQueue}
            />
          )}

          {queue.map((item) => (
            <QueueItem
              key={item.id}
              item={item}
              isCurrent={false}
              onRemove={removeFromQueue}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
