import * as React from "react";
import { cn } from "../lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const spacingScale = {
	0: "0",
	0.5: "0.125rem",
	1: "0.25rem",
	2: "0.5rem",
	3: "0.75rem",
	4: "1rem",
	5: "1.25rem",
	6: "1.5rem",
	8: "2rem",
	10: "2.5rem",
	12: "3rem",
	16: "4rem",
	20: "5rem",
	24: "6rem",
} as const;

type SpacingValue = keyof typeof spacingScale;

const flexVariants = cva("flex", {
	variants: {
		direction: {
			row: "flex-row",
			col: "flex-col",
			"row-reverse": "flex-row-reverse",
			"col-reverse": "flex-col-reverse",
		},
		align: {
			start: "items-start",
			center: "items-center",
			end: "items-end",
			stretch: "items-stretch",
			baseline: "items-baseline",
		},
		justify: {
			start: "justify-start",
			center: "justify-center",
			end: "justify-end",
			between: "justify-between",
			around: "justify-around",
			evenly: "justify-evenly",
		},
		wrap: {
			true: "flex-wrap",
			false: "flex-nowrap",
			reverse: "flex-wrap-reverse",
		},
		gap: {
			0: "gap-0",
			1: "gap-1",
			2: "gap-2",
			3: "gap-3",
			4: "gap-4",
			5: "gap-5",
			6: "gap-6",
			8: "gap-8",
			10: "gap-10",
			12: "gap-12",
			16: "gap-16",
		},
	},
	defaultVariants: {
		direction: "row",
		align: "stretch",
		justify: "start",
		wrap: false,
	},
});

interface FlexProps extends React.ComponentProps<"div">, VariantProps<typeof flexVariants> {}

export function Flex({ className, direction, align, justify, wrap, gap, ...props }: FlexProps) {
	return (
		<div
			className={cn(flexVariants({ direction, align, justify, wrap, gap }), className)}
			{...props}
		/>
	);
}

const stackVariants = cva("flex flex-col", {
	variants: {
		gap: {
			0: "gap-0",
			1: "gap-1",
			2: "gap-2",
			3: "gap-3",
			4: "gap-4",
			5: "gap-5",
			6: "gap-6",
			8: "gap-8",
			10: "gap-10",
			12: "gap-12",
			16: "gap-16",
		},
		align: {
			start: "items-start",
			center: "items-center",
			end: "items-end",
			stretch: "items-stretch",
		},
	},
	defaultVariants: {
		gap: 4,
		align: "stretch",
	},
});

interface StackProps extends React.ComponentProps<"div">, VariantProps<typeof stackVariants> {}

export function Stack({ className, gap, align, ...props }: StackProps) {
	return <div className={cn(stackVariants({ gap, align }), className)} {...props} />;
}

const gridVariants = cva("grid", {
	variants: {
		cols: {
			1: "grid-cols-1",
			2: "grid-cols-2",
			3: "grid-cols-3",
			4: "grid-cols-4",
			5: "grid-cols-5",
			6: "grid-cols-6",
			12: "grid-cols-12",
		},
		gap: {
			0: "gap-0",
			1: "gap-1",
			2: "gap-2",
			3: "gap-3",
			4: "gap-4",
			5: "gap-5",
			6: "gap-6",
			8: "gap-8",
			10: "gap-10",
			12: "gap-12",
			16: "gap-16",
		},
	},
	defaultVariants: {
		cols: 1,
		gap: 4,
	},
});

interface GridProps extends React.ComponentProps<"div">, VariantProps<typeof gridVariants> {}

export function Grid({ className, cols, gap, ...props }: GridProps) {
	return <div className={cn(gridVariants({ cols, gap }), className)} {...props} />;
}

const containerVariants = cva("mx-auto w-full", {
	variants: {
		size: {
			sm: "max-w-screen-sm",
			md: "max-w-screen-md",
			lg: "max-w-screen-lg",
			xl: "max-w-screen-xl",
			"2xl": "max-w-screen-2xl",
			full: "max-w-full",
			prose: "max-w-prose",
		},
		padding: {
			0: "px-0",
			4: "px-4",
			6: "px-6",
			8: "px-8",
			12: "px-12",
			16: "px-16",
		},
	},
	defaultVariants: {
		size: "xl",
		padding: 8,
	},
});

interface ContainerProps
	extends React.ComponentProps<"div">,
		VariantProps<typeof containerVariants> {}

