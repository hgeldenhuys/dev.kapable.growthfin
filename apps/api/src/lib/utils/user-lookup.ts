/**
 * User Lookup Utilities
 * Shared helper for resolving user display names by ID.
 */

import { db } from '@agios/db';
import { users } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Look up user's display name by ID.
 * Returns the user's name, email, or a fallback string.
 *
 * @param userId - The user's UUID, or null/undefined
 * @returns The user's display name, or 'System' if no userId, or 'User' on lookup failure
 */
export async function getUserName(userId: string | null | undefined): Promise<string> {
  if (!userId) return 'System';
  try {
    const [user] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user?.name || user?.email || 'User';
  } catch {
    return 'User';
  }
}
