/**
 * Shell Switcher Component
 * Allows navigation between Dashboard (CRM) and Manage (Settings) shells
 */
import { Link, useLocation } from "react-router";
import { LayoutDashboard, Settings } from "lucide-react";
import { cn } from "../lib/utils";

export function ShellSwitcher() {
  const location = useLocation();

  // Determine which shell we're currently in
  const isManageShell = location.pathname.startsWith('/manage');
  const isDashboardShell = location.pathname.startsWith('/dashboard');

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/50 p-1">
      <Link
        to="/dashboard"
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          isDashboardShell
            ? "bg-background text-foreground shadow-sm border border-border/50"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutDashboard className="h-4 w-4" />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>

      <Link
        to="/manage/audio"
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          isManageShell
            ? "bg-background text-foreground shadow-sm border border-border/50"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Manage</span>
      </Link>
    </div>
  );
}
