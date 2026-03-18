/**
 * Auth Service
 * Simple authentication service using bcrypt
 */

import type { Database } from '@agios/db';
import { users, sessions } from '@agios/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const authService = {
  /**
   * Sign in with email and password
   */
  async signIn(db: Database, email: string, password: string) {
    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    if (!user.password) {
      throw new Error('User has no password set');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    const [session] = await db
      .insert(sessions)
      .values({
        userId: user.id,
        token,
        expiresAt,
      })
      .returning();

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  },

  /**
   * Sign up with email and password
   */
  async signUp(
    db: Database,
    email: string,
    password: string,
    name?: string
  ) {
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email,
        password: passwordHash,
        name: name || null,
        emailVerified: false,
      })
      .returning();

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    const [session] = await db
      .insert(sessions)
      .values({
        userId: user.id,
        token,
        expiresAt,
      })
      .returning();

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  },

  /**
   * Get session by token
   */
  async getSession(db: Database, token: string) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > new Date(session.expiresAt)) {
      return null;
    }

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  },

  /**
   * Sign out (delete session)
   */
  async signOut(db: Database, token: string) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return { success: true };
  },

  /**
   * Generate an HMAC-signed password reset token (no DB changes needed).
   * Token format: base64url({ userId, exp }) + "." + hmac_signature
   * Expires in 1 hour.
   */
  generateResetToken(userId: string): string {
    const secret = process.env['BETTER_AUTH_SECRET'] || process.env['SESSION_SECRET'] || 'reset-secret';
    const exp = Date.now() + 60 * 60 * 1000; // 1 hour
    const payload = Buffer.from(JSON.stringify({ userId, exp })).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  },

  /**
   * Verify a password reset token and return the userId if valid.
   */
  verifyResetToken(token: string): string | null {
    const secret = process.env['BETTER_AUTH_SECRET'] || process.env['SESSION_SECRET'] || 'reset-secret';
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

    // Timing-safe comparison
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (!data.userId || !data.exp) return null;
      if (Date.now() > data.exp) return null;
      return data.userId;
    } catch {
      return null;
    }
  },

  /**
   * Request a password reset — finds user by email and sends a reset email.
   * Always returns success to prevent email enumeration.
   */
  async requestPasswordReset(db: Database, email: string, appUrl: string): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) return; // Silent fail to prevent enumeration

    const token = this.generateResetToken(user.id);
    const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

    const resendApiKey = process.env['RESEND_API_KEY'];
    if (!resendApiKey) {
      console.warn('[auth] RESEND_API_KEY not set, skipping password reset email');
      console.log(`[auth] Would send reset link to ${email}: ${resetUrl}`);
      return;
    }

    const fromEmail = process.env['RESEND_FROM_EMAIL'] || 'noreply@signaldb.live';

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: 'Reset your GrowthFin password',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2>Reset your password</h2>
              <p>Click the link below to reset your password:</p>
              <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
              <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[auth] Resend API error:', error);
      }
    } catch (error) {
      console.error('[auth] Failed to send password reset email:', error);
    }
  },

  /**
   * Reset password using a valid token.
   */
  async resetPassword(db: Database, token: string, newPassword: string): Promise<void> {
    const userId = this.verifyResetToken(token);
    if (!userId) {
      throw new Error('Invalid or expired reset token');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const result = await db
      .update(users)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (result.length === 0) {
      throw new Error('User not found');
    }
  },
};
