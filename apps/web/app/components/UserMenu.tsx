/**
 * User Menu Component
 * Dropdown menu with user options and navigation
 */
import { useState } from "react";
import { Link } from "react-router";
import { CreateWorkspaceModal } from "~/components/workspace/CreateWorkspaceModal";
import { InviteUsersModal } from "~/components/workspace/InviteUsersModal";
import { useWorkspaceContext } from "~/contexts/WorkspaceContext";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { 
	User, 
	Settings, 
	Plus, 
	UserPlus, 
	LogOut, 
	Layout, 
	ShieldCheck,
	ChevronDown
} from "lucide-react";

interface UserMenuProps {
	user: {
		id: string;
		email?: string;
		name?: string;
		role?: string;
		image?: string | null;
	};
	isAdmin?: boolean;
}

export function UserMenu({ user, isAdmin }: UserMenuProps) {
	const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
	const [inviteUsersOpen, setInviteUsersOpen] = useState(false);

	// Try to get workspace context (may not be available on all pages)
	let currentWorkspace = null;
	let refetchWorkspaces = null;
	try {
		const context = useWorkspaceContext();
		currentWorkspace = context.currentWorkspace;
		refetchWorkspaces = context.refetchWorkspaces;
	} catch {
		// Not in workspace context, that's okay
	}

	const handleSignOut = async () => {
		try {
			await fetch(`/auth/sign-out`, {
				method: "POST",
				credentials: "include"
			});
			window.location.href = "/auth/sign-in";
		} catch (error) {
			console.error("Sign out error:", error);
			window.location.href = "/auth/sign-in";
		}
	};

	const getInitials = () => {
		if (user?.name) {
			return user.name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2);
		}
		return user?.email?.[0]?.toUpperCase() || "U";
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className="relative h-10 w-auto gap-2 px-2 hover:bg-muted/50 rounded-full group border border-border/50 bg-background/50">
						<Avatar className="h-8 w-8 border border-border/50 shadow-sm transition-transform group-hover:scale-105">
							{user?.image && <AvatarImage src={user.image} alt={user?.name || ""} />}
							<AvatarFallback className="bg-foreground text-background text-xs font-bold">
								{getInitials()}
							</AvatarFallback>
						</Avatar>
						<div className="flex flex-col items-start text-left hidden md:flex">
							<span className="text-xs font-bold leading-none tracking-tight text-foreground">{user?.name || user?.email?.split("@")[0]}</span>
							<span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter mt-1">
								{user?.role || "Member"}
							</span>
						</div>
						<ChevronDown className="h-3 w-3 text-muted-foreground/30 transition-transform group-data-[state=open]:rotate-180" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-64 bg-background border-border/50 text-foreground" align="end" sideOffset={8}>
					<DropdownMenuLabel className="font-normal">
						<div className="flex flex-col space-y-1">
							<p className="text-sm font-bold leading-none">{user?.name || "User"}</p>
							<p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
						</div>
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="bg-border/50" />
					<DropdownMenuGroup>
						<DropdownMenuItem asChild className="cursor-pointer gap-2 py-2.5 focus:bg-muted focus:text-foreground">
							<Link to="/profile" className="flex w-full items-center">
								<User className="h-4 w-4 text-muted-foreground" />
								<span>Profile</span>
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild className="cursor-pointer gap-2 py-2.5 focus:bg-muted focus:text-foreground">
							<Link to="/settings" className="flex w-full items-center">
								<Settings className="h-4 w-4 text-muted-foreground" />
								<span>Settings</span>
							</Link>
						</DropdownMenuItem>
						{isAdmin && (
							<DropdownMenuItem asChild className="cursor-pointer gap-2 py-2.5 text-foreground focus:bg-muted focus:text-foreground">
								<Link to="/admin" className="flex w-full items-center">
									<ShieldCheck className="h-4 w-4" />
									<span>Admin Panel</span>
								</Link>
							</DropdownMenuItem>
						)}
					</DropdownMenuGroup>
					<DropdownMenuSeparator className="bg-border/50" />
					<DropdownMenuGroup>
						<DropdownMenuItem asChild className="cursor-pointer gap-2 py-2.5 focus:bg-muted focus:text-foreground">
							<Link to="/dashboard" className="flex w-full items-center">
								<Layout className="h-4 w-4 text-muted-foreground" />
								<span>My Workspaces</span>
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem 
							onClick={() => setCreateWorkspaceOpen(true)}
							className="cursor-pointer gap-2 py-2.5 focus:bg-muted focus:text-foreground"
						>
							<Plus className="h-4 w-4 text-muted-foreground" />
							<span>Create Workspace</span>
						</DropdownMenuItem>
						{currentWorkspace && (
							<DropdownMenuItem 
								onClick={() => setInviteUsersOpen(true)}
								className="cursor-pointer gap-2 py-2.5 focus:bg-muted focus:text-foreground"
							>
								<UserPlus className="h-4 w-4 text-muted-foreground" />
								<span>Invite Users</span>
							</DropdownMenuItem>
						)}
					</DropdownMenuGroup>
					<DropdownMenuSeparator className="bg-border/50" />
					<DropdownMenuItem 
						onClick={handleSignOut}
						className="cursor-pointer gap-2 py-2.5 text-rose-500 focus:text-rose-400 focus:bg-rose-500/10"
					>
						<LogOut className="h-4 w-4" />
						<span>Sign out</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<CreateWorkspaceModal
				open={createWorkspaceOpen}
				onOpenChange={setCreateWorkspaceOpen}
				userId={user.id}
				onWorkspaceCreated={() => refetchWorkspaces?.()}
			/>

			{currentWorkspace && (
				<InviteUsersModal
					open={inviteUsersOpen}
					onOpenChange={setInviteUsersOpen}
					workspaceId={currentWorkspace.id}
					workspaceName={currentWorkspace.name}
					currentUserId={user.id}
					onInviteComplete={() => refetchWorkspaces?.()}
				/>
			)}
		</>
	);
}
