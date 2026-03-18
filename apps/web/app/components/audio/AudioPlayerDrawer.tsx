import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '~/components/ui/drawer';
import { useAudioPlayer } from './AudioPlayerProvider';
import { AudioPlayerControls } from './AudioPlayerControls';
import { AudioPlayerQueue } from './AudioPlayerQueue';

export function AudioPlayerDrawer() {
  const { isPanelOpen, togglePanel } = useAudioPlayer();

  return (
    <Drawer open={isPanelOpen} onOpenChange={togglePanel}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Audio Player</DrawerTitle>
        </DrawerHeader>

        <div className="p-4 flex flex-col gap-4 max-h-[80vh] overflow-hidden">
          <AudioPlayerControls />
          <AudioPlayerQueue />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
