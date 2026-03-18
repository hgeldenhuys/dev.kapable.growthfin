import { useState } from "react";
import { Link, useNavigate, redirect } from "react-router";
import type { Route } from "./+types/auth.sign-up";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Mail, Lock, User, ArrowRight, ChevronLeft } from "lucide-react";
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

	// If already logged in, redirect to dashboard
	if (session) {
		return redirect("/dashboard");
	}

	return null;
}

export default function SignUp() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

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
			const response = await fetch(`${API_URL}/auth/sign-up/email`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password, name: name || undefined }),
				credentials: "include",
			});

			if (!response.ok) {
				const data = await response.json();
				setError(data.error || "Sign up failed");
				setIsLoading(false);
				return;
			}

			navigate("/dashboard");
		} catch (err) {
			setError("Network error. Please try again.");
			setIsLoading(false);
		}
	};

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
					<h1 className="text-3xl font-bold text-white tracking-tight">Create an account</h1>
					<p className="text-zinc-500 mt-2">Get started with your account.</p>
				</div>

				<Card className="bg-zinc-950 border-zinc-900 shadow-2xl overflow-hidden">
					<CardContent className="pt-6">
						<form onSubmit={handleSubmit} className="space-y-4">
							{error && (
								<div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
									{error}
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="name" className="text-zinc-400">Full Name</Label>
								<div className="relative">
									<User className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
									<input
										id="name"
										type="text"
										placeholder="John Doe"
										value={name}
										onChange={(e) => setName(e.target.value)}
										className="flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 pl-10 transition-all"
										autoComplete="name"
										autoFocus
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="email" className="text-zinc-400">Email Address</Label>
								<div className="relative">
									<Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
									<input
										id="email"
										type="email"
										placeholder="you@example.com"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
										className="flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 pl-10 transition-all"
										autoComplete="email"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="password" className="text-zinc-400">Password</Label>
									<div className="relative">
										<Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
										<input
											id="password"
											type="password"
											placeholder="••••••••"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											required
											className="flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 pl-10 transition-all"
											autoComplete="new-password"
											minLength={8}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="confirmPassword" className="text-zinc-400">Confirm</Label>
									<div className="relative">
										<Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
										<input
											id="confirmPassword"
											type="password"
											placeholder="••••••••"
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											required
											className="flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 pl-10 transition-all"
											autoComplete="new-password"
											minLength={8}
										/>
									</div>
								</div>
							</div>
							<p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Must be at least 8 characters</p>

							<Button
								type="submit"
								className="w-full bg-white text-black hover:bg-zinc-200 h-11 font-medium transition-all group mt-2"
								disabled={isLoading}
							>
								{isLoading ? "Creating account..." : (
									<span className="flex items-center gap-2">
										Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
									</span>
								)}
							</Button>
						</form>
					</CardContent>
				</Card>

				<div className="mt-8 text-center text-sm">
					<span className="text-zinc-500">Already have an account? </span>
					<Link to="/auth/sign-in" className="text-white font-medium hover:underline underline-offset-4">
						Sign in
					</Link>
				</div>
			</div>
		</div>
	);
}
