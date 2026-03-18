/**
 * Voice Token Routes (VOICE-001)
 * Generates Twilio capability tokens for browser-based WebRTC calling
 *
 * The token grants the browser the ability to make outbound calls through
 * a TwiML Application. When the browser initiates a call, Twilio will
 * fetch TwiML instructions from the application's Voice URL.
 */

import { Elysia, t } from 'elysia';
import twilio from 'twilio';

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

/**
 * Environment configuration
 * For browser calling, we need:
 * - Account SID: Your Twilio account identifier
 * - API Key + Secret: Used to sign tokens (can use main credentials if no API key exists)
 * - TwiML App SID: Application that handles outbound call routing
 */
function getVoiceConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Use dedicated API key if available, otherwise fall back to account credentials
  const apiKeySid = process.env.TWILIO_API_KEY || accountSid;
  const apiKeySecret = process.env.TWILIO_API_SECRET || authToken;

  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
  }

  if (!twimlAppSid) {
    throw new Error(
      'TWILIO_TWIML_APP_SID is required for browser calling. ' +
        'Create a TwiML App in Twilio Console and set its Voice URL to your /api/v1/crm/twiml/client-voice endpoint.'
    );
  }

  return {
    accountSid,
    apiKeySid,
    apiKeySecret,
    twimlAppSid,
  };
}

/**
 * Generate a unique identity for the browser client
 * This identity appears in call logs and can be used for push notifications
 */
function generateClientIdentity(workspaceId: string, userId?: string): string {
  // Format: agent_{workspaceId}_{userId or timestamp}
  const userPart = userId || `anon_${Date.now()}`;
  return `agent_${workspaceId}_${userPart}`.replace(/-/g, '_');
}

export const voiceTokenRoutes = new Elysia({ prefix: '/voice' })
  /**
   * GET /api/v1/voice/token
   *
   * Generates a Twilio Access Token with VoiceGrant for browser-based calling.
   * The token allows the browser to:
   * - Connect to Twilio's WebRTC infrastructure
   * - Make outbound calls through the configured TwiML Application
   *
   * Token expires in 1 hour (3600 seconds).
   */
  .get(
    '/token',
    async ({ query, set }) => {
      try {
        const config = getVoiceConfig();
        const identity = generateClientIdentity(query.workspaceId, query.userId);

        // Calculate expiration (1 hour from now)
        const ttl = 3600; // 1 hour in seconds
        const expiresAt = new Date(Date.now() + ttl * 1000);

        // Create Access Token
        const token = new AccessToken(config.accountSid, config.apiKeySid!, config.apiKeySecret!, {
          identity,
          ttl,
        });

        // Create Voice Grant with outgoing capability
        const voiceGrant = new VoiceGrant({
          outgoingApplicationSid: config.twimlAppSid,
          // Allow incoming calls if we want to receive calls in browser
          // incomingAllow: true,
        });

        // Add grant to token
        token.addGrant(voiceGrant);

        console.log(`[voice/token] Generated token for identity: ${identity}`, {
          workspaceId: query.workspaceId,
          userId: query.userId,
          expiresAt: expiresAt.toISOString(),
        });

        return {
          token: token.toJwt(),
          identity,
          expiresAt: expiresAt.toISOString(),
        };
      } catch (error) {
        console.error('[voice/token] Error generating token:', error);

        // Check for specific configuration errors
        if (error instanceof Error && error.message.includes('TWILIO')) {
          set.status = 500;
          return {
            error: 'Voice configuration error',
            message: error.message,
            hint: 'Ensure all required Twilio environment variables are set',
          };
        }

        set.status = 500;
        return {
          error: 'Failed to generate voice token',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      query: t.Object({
        workspaceId: t.String({
          description: 'Workspace ID for context',
        }),
        userId: t.Optional(
          t.String({
            description: 'User ID for identity generation (optional)',
          })
        ),
      }),
      detail: {
        tags: ['Voice'],
        summary: 'Get Twilio capability token for browser calling',
        description: `
Generates a Twilio Access Token that allows browser-based WebRTC calling.

**Prerequisites:**
1. Configure TWILIO_TWIML_APP_SID environment variable
2. Create a TwiML App in Twilio Console
3. Set the TwiML App's Voice URL to your /api/v1/crm/twiml/client-voice endpoint

**Token Capabilities:**
- Make outbound calls through the TwiML Application
- Token expires in 1 hour

**Usage:**
1. Call this endpoint to get a token
2. Initialize Twilio.Device with the token
3. Use device.connect() to initiate calls
        `,
        responses: {
          200: {
            description: 'Capability token generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: {
                      type: 'string',
                      description: 'JWT token for Twilio Device initialization',
                    },
                    identity: {
                      type: 'string',
                      description: 'Client identity associated with the token',
                    },
                    expiresAt: {
                      type: 'string',
                      format: 'date-time',
                      description: 'Token expiration timestamp (ISO 8601)',
                    },
                  },
                  required: ['token', 'identity', 'expiresAt'],
                },
              },
            },
          },
          500: {
            description: 'Configuration or generation error',
          },
        },
      },
    }
  );
