import { useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
	// Read theme from document class (set by ThemeToggle component)
	const [theme, setTheme] = useState<"light" | "dark">("light");

	useEffect(() => {
		// Check if document has dark class
		const isDark = document.documentElement.classList.contains("dark");
		setTheme(isDark ? "dark" : "light");

		// Watch for theme changes
		const observer = new MutationObserver(() => {
			const isDark = document.documentElement.classList.contains("dark");
			setTheme(isDark ? "dark" : "light");
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	return (
		<Sonner
			theme={theme}
			className="toaster group"
			toastOptions={{
				classNames: {
					toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
					description: "group-[.toast]:text-muted-foreground",
					actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
					cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
