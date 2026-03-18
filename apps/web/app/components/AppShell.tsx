import { Search, Command, Bell, ChevronRight, ChevronDown } from "lucide-react";
import React, { type ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { UserMenu } from "./UserMenu";
import { ShellSwitcher } from "./ShellSwitcher";
import { SandboxModeToggle } from "./SandboxModeToggle";
import { Button } from "./ui/button";
import { GlobalSearchDialog } from "./search/GlobalSearchDialog";
import { useOptionalWorkspaceContext } from "../contexts/WorkspaceContext";
import { OnboardingChecklist } from "./crm/OnboardingChecklist";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
} from "./ui/sidebar";
import type { Theme } from "../lib/theme";
import { cn } from "../lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { Toaster } from "./ui/sonner";
// Note: framer-motion page transitions removed — SSR hydration breaks the animation,

export interface NavItem {
	to?: string;
	label: string;
	icon?: ReactNode;
	type?: "divider";
	dataTour?: string;
}

export interface AppShellProps {
	theme: Theme;
	brandName: string;
	brandId?: string;
	pageTitle?: string;
	leftNav: NavItem[];
	children: ReactNode;
	showSearch?: boolean;
	rightActions?: ReactNode;
	centerContent?: boolean;
	contentMaxWidth?: number | string;
	sidebarHeader?: ReactNode;
	workspaceSelector?: ReactNode;
	user: {
		id: string;
		email?: string;
		name?: string;
		role?: string;
		image?: string | null;
	} | null;
	isAdmin?: boolean;
}

