/**
 * Device Authentication Routes
 * OAuth 2.0 Device Authorization Grant Flow endpoints
 */

import { Elysia, t } from 'elysia';
import { deviceAuthService } from './device-service';

export const deviceAuthRoutes = new Elysia({ prefix: '/auth/device' })
  /**
   * POST /auth/device/init
   * Initialize device authentication flow
   * Returns device_code and user_code for CLI
   */
  .post(
    '/init',
    async ({ db }) => {
      const result = await deviceAuthService.initDeviceFlow(db);
      return result;
    },
    {
      detail: {
        summary: 'Initialize device authentication flow',
        description: 'Start OAuth device flow for CLI authentication',
        tags: ['Auth'],
      },
      response: t.Object({
        deviceCode: t.String(),
        userCode: t.String(),
        expiresAt: t.Date(),
        verificationUri: t.String(),
        interval: t.Number(),
      }),
    }
  )

  /**
   * POST /auth/device/confirm
   * Confirm device code with user authentication
   * Called from web app after user enters user_code
   */
  .post(
    '/confirm',
    async ({ db, body, cookie, set }) => {
      // Import authService to get session
      const { authService } = await import('./service');

      // Check if user is authenticated via session cookie
      const token = cookie.session;
      if (!token) {
        set.status = 401;
        return { error: 'Authentication required' };
      }

      const session = await authService.getSession(db, token);
      if (!session) {
        set.status = 401;
        return { error: 'Invalid or expired session' };
      }

      try {
        const result = await deviceAuthService.confirmDeviceCode(
          db,
          body.userCode,
          session.user.id
        );
        return result;
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Invalid user code',
        };
      }
    },
    {
      body: t.Object({
        userCode: t.String({
          minLength: 6,
          maxLength: 6,
          pattern: '^[A-Z0-9]{6}$',
        }),
      }),
      detail: {
        summary: 'Confirm device code',
        description: 'User confirms device authentication from web app',
        tags: ['Auth'],
      },
      response: t.Object({
        success: t.Boolean(),
      }),
    }
  )

  /**
   * POST /auth/device/poll
   * Poll for device code confirmation
   * Called by CLI to check if user has confirmed
   */
  .post(
    '/poll',
    async ({ db, body, set }) => {
      try {
        const result = await deviceAuthService.pollDeviceCode(
          db,
          body.deviceCode
        );
        return result;
      } catch (error) {
        set.status = 400;
        return {
          status: 'error',
          error: error instanceof Error ? error.message : 'Invalid device code',
        };
      }
    },
    {
      body: t.Object({
        deviceCode: t.String(),
      }),
      detail: {
        summary: 'Poll device code status',
        description: 'Check if device has been confirmed by user',
        tags: ['Auth'],
      },
      response: t.Union([
        t.Object({
          status: t.Literal('pending'),
          message: t.String(),
        }),
        t.Object({
          status: t.Literal('confirmed'),
          accessToken: t.String(),
          user: t.Object({
            id: t.String(),
            email: t.String(),
            name: t.Union([t.String(), t.Null()]),
          }),
        }),
        t.Object({
          status: t.Literal('error'),
          error: t.String(),
        }),
      ]),
    }
  );
