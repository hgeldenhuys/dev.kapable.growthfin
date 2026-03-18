/**
 * SDLC Navigation Component
 * Route-based navigation with active state highlighting
 * Shows badges for session and board counts
 */

import { NavLink } from "react-router";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import {
  LayoutDashboard,
  Boxes,
  Activity,
  ListChecks,
  Network,
  Info
} from "lucide-react";

interface SDLCNavigationProps {
  sessionsCount: number;
  boardsCount: number;
}

export function SDLCNavigation({ sessionsCount, boardsCount }: SDLCNavigationProps) {
  const navItems = [
    {
      to: "/claude/sdlc/overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      to: "/claude/sdlc/boards",
      label: "Boards",
      icon: Boxes,
      badge: boardsCount,
    },
    {
      to: "/claude/sdlc/sessions",
      label: "Sessions",
      icon: Activity,
      badge: sessionsCount,
    },
    {
      to: "/claude/sdlc/tasks",
      label: "Tasks",
      icon: ListChecks,
    },
    {
      to: "/claude/sdlc/knowledge-graph",
      label: "Knowledge Graph",
      icon: Network,
    },
    {
      to: "/claude/sdlc/about",
      label: "About",
      icon: Info,
    },
  ];

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto">
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors hover:text-primary border-b-2 border-transparent whitespace-nowrap",
                    isActive
                      ? "text-primary border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {item.badge}
                  </Badge>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