function AppShellContent(props: AppShellProps) {
	const {
		theme,
		brandName,
		brandId,
		pageTitle = "Overview",
		leftNav,
		children,
		showSearch = true,
		rightActions,
		centerContent = false,
		contentMaxWidth = 1200,
		workspaceSelector,
		user,
		isAdmin,
	} = props;

	const [searchOpen, setSearchOpen] = useState(false);
	const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
	const location = useLocation();
	const workspaceCtx = useOptionalWorkspaceContext();
	const accentColor = workspaceCtx?.currentWorkspace?.settings?.accentColor;

	const navGroups = React.useMemo(() => {
		const groups: Array<{ label: string; items: NavItem[] }> = [];
		let currentGroup = { label: "", items: [] as NavItem[] };

		for (const item of leftNav || []) {
			if (item.type === "divider") {
				if (currentGroup.items.length > 0) {
					groups.push(currentGroup);
				}
				currentGroup = { label: item.label, items: [] };
			} else {
				currentGroup.items.push(item);
			}
		}

		if (currentGroup.items.length > 0) {
			groups.push(currentGroup);
		}

		return groups;
	}, [leftNav]);

	// Collapsible group state - persisted in localStorage
	const collapsibleGroups = ['Engage', 'Analyze'];
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
		if (typeof window === 'undefined') return new Set();
		try {
			const stored = localStorage.getItem('sidebar-collapsed-groups');
			return stored ? new Set(JSON.parse(stored)) : new Set();
		} catch {
			return new Set();
		}
	});

	const toggleGroup = (label: string) => {
		setCollapsedGroups(prev => {
			const next = new Set(prev);
			if (next.has(label)) {
				next.delete(label);
			} else {
				next.add(label);
			}
			try {
				localStorage.setItem('sidebar-collapsed-groups', JSON.stringify([...next]));
			} catch {}
			return next;
		});
	};

	useEffect(() => {
		if (isMobile && openMobile) {
			setOpenMobile?.(false);
		}
	}, [location, isMobile, openMobile, setOpenMobile]);

	return (
		<div className="flex min-h-screen w-full font-sans selection:bg-zinc-800 selection:text-white bg-background">
			<Sidebar collapsible="icon" className="border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
				{accentColor && (
					<div className="h-[3px] w-full shrink-0" style={{ backgroundColor: accentColor }} />
				)}
				<SidebarHeader className="h-16 border-b border-border/50 px-4 bg-sidebar/50 group-data-[collapsible=icon]:px-1">
					<div className="flex h-full items-center gap-3">
						{workspaceSelector ? (
							<div className="flex-1 min-w-0">{workspaceSelector}</div>
						) : (
							<div className="flex items-center gap-3 px-1">
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-foreground text-background shadow-lg">
									<div className="h-4 w-4 bg-background rounded-sm" />
								</div>
								<div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
									<span className="text-sm font-bold tracking-tight text-foreground truncate">{brandName}</span>
									<span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">SaaS Platform</span>
								</div>
							</div>
						)}
					</div>
				</SidebarHeader>

				<SidebarContent className="px-2 py-4 bg-sidebar/50 group-data-[collapsible=icon]:px-0">
					{navGroups.map((group, groupIndex) => {
						const isCollapsible = collapsibleGroups.includes(group.label);
						const isCollapsed = collapsedGroups.has(group.label);

						return (
							<SidebarGroup key={groupIndex} className="mb-4 group-data-[collapsible=icon]:px-0">
								{group.label && (
									isCollapsible ? (
										<button
											onClick={() => toggleGroup(group.label)}
											className="flex w-full items-center justify-between mb-2 px-3 group/label group-data-[collapsible=icon]:hidden"
										>
											<span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
												{group.label}
											</span>
											<ChevronDown className={cn(
												"h-3 w-3 text-muted-foreground/40 transition-transform duration-200",
												isCollapsed && "-rotate-90"
											)} />
										</button>
									) : (
										<SidebarGroupLabel className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
											{group.label}
										</SidebarGroupLabel>
									)
								)}
								<SidebarGroupContent className={cn(
									"transition-all duration-200 overflow-hidden",
									isCollapsible && isCollapsed && "max-h-0 opacity-0"
								)}>
									<SidebarMenu>
										{group.items.map((item) => {
											const isActive = location.pathname === item.to;
											return (
												<SidebarMenuItem key={item.to || item.label} {...(item.dataTour ? { "data-tour": item.dataTour } : {})}>
													<SidebarMenuButton
														asChild
														tooltip={state === "collapsed" ? item.label : undefined}
														isActive={isActive}
														className={cn(
															"h-10 px-3 rounded-lg transition-all duration-200",
															isActive
																? "bg-muted text-foreground font-medium border border-border/50"
																: "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
														)}
													>
														<NavLink to={item.to || "#"} end className="flex items-center gap-3">
															<div className={cn(
																"flex h-4 w-4 shrink-0 items-center justify-center transition-colors",
																isActive ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground"
															)}>
																{item.icon}
															</div>
															<span className={cn(
																"text-sm tracking-tight transition-opacity duration-200",
																state === "collapsed" && "hidden"
															)}>
																{item.label}
															</span>
														</NavLink>
													</SidebarMenuButton>
												</SidebarMenuItem>
											);
										})}
									</SidebarMenu>
								</SidebarGroupContent>
							</SidebarGroup>
						);
					})}
				</SidebarContent>

				{workspaceCtx?.currentWorkspace?.id && (
					<div className="group-data-[collapsible=icon]:hidden">
						<OnboardingChecklist workspaceId={workspaceCtx.currentWorkspace.id} />
					</div>
				)}

				<SidebarRail className="hover:after:bg-border/50" />
			</Sidebar>

			<div className="flex min-w-0 flex-1 flex-col bg-background">
				<header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/50 bg-background/50 px-4 backdrop-blur-md md:px-6">
					<SidebarTrigger className="hover:bg-muted text-muted-foreground hover:text-foreground" />

					<div className="h-6 w-px bg-border/50 mx-1 md:block hidden" />

					<div className="flex flex-col md:flex-row md:items-center gap-0 md:gap-2">
						<span className="text-sm font-bold tracking-tight text-foreground">{pageTitle}</span>
						<div className="flex items-center gap-2">
							<ChevronRight className="h-3 w-3 text-muted-foreground/30 md:block hidden" />
							<span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">{brandName}</span>
						</div>
					</div>

					<div className="ml-auto flex items-center gap-2 md:gap-4">
						{showSearch && (
							<>
								<button
									onClick={() => setSearchOpen(true)}
									className="relative group hidden sm:flex items-center h-9 w-[180px] lg:w-[280px] bg-muted/30 border border-border/50 rounded-full px-3 text-xs text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-all duration-200"
								>
									<Search className="h-3.5 w-3.5 mr-2 shrink-0" />
									<span>Search anything...</span>
									<div className="ml-auto hidden lg:flex items-center gap-0.5">
										<kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50 shadow-sm">
											<Command className="h-2 w-2 inline mr-0.5" /> K
										</kbd>
									</div>
								</button>
								{brandId && (
									<GlobalSearchDialog
										workspaceId={brandId}
										open={searchOpen}
										onOpenChange={setSearchOpen}
									/>
								)}
							</>
						)}

						<div className="flex items-center gap-1 md:gap-2">
							<Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted relative">
								<Bell className="h-4 w-4" />
								<span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-primary border-2 border-background" />
							</Button>

							<div className="h-4 w-px bg-border/50 mx-1" />

							<SandboxModeToggle />
							<ShellSwitcher />
							{rightActions}
							<ThemeToggle currentTheme={theme} />
							{user && <UserMenu user={user} isAdmin={isAdmin} />}
						</div>
					</div>
				</header>

				<main className="relative flex flex-1 flex-col overflow-hidden bg-background">
					<div className="flex-1 overflow-y-auto">
						<div className="min-h-full bg-background p-4 md:p-8">
							<div
								className={cn(
									"mx-auto w-full",
									centerContent && "max-w-7xl"
								)}
								style={centerContent && contentMaxWidth ? {
									maxWidth: typeof contentMaxWidth === "number"
										? `${contentMaxWidth}px`
										: contentMaxWidth,
								} : {}}
							>
								{children}
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}

export function AppShell(props: AppShellProps) {
	return (
		<SidebarProvider>
			<AppShellContent {...props} />
			<Toaster position="top-right" closeButton richColors expand={false} />
		</SidebarProvider>
	);
}
