import { useState } from "react";
import { Link, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/auth.reset-password";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Lock, ArrowRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { getSession } from "~/lib/auth";

// Server-side: direct to API. Client-side: use BFF proxy at /api/auth/*
const API_URL = typeof window === 'undefined'
	? ((typeof process !== 'undefined' && process.env?.['API_URL']) || 'http://localhost:3000')
	: '/api';

/**
 * Loader: Redirect to dashboard if already authenticated
 */
export async function loader({ request }: Route.LoaderArgs) {
	const session = await getSession(request);
	if (session) {
		return redirect("/dashboard");
	}
	return null;
}

export default function ResetPassword() {
	const [searchParams] = useSearchParams();
	const token = searchParams.get("token") || "";

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	if (!token) {
		return (
			<div className="dark flex min-h-screen items-center justify-center bg-black font-sans selection:bg-zinc-800 selection:text-white p-4">
				<div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-zinc-800/10 to-transparent pointer-events-none" />
				<div className="w-full max-w-md relative z-10">
					<div className="mb-8">
						<div className="w-10 h-10 bg-white rounded flex items-center justify-center mb-6 shadow-xl shadow-white/5">
							<div className="w-5 h-5 bg-black rounded-sm" />
						</div>
						<h1 className="text-3xl font-bold text-white tracking-tight">Invalid reset link</h1>
						<p className="text-zinc-500 mt-2">This password reset link is invalid or has expired.</p>
					</div>
					<Card className="bg-zinc-950 border-zinc-900 shadow-2xl overflow-hidden">
						<CardContent className="pt-6 pb-6">
							<Link to="/auth/forgot-password">
								<Button className="w-full bg-white text-black hover:bg-zinc-200 h-11 font-medium transition-all">
									Request a new reset link
								</Button>
							</Link>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}

		setIsLoading(true);

		try {
			const response = await fetch(`${API_URL}/auth/reset-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || "Password reset failed. The link may have expired.");
				setIsLoading(false);
				return;
			}

			setSuccess(true);
		} catch {
			setError("Network error. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="dark flex min-h-screen items-center justify-center bg-black font-sans selection:bg-zinc-800 selection:text-white p-4">
			{/* Background glow */}
			<div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-zinc-800/10 to-transparent pointer-events-none" />

			<div className="w-full max-w-md relative z-10">
				<Link to="/auth/sign-in" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 group">
					<ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
					<span className="text-sm font-medium">Back to sign in</span>
				</Link>

				<div className="mb-8">
					<div className="w-10 h-10 bg-white rounded flex items-center justify-center mb-6 shadow-xl shadow-white/5">
						<div className="w-5 h-5 bg-black rounded-sm" />
					</div>
					<h1 className="text-3xl font-bold text-white tracking-tight">Set new password</h1>
					<p className="text-zinc-500 mt-2">Enter your new password below.</p>
				</div>

				<Card className="bg-zinc-950 border-zinc-900 shadow-2xl overflow-hidden">
					<CardContent className="pt-6">
						{success ? (
							<div className="text-center py-4">
								<CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
								<h2 className="text-lg font-semibold text-white mb-2">Password reset complete</h2>
								<p className="text-zinc-400 text-sm">
									Your password has been updated. You can now sign in with your new password.
								</p>
								<Link
									to="/auth/sign-in"
									className="inline-flex items-center gap-2 text-black bg-white hover:bg-zinc-200 text-sm font-medium mt-6 px-6 py-2.5 rounded-md transition-all"
								>
									Sign in <ArrowRight className="w-4 h-4" />
								</Link>
							</div>
						) : (
							<form onSubmit={handleSubmit} className="space-y-4">
								{error && (
									<div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
										{error}
									</div>
								)}

								<div className="space-y-2">
									<Label htmlFor="password" className="text-zinc-400">New Password</Label>
									<div className="relative">
										<Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
										<Input
											id="password"
											type="password"
											placeholder="••••••••"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											required
											minLength={8}
											className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-zinc-700 focus:bg-zinc-900 focus:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_#18181b] transition-all"
											autoComplete="new-password"
											autoFocus
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="confirmPassword" className="text-zinc-400">Confirm Password</Label>
									<div className="relative">
										<Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
										<Input
											id="confirmPassword"
											type="password"
											placeholder="••••••••"
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											required
											minLength={8}
											className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-zinc-700 focus:bg-zinc-900 focus:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_#18181b] transition-all"
											autoComplete="new-password"
										/>
									</div>
								</div>
								<p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Must be at least 8 characters</p>

								<Button
									type="submit"
									className="w-full bg-white text-black hover:bg-zinc-200 h-11 font-medium transition-all group"
									disabled={isLoading}
								>
									{isLoading ? "Resetting..." : (
										<span className="flex items-center gap-2">
											Reset password <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
										</span>
									)}
								</Button>
							</form>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
