import { useState } from "react";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/auth.forgot-password";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Mail, ArrowRight, ChevronLeft, CheckCircle2 } from "lucide-react";
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

export default function ForgotPassword() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			const response = await fetch(`${API_URL}/auth/forgot-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});

			if (!response.ok) {
				const data = await response.json();
				setError(data.error || "Something went wrong. Please try again.");
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
					<h1 className="text-3xl font-bold text-white tracking-tight">Reset your password</h1>
					<p className="text-zinc-500 mt-2">Enter your email and we'll send you a reset link.</p>
				</div>

				<Card className="bg-zinc-950 border-zinc-900 shadow-2xl overflow-hidden">
					<CardContent className="pt-6">
						{success ? (
							<div className="text-center py-4">
								<CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
								<h2 className="text-lg font-semibold text-white mb-2">Check your email</h2>
								<p className="text-zinc-400 text-sm">
									If an account exists with that email, we've sent a password reset link. Check your inbox and spam folder.
								</p>
								<Link
									to="/auth/sign-in"
									className="inline-flex items-center gap-2 text-white text-sm font-medium mt-6 hover:underline underline-offset-4"
								>
									Back to sign in
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
									<Label htmlFor="email" className="text-zinc-400">Email Address</Label>
									<div className="relative">
										<Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
										<Input
											id="email"
											type="email"
											placeholder="you@example.com"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											required
											className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-zinc-700 focus:bg-zinc-900 focus:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_#18181b] transition-all"
											autoComplete="email"
											autoFocus
										/>
									</div>
								</div>

								<Button
									type="submit"
									className="w-full bg-white text-black hover:bg-zinc-200 h-11 font-medium transition-all group"
									disabled={isLoading}
								>
									{isLoading ? "Sending..." : (
										<span className="flex items-center gap-2">
											Send reset link <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
										</span>
									)}
								</Button>
							</form>
						)}
					</CardContent>
				</Card>

				<div className="mt-8 text-center text-sm">
					<span className="text-zinc-500">Remember your password? </span>
					<Link to="/auth/sign-in" className="text-white font-medium hover:underline underline-offset-4">
						Sign in
					</Link>
				</div>
			</div>
		</div>
	);
}
