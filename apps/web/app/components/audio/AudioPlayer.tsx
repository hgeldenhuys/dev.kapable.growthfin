import { useMediaQuery } from '~/hooks/useMediaQuery';
import { AudioPlayerPanel } from './AudioPlayerPanel';
import { AudioPlayerDrawer } from './AudioPlayerDrawer';
import { AudioPlayerToast } from './AudioPlayerToast';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { useAudioPlayer } from './AudioPlayerProvider';

export function AudioPlayer() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { showKeyboardHelp, setShowKeyboardHelp } = useAudioPlayer();

  return (
    <>
      {isDesktop ? <AudioPlayerPanel /> : <AudioPlayerDrawer />}
      <AudioPlayerToast />
      <KeyboardShortcutsHelp
        open={showKeyboardHelp}
        onOpenChange={setShowKeyboardHelp}
      />
    </>
  );
}
