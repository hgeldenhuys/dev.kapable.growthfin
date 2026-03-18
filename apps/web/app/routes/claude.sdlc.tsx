/**
 * SDLC Layout Route
 * Provides shared layout and data loading for all SDLC sections
 * React Router v7 - Parent route for all /claude/sdlc/* routes
 */

import { Outlet, useLoaderData, redirect } from "react-router";
import { SDLCNavigation } from "../components/sdlc/SDLCNavigation";
import { GitBranch } from "lucide-react";

export interface SDLCLayoutData {
  sessionsCount: number;
  boardsCount: number;
}

/**
 * Shared loader - fetches data used across all SDLC sections
 * Child routes can access this via useOutletContext
 */
export async function loader({ request }: { request: Request }): Promise<SDLCLayoutData> {
  // Redirect /claude/sdlc to /claude/sdlc/overview
  const url = new URL(request.url);
  if (url.pathname === '/claude/sdlc' || url.pathname === '/claude/sdlc/') {
    throw redirect('/claude/sdlc/overview');
  }

  const [sessionsRes, boardsRes] = await Promise.all([
    fetch('http://localhost:3000/api/v1/sdlc/sessions').then(r => r.json()),
    fetch('http://localhost:3000/api/v1/sdlc/boards').then(r => r.json()),
  ]);

  return {
    sessionsCount: sessionsRes.sessions?.length || 0,
    boardsCount: boardsRes.total_boards || 0,
  };
}

export default function SDLCLayout() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="container mx-auto py-4">
          <div className="flex items-center gap-3">
            <GitBranch className="h-7 w-7" />
            <div>
              <h1 className="text-2xl font-bold">SDLC Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Software development lifecycle tracking
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <SDLCNavigation
        sessionsCount={data.sessionsCount}
        boardsCount={data.boardsCount}
      />

      {/* Content */}
      <Outlet context={data} />
    </div>
  );
}
