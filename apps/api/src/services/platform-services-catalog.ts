/**
 * Platform Services Catalog
 *
 * Generates a markdown section documenting all SignalDB platform services
 * for injection into Forge CLAUDE.md files. Ensures AI agents know about
 * available platform services and use them instead of reinventing functionality.
 */

export function generatePlatformServicesCatalog(): string {
  return `## Platform Services (Available via Environment Variables)

SignalDB provides built-in platform services accessible via environment variables injected at deploy time.
**Always prefer platform services over building custom solutions.**

### 1. Email Service
Send transactional emails via the platform email API.

\`\`\`typescript
// Environment: SIGNALDB_PLATFORM_KEY, SIGNALDB_API_URL
const res = await fetch(\`\${process.env.SIGNALDB_API_URL}/v1/email/send\`, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.SIGNALDB_PLATFORM_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: 'user@example.com',
    subject: 'Welcome!',
    html: '<h1>Hello</h1>',
    from: 'App Name <noreply@signaldb.live>',
  }),
});
\`\`\`

### 2. Image Service (AI Generation + Analysis)
Generate images with AI or analyze existing images.

\`\`\`typescript
// Generate an image
const res = await fetch(\`\${process.env.SIGNALDB_API_URL}/v1/images/generate\`, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.SIGNALDB_PLATFORM_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'A modern dashboard UI mockup',
    aspect_ratio: '16:9',
  }),
});
// Returns: { url: string, ... }

// Analyze an image
const res2 = await fetch(\`\${process.env.SIGNALDB_API_URL}/v1/images/analyze\`, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.SIGNALDB_PLATFORM_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    imageUrl: 'https://example.com/photo.jpg',
    prompt: 'Describe this image',
  }),
});
\`\`\`

### 3. Object Storage (S3-Compatible)
Store files, images, and assets with per-org isolation.

\`\`\`typescript
// Environment: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION
// Use any S3-compatible SDK (e.g., @aws-sdk/client-s3)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

await s3.send(new PutObjectCommand({
  Bucket: process.env.S3_BUCKET,
  Key: 'uploads/photo.jpg',
  Body: fileBuffer,
  ContentType: 'image/jpeg',
}));
\`\`\`

### 4. Feature Toggles
Toggle features on/off with percentage rollout and targeting rules.

\`\`\`typescript
// Evaluate a single flag
const res = await fetch(
  \`\${process.env.SIGNALDB_API_URL}/v1/feature-toggles/evaluate/my-flag?user_id=123\`,
  { headers: { 'Authorization': \`Bearer \${process.env.SIGNALDB_PLATFORM_KEY}\` } }
);
// Returns: { flag: "my-flag", enabled: true, value: true }

// SSE stream for real-time flag changes
const source = new EventSource(
  \`\${process.env.SIGNALDB_API_URL}/v1/feature-toggles/stream?key=\${process.env.SIGNALDB_PLATFORM_KEY}\`
);
source.addEventListener('flag-change', (e) => { /* re-evaluate */ });
\`\`\`

### 5. Authentication (Built-in Auth Gate)
Platform handles user authentication automatically when auth gate is enabled.

\`\`\`typescript
// Server-side: read trusted proxy headers (set by platform)
function getAuthUser(request: Request) {
  const userId = request.headers.get('X-SignalDB-User-Id');
  const email = request.headers.get('X-SignalDB-User-Email');
  const roles = request.headers.get('X-SignalDB-User-Roles')?.split(',') || [];
  const verified = request.headers.get('X-SignalDB-Auth-Verified') === 'true';
  if (!verified || !userId) return null;
  return { userId, email, roles };
}

// Client-side: check current user
const res = await fetch('/__auth/me');
const user = await res.json(); // { id, email, name, roles }

// Key URLs:
// /auth/login — login page (platform-managed)
// /__auth/logout — clear session
// /__auth/me — current user JSON
\`\`\`

### 6. Database (PostgreSQL)
Direct PostgreSQL access via DATABASE_URL.

\`\`\`typescript
// Environment: DATABASE_URL
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!);

// Run queries
const users = await sql\`SELECT * FROM users WHERE active = true\`;
\`\`\`

### 7. Scheduled Jobs (Cron)
Define recurring tasks in signaldb.yaml — platform handles execution.

\`\`\`yaml
# signaldb.yaml
app:
  schedules:
    - name: daily-cleanup
      cron: "0 2 * * *"
      url: /api/cron/cleanup
      description: Clean up expired records
    - name: hourly-sync
      cron: "0 * * * *"
      url: /api/cron/sync
\`\`\`

\`\`\`typescript
// Your webhook handler receives POST with HMAC signature
// Header: X-SignalDB-Cron-Signature
app.post('/api/cron/cleanup', async (req, res) => {
  // Run cleanup logic
  await sql\`DELETE FROM sessions WHERE expires_at < now()\`;
  res.json({ ok: true });
});
\`\`\`

### Environment Variables Reference
| Variable | Description |
|----------|-------------|
| \`DATABASE_URL\` | PostgreSQL connection string |
| \`SIGNALDB_PLATFORM_KEY\` | Platform API key (pk_*) for email, images, toggles |
| \`SIGNALDB_API_URL\` | Platform API base URL (https://api.signaldb.live) |
| \`S3_ENDPOINT\` | MinIO S3 endpoint |
| \`S3_ACCESS_KEY\` | MinIO access key |
| \`S3_SECRET_KEY\` | MinIO secret key |
| \`S3_BUCKET\` | Default storage bucket |
| \`S3_REGION\` | Storage region |
| \`PORT\` | App listen port (usually 3000) |
| \`NODE_ENV\` | Environment (production/development) |
`;
}
