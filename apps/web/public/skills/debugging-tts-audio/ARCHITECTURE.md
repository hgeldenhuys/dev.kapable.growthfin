# TTS/Audio System Architecture

## System Overview

The audio narration system integrates multiple components to deliver real-time text-to-speech playback in the CLI.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interaction                         │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                      CLI (listen command)                        │
│  - Connects to SSE stream                                        │
│  - Receives audio events                                         │
│  - Plays audio files                                             │
└─────────────────────────────────────────────────────────────────┘
                                 ↑
                                 │ SSE Stream
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                         ElectricSQL                              │
│  - PostgreSQL LISTEN/NOTIFY integration                          │
│  - Real-time event streaming                                     │
│  - Shape-based data replication                                  │
└─────────────────────────────────────────────────────────────────┘
                                 ↑
                                 │ pg_notify
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                         │
│  - audio_cache table                                             │
│  - hook_events table                                             │
│  - pgboss.job queue                                              │
│  - global_voice_settings / project_voice_settings                │
└─────────────────────────────────────────────────────────────────┘
                    ↑                           ↑
                    │                           │
         ┌──────────┴──────────┐      ┌────────┴────────┐
         │                     │      │                 │
┌────────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│   API Server       │  │  Background      │  │   pg-boss       │
│   (ElysiaJS)       │  │  Worker          │  │   Queue         │
│  - REST endpoints  │  │  - generate-     │  │  - Job polling  │
│  - Job queueing    │  │    audio worker  │  │  - Retries      │
└────────────────────┘  └──────────────────┘  └─────────────────┘
         │                     │
         │                     └──────────────┐
         │                                    │
         └────────────────────────────────────┴────────────────┐
                                                                │
                                                                ↓
                                                   ┌────────────────────┐
                                                   │  ElevenLabs API    │
                                                   │  - TTS generation  │
                                                   │  - Voice synthesis │
                                                   └────────────────────┘
```

---

## Audio Generation Flow

### Complete Request Flow

```
1. User triggers audio generation
   ↓
2. API endpoint receives request (POST /api/v1/speak/:eventId)
   ↓
3. Check audio_cache table for existing audio
   ↓
4. If cached → Return URL immediately (200 OK)
   ↓
5. If not cached → Queue job via pg-boss
   ↓
6. Return status 202 (Accepted) with jobId
   ↓
7. Worker picks up job (generate-audio)
   ↓
8. Worker fetches event data from hook_events
   ↓
9. Worker determines speaker role (user/assistant)
   ↓
10. Worker looks up voice settings (project or global)
   ↓
11. Call ElevenLabs API with text + voice
   ↓
12. Receive audio stream from ElevenLabs
   ↓
13. Save audio file to public/cdn/audio/{hash}.mp3
   ↓
14. Insert record in audio_cache table
   ↓
15. Send pg_notify('audio_generated', {eventId, url})
   ↓
16. ElectricSQL picks up NOTIFY
   ↓
17. ElectricSQL streams update to subscribed clients
   ↓
18. CLI receives audio event via SSE
   ↓
19. CLI downloads audio file
   ↓
