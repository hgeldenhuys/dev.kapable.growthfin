import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';

interface ShortcutRowProps {
  shortcut: string;
  description: string;
}

function ShortcutRow({ shortcut, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{description}</span>
      <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
        {shortcut}
      </kbd>
    </div>
  );
}

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Control audio playback without using the mouse
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 mt-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2 text-foreground">Playback</h3>
            <div className="space-y-1">
              <ShortcutRow shortcut="Space" description="Play/Pause" />
              <ShortcutRow shortcut="N" description="Next track" />
              <ShortcutRow shortcut="S" description="Stop & clear queue" />
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2 text-foreground">Volume</h3>
            <div className="space-y-1">
              <ShortcutRow shortcut="↑" description="Volume +10%" />
              <ShortcutRow shortcut="↓" description="Volume -10%" />
              <ShortcutRow shortcut="M" description="Mute/Unmute" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 text-foreground">Navigation</h3>
            <div className="space-y-1">
              <ShortcutRow shortcut="P" description="Toggle player panel" />
              <ShortcutRow shortcut="Esc" description="Close panel" />
              <ShortcutRow shortcut="?" description="Show this help" />
            </div>
          </div>
        </div>

        <div className="mt-6 p-3 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground">
            💡 Tip: Keyboard shortcuts are disabled when typing in text fields
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
