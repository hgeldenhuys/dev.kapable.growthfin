/**
 * User Service
 * Business logic for user profile operations
 */

import type { Database } from '@agios/db';
import { users, workspaceMembers } from '@agios/db';
import { eq, ilike, or, and, sql } from 'drizzle-orm';

export const userService = {
  /**
   * Get user by ID
   */
  async getUserById(db: Database, userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user || null;
  },

  /**
   * Update user profile
   */
  async updateUser(
    db: Database,
    userId: string,
    updates: { name?: string; email?: string }
  ) {
    // Check if email is being updated and if it's already taken
    if (updates.email) {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, updates.email))
        .limit(1);

      if (existingUser && existingUser.id !== userId) {
        throw new Error('Email already in use');
      }
    }

    // Perform update
    const [updatedUser] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return updatedUser;
  },

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Search users by email or name
   * Optionally exclude users already in a workspace
   */
  async searchUsers(
    db: Database,
    searchQuery: string,
    excludeWorkspaceId?: string,
    limit: number = 10
  ) {
    // Build base query with case-insensitive search on email or name
    const searchPattern = `%${searchQuery}%`;

    const results = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
      })
      .from(users)
      .where(
        or(
          ilike(users.email, searchPattern),
          ilike(users.name, searchPattern)
        )
      )
      .limit(limit);

    // If excludeWorkspaceId is provided, check membership for each user
    if (excludeWorkspaceId && results.length > 0) {
      // Get all members of the workspace
      const members = await db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, excludeWorkspaceId));

      const memberUserIds = new Set(members.map((m) => m.userId));

      return results.map((user) => ({
        ...user,
        alreadyMember: memberUserIds.has(user.id),
      }));
    }

    // No workspace exclusion, all users are not members
    return results.map((user) => ({
      ...user,
      alreadyMember: false,
    }));
  },
};
