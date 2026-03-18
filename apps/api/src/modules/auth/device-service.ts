/**
 * Device Authentication Service
 * Implements OAuth 2.0 Device Authorization Grant Flow
 * For CLI authentication
 */

import type { Database } from '@agios/db';
import { deviceCodes, users } from '@agios/db';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Generate a random user code (6-digit alphanumeric)
 */
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate a random device code (32 bytes hex)
 */
function generateDeviceCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

export const deviceAuthService = {
  /**
   * Initialize device flow
   * Returns device_code and user_code for CLI
   */
  async initDeviceFlow(db: Database) {
    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minute expiry

    await db.insert(deviceCodes).values({
      deviceCode,
      userCode,
      confirmed: false,
      expiresAt,
    });

    return {
      deviceCode,
      userCode,
      expiresAt,
      verificationUri: `${process.env.WEB_URL || 'http://localhost:5173'}/device`,
      interval: 5, // Poll every 5 seconds
    };
  },

  /**
   * Confirm device code with user authentication
   * Called from web app after user logs in and enters user_code
   */
  async confirmDeviceCode(db: Database, userCode: string, userId: string) {
    const [deviceCode] = await db
      .select()
      .from(deviceCodes)
      .where(eq(deviceCodes.userCode, userCode))
      .limit(1);

    if (!deviceCode) {
      throw new Error('Invalid user code');
    }

    // Check if expired
    if (new Date() > new Date(deviceCode.expiresAt)) {
      throw new Error('User code has expired');
    }

    // Check if already confirmed
    if (deviceCode.confirmed) {
      throw new Error('User code already used');
    }

    // Update device code with userId and mark as confirmed
    await db
      .update(deviceCodes)
      .set({ userId, confirmed: true })
      .where(eq(deviceCodes.id, deviceCode.id));

    return { success: true };
  },

  /**
   * Poll for device code confirmation
   * Called by CLI to check if user has confirmed the device
   */
  async pollDeviceCode(db: Database, deviceCode: string) {
    const [device] = await db
      .select()
      .from(deviceCodes)
      .where(eq(deviceCodes.deviceCode, deviceCode))
      .limit(1);

    if (!device) {
      throw new Error('Invalid device code');
    }

    // Check if expired
    if (new Date() > new Date(device.expiresAt)) {
      throw new Error('Device code has expired');
    }

    // If not confirmed yet, return pending status
    if (!device.confirmed || !device.userId) {
      return {
        status: 'pending',
        message: 'Waiting for user confirmation',
      };
    }

    // Device is confirmed, get user and create session
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, device.userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate access token
    const token = crypto.randomBytes(32).toString('hex');

    return {
      status: 'confirmed',
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  },

  /**
   * Clean up expired device codes
   */
  async cleanupExpiredCodes(db: Database) {
    await db
      .delete(deviceCodes)
      .where(eq(deviceCodes.expiresAt, new Date()));
  },
};
