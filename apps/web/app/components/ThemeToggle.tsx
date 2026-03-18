import { useFetcher } from "react-router";
import type { Theme } from "../lib/theme";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

interface ThemeToggleProps {
	currentTheme: Theme;
}

export function ThemeToggle({ currentTheme }: ThemeToggleProps) {
	const fetcher = useFetcher();

	const nextTheme = currentTheme === "light" ? "dark" : "light";

	return (
		<fetcher.Form method="post" action="/api/theme">
			<input type="hidden" name="theme" value={nextTheme} />
			<Button
				type="submit"
				variant="ghost"
				size="icon"
				className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 rounded-full border border-border/50 bg-background/50"
				aria-label={`Switch to ${nextTheme} theme`}
			>
				{currentTheme === "light" ? (
					<Moon className="h-4 w-4" />
				) : (
					<Sun className="h-4 w-4" />
				)}
			</Button>
		</fetcher.Form>
	);
}
