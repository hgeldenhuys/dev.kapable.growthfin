/**
 * Platform Routes Adapter
 *
 * Bridges standalone platform route handlers (deployment-api, storage-api, etc.)
 * into the Elysia app. These handlers use manual regex routing and predate
 * the Elysia migration, so this adapter catches matching requests and delegates.
 *
 * Auth: Validates via admin API key, internal admin header, or platform key.
 */

import { Elysia } from 'elysia';
import { validateAdminKey, validateInternalAdminRequest } from '../lib/admin-auth';
import { validatePlatformKey } from '../lib/platform-auth';
import { handleDeploymentRoutes } from '../routes/deployment-api';
import { handleStorageRoutes } from '../routes/storage-api';
import { handleSchedulerRoutes } from '../routes/scheduler-api';
import { handleTicketRoutes } from '../routes/tickets-api';
import { handleFeatureToggleRoutes } from '../routes/feature-toggles-api';
import { handleEmailRoutes } from '../routes/email-api';
import { handleImageRoutes } from '../routes/image-api';
import { handleVideoRoutes } from '../routes/video-api';
import { handleVoiceRoutes } from '../routes/voice-api';
import { handleAiChatRoutes } from '../routes/ai-chat-api';
import { handleAppDocsRoutes } from '../routes/app-docs-api';
import { handleOrgDocsRoutes } from '../routes/org-docs-api';
import { handleRelayRoutes } from '../routes/relay-api';
import { handleCrescendoRoutes } from '../routes/crescendo-api';
import { handleBootstrapRoutes } from '../routes/bootstrap-api';

/**
 * All handlers in priority order. Each returns Response | null.
 * null means "not my route, try next".
 */
type PlatformHandler = (req: Request, pathname: string, ctx: any) => Promise<Response | null>;

const handlers: PlatformHandler[] = [
  handleDeploymentRoutes,
  handleBootstrapRoutes,
  handleStorageRoutes,
  handleSchedulerRoutes,
  handleTicketRoutes,
  handleFeatureToggleRoutes,
  handleEmailRoutes,
  handleImageRoutes,
  handleVideoRoutes,
  handleVoiceRoutes,
  handleAiChatRoutes,
  handleAppDocsRoutes,
  handleOrgDocsRoutes,
  handleRelayRoutes,
  handleCrescendoRoutes,
];

export const platformRoutes = new Elysia({ name: 'platform-routes' })
  .all('/v1/*', async ({ request }) => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Authenticate: try all auth methods
    let ctx = await validateInternalAdminRequest(request);
    if (!ctx) ctx = await validateAdminKey(request);
    if (!ctx) ctx = await validatePlatformKey(request);

    // Some routes (like deployment callbacks) handle their own auth
    // Pass empty ctx and let the handler decide
    const effectiveCtx = ctx || { orgId: '', keyId: '', scopes: [] };

    // Try each handler until one returns a Response
    for (let i = 0; i < handlers.length; i++) {
      try {
        const response = await handlers[i](request, pathname, effectiveCtx);
        if (response) {
          return response;
        }
      } catch (err: any) {
        console.error(`[platform-routes] Handler error:`, err?.message || err);
        return Response.json(
          { error: 'Internal server error', detail: err?.message },
          { status: 500 }
        );
      }
    }

    // No handler matched — return 404
    // All /v1/* routes without /api/ prefix are platform routes,
    // so a miss here means the route genuinely doesn't exist.
    return Response.json({ error: 'Route not found' }, { status: 404 });
  });