export function Container({ className, size, padding, ...props }: ContainerProps) {
	return <div className={cn(containerVariants({ size, padding }), className)} {...props} />;
}

const boxVariants = cva("", {
	variants: {
		p: {
			0: "p-0",
			1: "p-1",
			2: "p-2",
			3: "p-3",
			4: "p-4",
			5: "p-5",
			6: "p-6",
			8: "p-8",
			10: "p-10",
			12: "p-12",
			16: "p-16",
		},
		px: {
			0: "px-0",
			1: "px-1",
			2: "px-2",
			3: "px-3",
			4: "px-4",
			5: "px-5",
			6: "px-6",
			8: "px-8",
			10: "px-10",
			12: "px-12",
			16: "px-16",
		},
		py: {
			0: "py-0",
			1: "py-1",
			2: "py-2",
			3: "py-3",
			4: "py-4",
			5: "py-5",
			6: "py-6",
			8: "py-8",
			10: "py-10",
			12: "py-12",
			16: "py-16",
		},
		m: {
			0: "m-0",
			1: "m-1",
			2: "m-2",
			3: "m-3",
			4: "m-4",
			5: "m-5",
			6: "m-6",
			8: "m-8",
			10: "m-10",
			12: "m-12",
			16: "m-16",
		},
		mx: {
			0: "mx-0",
			1: "mx-1",
			2: "mx-2",
			3: "mx-3",
			4: "mx-4",
			5: "mx-5",
			6: "mx-6",
			8: "mx-8",
			10: "mx-10",
			12: "mx-12",
			16: "mx-16",
			auto: "mx-auto",
		},
		my: {
			0: "my-0",
			1: "my-1",
			2: "my-2",
			3: "my-3",
			4: "my-4",
			5: "my-5",
			6: "my-6",
			8: "my-8",
			10: "my-10",
			12: "my-12",
			16: "my-16",
		},
	},
});

interface BoxProps extends React.ComponentProps<"div">, VariantProps<typeof boxVariants> {}

export function Box({ className, p, px, py, m, mx, my, ...props }: BoxProps) {
	return <div className={cn(boxVariants({ p, px, py, m, mx, my }), className)} {...props} />;
}

interface DividerProps extends React.ComponentProps<"div"> {
	orientation?: "horizontal" | "vertical";
}

export function Divider({ className, orientation = "horizontal", ...props }: DividerProps) {
	return (
		<div
			className={cn(
				"bg-border",
				orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
				className
			)}
			{...props}
		/>
	);
}

export const Text = {
	H1: ({ className, ...props }: React.ComponentProps<"h1">) => (
		<h1 className={cn("text-4xl font-bold tracking-tight lg:text-5xl", className)} {...props} />
	),
	H2: ({ className, ...props }: React.ComponentProps<"h2">) => (
		<h2 className={cn("text-3xl font-semibold tracking-tight", className)} {...props} />
	),
	H3: ({ className, ...props }: React.ComponentProps<"h3">) => (
		<h3 className={cn("text-2xl font-semibold tracking-tight", className)} {...props} />
	),
	H4: ({ className, ...props }: React.ComponentProps<"h4">) => (
		<h4 className={cn("text-xl font-semibold tracking-tight", className)} {...props} />
	),
	H5: ({ className, ...props }: React.ComponentProps<"h5">) => (
		<h5 className={cn("text-lg font-semibold tracking-tight", className)} {...props} />
	),
	H6: ({ className, ...props }: React.ComponentProps<"h6">) => (
		<h6 className={cn("text-base font-semibold tracking-tight", className)} {...props} />
	),
	Lead: ({ className, ...props }: React.ComponentProps<"p">) => (
		<p className={cn("text-xl text-muted-foreground", className)} {...props} />
	),
	Large: ({ className, ...props }: React.ComponentProps<"p">) => (
		<p className={cn("text-lg", className)} {...props} />
	),
	Base: ({ className, ...props }: React.ComponentProps<"p">) => (
		<p className={cn("text-base", className)} {...props} />
	),
	Small: ({ className, ...props }: React.ComponentProps<"p">) => (
		<p className={cn("text-sm", className)} {...props} />
	),
	Muted: ({ className, ...props }: React.ComponentProps<"p">) => (
		<p className={cn("text-sm text-muted-foreground", className)} {...props} />
	),
	Code: ({ className, ...props }: React.ComponentProps<"code">) => (
		<code
			className={cn(
				"relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm",
				className
			)}
			{...props}
		/>
	),
};
