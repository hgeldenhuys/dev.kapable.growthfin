import { Link, redirect, Form, useActionData, useNavigation, useLoaderData, type ActionFunction } from "react-router";
import type { Route } from "./+types/auth.sign-in";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Mail, Lock, ArrowRight, ChevronLeft } from "lucide-react";
import { getSession } from "~/lib/auth";
import { db, users, sessions, eq } from "~/lib/db.server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const API_URL = (typeof process !== 'undefined' && process.env?.['API_URL']) || 'http://localhost:3000';

/**
 * Loader: Redirect to dashboard if already authenticated
 */
export async function loader({ request }: Route.LoaderArgs) {
	const session = await getSession(request);

	// If already logged in, redirect to dashboard
	if (session) {
		return redirect("/dashboard");
	}

	const showTestCredentials = API_URL.includes('localhost');
	return { showTestCredentials };
}

export const action: ActionFunction = async ({ request }) => {
	const formData = await request.formData();
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	try {
		// Find user by email
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		if (!user || !user.password) {
			return { error: "Invalid email or password" };
		}

		// Verify password
		const isValid = await bcrypt.compare(password, user.password);
		if (!isValid) {
			return { error: "Invalid email or password" };
		}

		// Create session
		const token = crypto.randomBytes(32).toString("hex");
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

		await db.insert(sessions).values({
			userId: user.id,
			token,
			expiresAt,
		});

		// Set session cookie and redirect
		const url = new URL(request.url);
		const redirectTo = url.searchParams.get("redirect") || "/dashboard";

		return redirect(redirectTo, {
			headers: {
				"Set-Cookie": `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
			},
		});
	} catch (error) {
		console.error("[auth] Sign-in error:", error);
		return { error: "An error occurred. Please try again." };
	}
};

export default function SignIn() {
	const navigation = useNavigation();
	const actionData = useActionData<typeof action>() as { error?: string } | undefined;
	const loaderData = useLoaderData<typeof loader>() as { showTestCredentials?: boolean } | null;

	const isLoading = navigation.state === "submitting";
	const error = actionData?.error;

	return (
		<div className="dark flex min-h-screen items-center justify-center bg-black font-sans selection:bg-zinc-800 selection:text-white p-4">
			{/* Background glow */}
			<div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-zinc-800/10 to-transparent pointer-events-none" />
			
			<div className="w-full max-w-md relative z-10">
				<Link to="/landing" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 group">
					<ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
					<span className="text-sm font-medium">Back to website</span>
				</Link>

				<div className="mb-8">
					<div className="w-10 h-10 bg-white rounded flex items-center justify-center mb-6 shadow-xl shadow-white/5">
						<div className="w-5 h-5 bg-black rounded-sm" />
					</div>
					<h1 className="text-3xl font-bold text-white tracking-tight">Welcome back</h1>
					<p className="text-zinc-500 mt-2">Enter your credentials to access your account.</p>
				</div>

				<Card className="bg-zinc-950 border-zinc-900 shadow-2xl overflow-hidden">
					<CardContent className="pt-6">
						<Form method="post" className="space-y-4">
							{error && (
								<div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
									{error}
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="email" className="text-zinc-400">Email Address</Label>
								<div className="relative">
									<Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
									<Input
										id="email"
										name="email"
										type="email"
										placeholder="you@example.com"
										required
										className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-zinc-700 focus:bg-zinc-900 focus:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_#18181b] transition-all"
										autoComplete="email"
										autoFocus
									/>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="password" className="text-zinc-400">Password</Label>
									<Link to="/auth/forgot-password" className="text-xs text-zinc-500 hover:text-white transition-colors">Forgot password?</Link>
								</div>
								<div className="relative">
									<Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
									<Input
										id="password"
										name="password"
										type="password"
										placeholder="••••••••"
										required
										className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-zinc-700 focus:bg-zinc-900 focus:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_#18181b] transition-all"
										autoComplete="current-password"
									/>
								</div>
							</div>

							<Button
								type="submit"
								className="w-full bg-white text-black hover:bg-zinc-200 h-11 font-medium transition-all group"
								disabled={isLoading}
							>
								{isLoading ? "Signing in..." : (
									<span className="flex items-center gap-2">
										Sign in <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
									</span>
								)}
							</Button>
						</Form>

						{/* Development Test Credentials - only shown on localhost */}
						{loaderData?.showTestCredentials && (
							<div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-900 rounded-lg">
								<div className="text-[10px] uppercase tracking-widest font-bold text-zinc-600 mb-3">
									Test Environment Credentials
								</div>
								<div className="space-y-2 text-xs font-mono">
									<div className="flex justify-between items-center">
										<span className="text-zinc-500">Email</span>
										<span className="text-zinc-300">test@newleads.co.za</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-zinc-500">Password</span>
										<span className="text-zinc-300">testpassword123</span>
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				<div className="mt-8 text-center text-sm">
					<span className="text-zinc-500">Don't have an account? </span>
					<Link to="/auth/sign-up" className="text-white font-medium hover:underline underline-offset-4">
						Create one for free
					</Link>
				</div>
			</div>
		</div>
	);
}
