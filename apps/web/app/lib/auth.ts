/**
 * Auth Utility — Direct DB queries (server-side only)
 *
 * All auth functions query the database directly via Drizzle ORM.
 * No dependency on external API endpoints.
 */

import { db, users, sessions, eq } from '~/lib/db.server';

export interface User {
	id: string;
	email: string;
	name: string | null;
	createdAt: string;
}

export interface Session {
	user: User;
	session: {
		id: string;
		userId: string;
		expiresAt: string;
	};
}

/**
 * Extract session token from request cookie header
 */
function extractSessionToken(request?: Request): string | null {
	if (!request) return null;
	const cookieHeader = request.headers.get("cookie");
	if (!cookieHeader) return null;

	const cookies = cookieHeader.split(";");
	for (let i = 0; i < cookies.length; i++) {
		const part = cookies[i];
		if (!part) continue;
		const cookie = part.trim();
		if (cookie.startsWith("session=")) {
			return cookie.substring("session=".length);
		}
	}
	return null;
}

/**
 * Get current session by validating the session cookie against the database.
 * Returns null if not authenticated or session expired.
 *
 * @param request - Request object to extract session cookie from (server-side)
 */
export async function getSession(request?: Request): Promise<Session | null> {
	try {
		const token = extractSessionToken(request);
		if (!token) return null;

		const [session] = await db
			.select()
			.from(sessions)
			.where(eq(sessions.token, token))
			.limit(1);

		if (!session) return null;

		// Check if expired
		if (new Date() > new Date(session.expiresAt)) return null;

		// Get user
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, session.userId))
			.limit(1);

		if (!user) return null;

		return {
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				createdAt: user.createdAt?.toISOString?.() ?? new Date().toISOString(),
			},
			session: {
				id: session.id,
				userId: session.userId,
				expiresAt: session.expiresAt.toISOString(),
			},
		};
	} catch (error) {
		console.error("Failed to get session:", error);
		return null;
	}
}
