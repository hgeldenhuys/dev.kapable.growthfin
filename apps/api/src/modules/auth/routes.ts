/**
 * Auth Routes
 * Simple authentication endpoints
 */

import { Elysia, t } from 'elysia';
import { authService } from './service';
import { deviceAuthRoutes } from './device-routes';

/**
 * Auth routes
 *
 * Available endpoints:
 * - POST /auth/sign-in/email       - Sign in with email/password
 * - POST /auth/sign-up/email       - Sign up with email/password
 * - POST /auth/sign-out            - Sign out
 * - GET  /auth/session             - Get current session
 * - POST /auth/forgot-password     - Request password reset email
 * - POST /auth/reset-password      - Reset password with token
 * - POST /auth/device/init         - Initialize device flow
 * - POST /auth/device/confirm      - Confirm device code
 * - POST /auth/device/poll         - Poll device status
 */
export const authRoutes = new Elysia()
  // Mount device auth routes
  .use(deviceAuthRoutes)
  // Sign in
  .post('/auth/sign-in/email', async ({ db, body, set }) => {
    try {
      const result = await authService.signIn(db, body.email, body.password);

      // Set session cookie
      set.headers['Set-Cookie'] = `session=${result.session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;

      return result;
    } catch (error) {
      set.status = 401;
      return {
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })

  // Sign up
  .post('/auth/sign-up/email', async ({ db, body, set }) => {
    try {
      const result = await authService.signUp(
        db,
        body.email,
        body.password,
        body.name
      );

      // Set session cookie
      set.headers['Set-Cookie'] = `session=${result.session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;

      return result;
    } catch (error) {
      set.status = 400;
      return {
        error: error instanceof Error ? error.message : 'Sign up failed',
      };
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      name: t.Optional(t.String()),
    }),
  })

  // Get session
  .get('/auth/session', async ({ db, cookie, set }) => {
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

    return session;
  })

  // Sign out
  .post('/auth/sign-out', async ({ db, cookie, set }) => {
    const token = cookie.session;

    if (token) {
      await authService.signOut(db, token);
    }

    // Clear cookie
    set.headers['Set-Cookie'] = 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

    return { success: true };
  })

  // Forgot password — send reset email
  .post('/auth/forgot-password', async ({ db, body, headers }) => {
    // Determine app URL from request origin or fallback
    const origin = headers['origin'] || headers['referer'] || '';
    let appUrl = 'https://growthfin.signaldb.app';
    if (origin) {
      try {
        const url = new URL(origin);
        appUrl = url.origin;
      } catch {}
    }

    await authService.requestPasswordReset(db, body.email, appUrl);

    // Always return success to prevent email enumeration
    return { message: 'If an account exists with that email, a reset link has been sent.' };
  }, {
    body: t.Object({
      email: t.String(),
    }),
  })

  // Reset password — set new password with token
  .post('/auth/reset-password', async ({ db, body, set }) => {
    try {
      await authService.resetPassword(db, body.token, body.password);
      return { message: 'Password has been reset successfully.' };
    } catch (error) {
      set.status = 400;
      return {
        error: error instanceof Error ? error.message : 'Password reset failed',
      };
    }
  }, {
    body: t.Object({
      token: t.String(),
      password: t.String(),
    }),
  });
