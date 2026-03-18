/**
 * Create Default Test User
 * Creates a default test user for development and testing
 *
 * Credentials:
 * - Email: test@agios.dev
 * - Password: test123
 */

import { db } from '../src/client';
import { users } from '../src/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const TEST_EMAIL = 'test@agios.dev';
const TEST_PASSWORD = 'testpassword123';

async function createTestUser() {
  try {
    console.log('🔍 Checking if test user already exists...');

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('✅ Test user already exists:', TEST_EMAIL);
      console.log('📧 Email:', TEST_EMAIL);
      console.log('🔑 Password:', TEST_PASSWORD);
      return;
    }

    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    console.log('📝 Creating test user...');

    const [newUser] = await db
      .insert(users)
      .values({
        email: TEST_EMAIL,
        name: 'Test User',
        password: passwordHash,
        emailVerified: true,
      })
      .returning();

    console.log('✅ Test user created successfully!');
    console.log('📧 Email:', TEST_EMAIL);
    console.log('🔑 Password:', TEST_PASSWORD);
    console.log('👤 User ID:', newUser.id);

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createTestUser();
