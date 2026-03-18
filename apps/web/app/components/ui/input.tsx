import * as React from "react";

import { cn } from "../../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"file:text-foreground placeholder:text-muted-foreground/50 selection:bg-primary/10 selection:text-primary dark:bg-muted/10 border-border/50 flex h-10 w-full min-w-0 rounded-xl border bg-background/50 backdrop-blur-sm px-4 py-2 text-base shadow-sm transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus:border-primary/50 focus:ring-4 focus:ring-primary/5 focus:bg-background",
				"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				className
			)}
			{...props}
		/>
	);
}

export { Input };
