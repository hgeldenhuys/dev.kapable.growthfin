import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Moon, Sun, LogIn } from 'lucide-react';
import { Link } from 'react-router';

export function NavigationBar() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme from system preference or localStorage
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark' || (!savedTheme && isDarkMode)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/landing" className="text-2xl font-bold bg-gradient-to-r from-growthfin-primary to-growthfin-secondary bg-clip-text text-transparent">
              ACME CORP
            </Link>
          </div>

          {/* Right side: Theme toggle + Login */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600" />
              )}
            </Button>

            {/* Login/Dashboard Link */}
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="gap-2"
            >
              <Link to="/dashboard">
                <LogIn className="h-4 w-4" />
                Login
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
