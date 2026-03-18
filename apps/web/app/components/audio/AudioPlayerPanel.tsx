import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { useAudioPlayer } from './AudioPlayerProvider';
import { AudioPlayerControls } from './AudioPlayerControls';
import { AudioPlayerQueue } from './AudioPlayerQueue';

export function AudioPlayerPanel() {
  const { isPanelOpen, togglePanel } = useAudioPlayer();

  return (
    <Sheet open={isPanelOpen} onOpenChange={togglePanel}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle>Audio Player</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          <AudioPlayerControls />
          <AudioPlayerQueue />
        </div>
      </SheetContent>
    </Sheet>
  );
}
