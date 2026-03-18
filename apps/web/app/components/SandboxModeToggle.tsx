/**
 * Sandbox Mode Toggle
 * Persistent toggle in the header showing current sandbox state
 * Visible across all pages so users always know if sandbox is enabled
 */

import { useEffect, useState } from 'react';
import { useOptionalWorkspaceContext } from '~/contexts/WorkspaceContext';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { FlaskConical, Loader2 } from 'lucide-react';
import { cn } from '~/lib/utils';
import { ContextualHelp } from './crm/ContextualHelp';

export function SandboxModeToggle() {
  const wsContext = useOptionalWorkspaceContext();
  const workspaceId = wsContext?.currentWorkspace?.id ?? null;

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fetch sandbox config on mount and subscribe to changes
  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    const fetchConfig = async () => {
      try {
        const response = await fetch(
          `/api/v1/crm/sandbox/config?workspaceId=${workspaceId}`
        );
        if (response.ok) {
          const data = await response.json();
          setEnabled(data.config?.enabled || false);
        }
      } catch (error) {
        console.error('Failed to fetch sandbox config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [workspaceId]);

  const handleToggle = async () => {
    setConfirmOpen(false);
    setToggling(true);
    try {
      const response = await fetch(
        `/api/v1/crm/sandbox/config?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !enabled }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEnabled(data.config?.enabled || false);
      }
    } catch (error) {
      console.error('Failed to toggle sandbox:', error);
    } finally {
      setToggling(false);
    }
  };

  // No workspace context — hide toggle (e.g. /manage routes)
  if (!workspaceId) return null;

  if (loading) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
      <ContextualHelp topic="sandbox-mode" workspaceId={workspaceId ?? undefined} />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setConfirmOpen(true)}
        disabled={toggling}
        title={`Sandbox Mode: ${enabled ? 'ON' : 'OFF'}`}
        className={cn(
          'h-9 w-9 transition-all duration-200',
          enabled
            ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 bg-amber-500/5'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        {toggling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <FlaskConical
              className={cn(
                'h-4 w-4',
                enabled && 'fill-current'
              )}
            />
            {enabled && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </>
        )}
      </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {enabled ? 'Disable Sandbox Mode?' : 'Enable Sandbox Mode?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {enabled
                ? 'Disabling sandbox mode will route emails, SMS, and calls through live providers. Messages will be delivered to real recipients.'
                : 'Enabling sandbox mode will intercept all outbound emails, SMS, and calls. No messages will be delivered to real recipients.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle}>
              {enabled ? 'Disable Sandbox' : 'Enable Sandbox'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
