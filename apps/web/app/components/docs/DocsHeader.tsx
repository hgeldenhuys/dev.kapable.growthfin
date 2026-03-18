/**
 * DocsHeader - Simple navigation header for documentation pages
 */

import { Link } from 'react-router';
import { BookOpen } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import type { Theme } from '../../lib/theme';

interface DocsHeaderProps {
  theme: Theme;
}

export function DocsHeader({ theme }: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/50 backdrop-blur-xl">
      <div className="container flex h-16 items-center">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-background shadow-lg transition-transform group-hover:scale-105">
              <div className="w-3.5 h-3.5 bg-background rounded-sm" />
            </div>
            <span className="font-bold tracking-tight text-lg uppercase">ACME CORP</span>
          </Link>

          <nav className="flex items-center gap-6 text-sm">
            <Link
              to="/docs"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <BookOpen className="h-4 w-4" />
              <span>Docs</span>
            </Link>
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 mr-4">
            <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Link to="/auth/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Login</Link>
          </div>
          <ThemeToggle currentTheme={theme} />
        </div>
      </div>
    </header>
  );
}
