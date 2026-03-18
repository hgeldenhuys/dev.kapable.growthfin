/**
 * User Profile Routes
 * Authentication-protected user profile endpoints
 */

import { Elysia, t } from 'elysia';
import { authService } from '../auth/service';
import { userService } from './service';

/**
 * User routes
 *
 * Available endpoints:
 * - GET  /users/search        - Search users by email or name
 * - GET  /users/:userId       - Get user profile
 * - PATCH /users/:userId      - Update user profile
 */
export const userRoutes = new Elysia({ prefix: '/users' })
  // GET /users/search - Search users (must come before /:userId to avoid route conflict)
  .get(
    '/search',
    async ({ db, query, set }) => {
      try {
        // Validate query parameter
        if (!query.q || query.q.trim().length === 0) {
          set.status = 400;
          return { error: 'Search query (q) is required' };
        }

        // Search users
        const users = await userService.searchUsers(
          db,
          query.q,
          query.excludeWorkspace,
          10 // Max 10 results
        );

        return { users };
      } catch (error) {
        console.error('[users/search] Error:', error);
        set.status = 500;
        return { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) };
      }
    },
    {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        excludeWorkspace: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Users'],
        summary: 'Search users',
        description: 'Search for users by email or name. Optionally exclude users already in a workspace.',
      },
    }
  )

  // GET /users/:userId - Get user profile
  .get(
    '/:userId',
    async ({ db, cookie, params, set }) => {
      // Authenticate user via session cookie
      const token = cookie.session;
      if (!token) {
        set.status = 401;
        return { error: 'Not authenticated' };
      }

      const session = await authService.getSession(db, token);
      if (!session) {
        set.status = 401;
        return { error: 'Invalid or expired session' };
      }

      // Verify userId matches authenticated user (users can only view their own profile)
      if (session.user.id !== params.userId) {
        set.status = 403;
        return { error: 'Forbidden: You can only access your own profile' };
      }

      // Get user profile
      const user = await userService.getUserById(db, params.userId);

      if (!user) {
        set.status = 404;
        return { error: 'User not found' };
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      };
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
      detail: {
        tags: ['Users'],
        summary: 'Get user profile',
        description: 'Get authenticated user profile information',
      },
    }
  )

  // PATCH /users/:userId - Update user profile
  .patch(
    '/:userId',
    async ({ db, cookie, params, body, set }) => {
      // Authenticate user via session cookie
      const token = cookie.session;
      if (!token) {
        set.status = 401;
        return { error: 'Not authenticated' };
      }

      const session = await authService.getSession(db, token);
      if (!session) {
        set.status = 401;
        return { error: 'Invalid or expired session' };
      }

      // Verify userId matches authenticated user (users can only update their own profile)
      if (session.user.id !== params.userId) {
        set.status = 403;
        return { error: 'Forbidden: You can only update your own profile' };
      }

      // Validate email format if provided
      if (body.email && !userService.isValidEmail(body.email)) {
        set.status = 400;
        return { error: 'Invalid email format' };
      }

      // Validate that at least one field is provided
      if (!body.name && !body.email) {
        set.status = 400;
        return { error: 'At least one field (name or email) must be provided' };
      }

      try {
        // Update user
        const updatedUser = await userService.updateUser(db, params.userId, {
          name: body.name,
          email: body.email,
        });

        if (!updatedUser) {
          set.status = 404;
          return { error: 'User not found' };
        }

        return {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            emailVerified: updatedUser.emailVerified,
            createdAt: updatedUser.createdAt.toISOString(),
            updatedAt: updatedUser.updatedAt.toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'Email already in use') {
          set.status = 409;
          return { error: 'Email already in use' };
        }
        throw error;
      }
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        email: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Users'],
        summary: 'Update user profile',
        description: 'Update authenticated user profile (name and/or email)',
      },
    }
  );