20. Audio plays in terminal via speaker API
```

---

## Key Components

### Database Layer

**audio_cache Table**
```sql
CREATE TABLE audio_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_event_id UUID NOT NULL REFERENCES hook_events(id),
  audio_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(content_hash)
);
```

**Purpose:** Stores generated audio file URLs to avoid regenerating identical content.

**Key Fields:**
- `hook_event_id` - Links to the event that triggered audio
- `audio_url` - Path to audio file (e.g., `/cdn/audio/abc123.mp3`)
- `content_hash` - SHA-256 hash of text+voice combo (for deduplication)

---

**pgboss.job Table**
```sql
-- Managed by pg-boss library
-- Stores job queue state
```

**Purpose:** Background job queue for async audio generation.

**Job States:**
- `created` - Job queued, waiting for worker
- `active` - Worker currently processing
- `completed` - Job finished successfully
- `failed` - Job failed (will retry)

**Configuration:**
- Retry limit: 3 attempts
- Retry delay: 5 seconds exponential backoff
- Archive after: 7 days

---

**global_voice_settings Table**
```sql
CREATE TABLE global_voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_voice_id UUID NOT NULL REFERENCES voices(id),
  assistant_voice_id UUID NOT NULL REFERENCES voices(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Default voice settings for all projects.

**Priority:** Lowest (overridden by project settings)

---

**project_voice_settings Table**
```sql
CREATE TABLE project_voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  user_voice_id UUID NOT NULL REFERENCES voices(id),
  assistant_voice_id UUID NOT NULL REFERENCES voices(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id)
);
```

**Purpose:** Project-specific voice overrides.

**Priority:** Highest (overrides global settings)

---

### API Server

**File:** `apps/api/src/index.ts`

**Startup Sequence:**
```typescript
1. Initialize database connection
2. Start pg-boss queue
3. Register generate-audio worker
4. Start ElysiaJS server
5. Log worker registration confirmation
```

**Critical Logs to Watch:**
```
✅ Worker registered for job: generate-audio
✅ Generate Audio worker registered
```

---

**File:** `apps/api/src/services/audio-service.ts`

**Responsibilities:**
- Check audio cache for existing files
- Queue new audio generation jobs
- Return appropriate status codes
- Handle voice settings lookup

**Key Functions:**
```typescript
async getOrQueueAudio(eventId: string): Promise<AudioResponse>
async getVoiceSettings(projectId?: string): Promise<VoiceSettings>
```

---

**File:** `apps/api/src/workers/generate-audio.ts`

**Responsibilities:**
- Process audio generation jobs
- Call ElevenLabs API
- Save audio files
- Update audio cache
- Send pg_notify events

**Worker Configuration:**
```typescript
jobQueue.work('generate-audio', {
  teamSize: 5,           // Max concurrent jobs
  teamConcurrency: 1     // Jobs per worker
}, handler);
```

---

**File:** `apps/api/src/lib/queue.ts`

**Responsibilities:**
- pg-boss singleton instance
- Queue configuration
- Job scheduling
- Retry policies

**Key Configuration:**
```typescript
retryLimit: 3
retryDelay: 5000  // ms
archiveCompletedAfterSeconds: 604800  // 7 days
```

---

### ElectricSQL

**Container:** `agios-electric`

**Port:** 3001

**Purpose:** Real-time PostgreSQL replication to clients via HTTP streaming.

**How it Works:**
1. Connects to PostgreSQL logical replication slot
2. Subscribes to table changes (INSERT, UPDATE, DELETE)
3. Streams changes to HTTP clients via SSE
4. Maintains shape-based subscriptions

**Critical for Audio:**
- Streams `audio_cache` table updates
- Delivers pg_notify events
- Provides real-time audio availability

**Health Check:**
```bash
curl http://localhost:3001/v1/health
```

**Expected:**
```json
{
  "status": "ok"
}
```

---

### CLI

**File:** `apps/cli/src/commands/listen.ts`

**Responsibilities:**
- Connect to SSE stream
- Subscribe to audio events
- Download audio files
- Play audio via speaker

**Audio Events Handled:**
- `UserPromptSubmit` - User voice
- `Stop` - Assistant voice
- Custom events with audio

**Playback Flow:**
1. Receive event via SSE
2. Check if audio available in event payload
3. Download audio file from API
4. Queue audio in AudioPlayer
5. Play when queue position reached

---

**File:** `apps/cli/src/lib/audio-player.ts`

**Responsibilities:**
- Audio playback queue management
- Speaker API integration
- PA announcement mixing
- Playback state tracking

**Features:**
- Async playback queue
- Automatic queue draining
- PA announcement priority
- Error handling

---

### External Services

**ElevenLabs API**

**Endpoint:** `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`

**Authentication:** API key in header (`xi-api-key`)

**Request:**
```json
{
  "text": "Hello world",
  "model_id": "eleven_monolingual_v1",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```

**Response:** MP3 audio stream

**Rate Limits:** Varies by plan (check ElevenLabs dashboard)

---

## Data Flow Diagrams

### Cache Hit (Fast Path)

```
Client Request → API → audio_cache table → File exists?
                                                ↓ Yes
                                           Return URL (200 OK)
                                                ↓
                                           Client plays audio
```

**Latency:** < 100ms

---

### Cache Miss (Slow Path)

```
Client Request → API → audio_cache table → File exists?
                                                ↓ No
                                           Queue job (pg-boss)
                                                ↓
                                           Return 202 Accepted
                                                ↓
Worker picks up job → Call ElevenLabs → Save file → Update cache → pg_notify
                                                                         ↓
                                                                  ElectricSQL
                                                                         ↓
                                                                    SSE Stream
                                                                         ↓
                                                                  Client receives event
                                                                         ↓
                                                                  Client plays audio
```

**Latency:** 2-10 seconds (depends on ElevenLabs API)

---

## Connection Pools

### PostgreSQL Connections

**Max Connections:** 100 (configured in PostgreSQL)

**Typical Usage:**
- API server: 10-20 connections (Drizzle pool)
- ElectricSQL: 2-5 connections (replication)
- pg-boss: 5-10 connections (job polling)
- CLI tools: 1-2 connections (temporary)

**Warning Threshold:** 80 connections

**Critical Threshold:** 95 connections

---

### ElectricSQL Connection Pool

**Client Connections:** Unlimited (HTTP streaming)

**Backend Connections:** 2-5 to PostgreSQL

**Connection Lifetime:** Long-lived (hours/days)

**Reconnection:** Automatic with exponential backoff

---

## File Storage

### Audio Files

**Directory:** `public/cdn/audio/`

**File Naming:** `{content_hash}.mp3`

**Example:** `public/cdn/audio/a1b2c3d4e5f6.mp3`

**Permissions:** 755 (read-execute for all, write for owner)

**Cleanup:** Manual (no automatic deletion)

**Size:** Varies (typically 50-500 KB per file)

---

### PA Announcement Files

**Directory:** `apps/cli/resources/`

**Files:**
- `pa-start.m4a` - Session start chime
- `pa-agent.m4a` - Agent transition chime
- `pa-complete.m4a` - Task completion chime

**Format:** M4A (AAC audio)

**Size:** 10-50 KB each

---

## Real-Time Event Flow

### PostgreSQL NOTIFY

**Trigger:** After INSERT/UPDATE on `audio_cache`

```sql
CREATE TRIGGER audio_cache_notify
  AFTER INSERT OR UPDATE ON audio_cache
  FOR EACH ROW
  EXECUTE FUNCTION pg_notify('audio_generated',
    json_build_object('eventId', NEW.hook_event_id, 'url', NEW.audio_url)::text
  );
```

---

### ElectricSQL Shape Subscription

**Client Request:**
```http
GET /v1/shape/audio_cache?where=hook_event_id={eventId}
```

**Response:** SSE stream with updates

```
event: update
data: {"id": "...", "audio_url": "/cdn/audio/...", ...}
```

---

### CLI SSE Connection

**Endpoint:** `http://localhost:3000/api/v1/stream?table=hook_events`

**Connection:** Long-lived HTTP connection

**Heartbeat:** Periodic ping to keep connection alive

**Reconnection:** Automatic on disconnect

---

## Performance Characteristics

### Latency

- **Cache hit:** < 100ms
- **Cache miss (first generation):** 2-10 seconds
- **SSE event delivery:** < 500ms
- **Audio file download:** < 1 second

### Throughput

- **Concurrent audio generations:** 5 workers × 1 job each = 5 parallel
- **Audio cache lookup:** 1000+ requests/second
- **SSE streaming:** 100+ concurrent connections

### Storage

- **Audio files:** ~200 KB average per file
- **Database overhead:** ~1 KB per audio_cache record
- **Growth rate:** Depends on event volume (typically 10-100 MB/day)

---

## Security Considerations

### API Keys

- **ElevenLabs API key:** Stored in `.env`, never committed
- **Database credentials:** Stored in `.env`, never committed

### File Access

- **Audio files:** Publicly accessible via HTTP
- **No authentication:** Files are served statically
- **Path traversal:** Prevented by hash-based naming

### Database

- **Connection encryption:** Optional (not enabled by default in dev)
- **SQL injection:** Prevented by Drizzle ORM parameterization

---

## Scalability Considerations

### Horizontal Scaling

**API Servers:**
- Multiple instances behind load balancer
- Shared database and pg-boss queue
- Shared file storage (NFS or object storage)

**Workers:**
- Scale by increasing `teamSize` in worker config
- Or run multiple API instances (each registers workers)

**ElectricSQL:**
- Single instance per database
- Can scale to thousands of SSE clients

### Vertical Scaling

**Database:**
- Increase PostgreSQL connection limit
- Add read replicas for cache lookups
- Optimize indexes on audio_cache table

**File Storage:**
- Move to CDN (S3 + CloudFront)
- Implement cache eviction policy

---

## Monitoring Points

### Health Checks

1. **API server:** `GET /health`
2. **ElectricSQL:** `GET http://localhost:3001/v1/health`
3. **PostgreSQL:** Connection count query
4. **Worker registration:** Check API logs

### Metrics to Track

- Audio cache hit rate
- Average audio generation time
- Job queue depth
- Failed job count
- Database connection count
- SSE connection count
- Disk usage (audio files)

### Alerting Thresholds

- Database connections > 80: Warning
- Database connections > 95: Critical
- Failed jobs > 50: Warning
- Job queue depth > 100: Warning
- Disk usage > 90%: Critical
