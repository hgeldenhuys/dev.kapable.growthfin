# Output Examples

## Healthy Status

```json
{
  "status": "healthy",
  "services": {
    "api": {"status": "healthy", "uptime": "2h 15m"},
    "database": {"status": "healthy", "connections": 5},
    "queue": {"status": "healthy", "queues_active": 4},
    "frontend": {"status": "healthy", "port": 5173}
  },
  "error_patterns": [],
  "new_impediments": [],
  "requires_intervention": false
}
```

## Degraded Status (Auto-Fixed)

```json
{
  "status": "degraded",
  "services": {
    "api": {"status": "degraded", "error_rate": 7.5},
    "database": {"status": "healthy"},
    "queue": {"status": "degraded", "missing_queues": ["calculate-ab-test"]},
    "frontend": {"status": "healthy"}
  },
  "error_patterns": [
    {
      "signature": "Queue calculate-ab-test does not exist",
      "occurrences": 15,
      "frequency": 7.5,
      "severity": "medium"
    }
  ],
  "auto_fixes_attempted": [
    {
      "pattern": "queue_not_exist",
      "success": true,
      "action": "Created queue: calculate-ab-test",
      "verification": "pending"
    }
  ],
  "new_impediments": [],
  "requires_intervention": false,
  "recommendations": [
    "Monitor queue errors for next 5 minutes to verify fix",
    "Add queue creation to project setup documentation"
  ]
}
```

## Critical Status (Needs Intervention)

```json
{
  "status": "critical",
  "services": {
    "api": {"status": "stopped", "last_seen": "5 minutes ago"},
    "database": {"status": "error", "error": "connection refused"},
    "queue": {"status": "degraded"},
    "frontend": {"status": "healthy"}
  },
  "error_patterns": [
    {
      "signature": "ECONNREFUSED localhost:5439",
      "occurrences": 1,
      "severity": "critical"
    }
  ],
  "auto_fixes_attempted": [
    {
      "pattern": "database_connection_refused",
      "success": false,
      "error": "Docker container not running"
    }
  ],
  "new_impediments": [
    {
      "id": "IMP-HEALTH-001",
      "severity": "critical",
      "type": "database_connection",
      "message": "Database connection refused",
      "action_required": "Start PostgreSQL database"
    }
  ],
  "requires_intervention": true,
  "recommendations": [
    "Start database: docker-compose up -d postgres",
    "Verify connection: bun run db:check",
    "Pause sprint until resolved"
  ]
}
```

## Error Pattern Examples

### Queue Doesn't Exist

```json
{
  "signature": "Queue calculate-ab-test does not exist",
  "normalized": "queue_not_exist:calculate-ab-test",
  "first_seen": "2025-10-22T10:15:00Z",
  "last_seen": "2025-10-22T10:17:00Z",
  "occurrences": 15,
  "frequency": 7.5,
  "severity": "medium",
  "impact": {
    "blocks_agents": true,
    "affects_features": ["queue-based jobs"]
  },
  "auto_fix": {
    "available": true,
    "safe": true,
    "strategy": "create_queue"
  }
}
```

### Database Connection Failed

```json
{
  "signature": "ECONNREFUSED localhost:5439",
  "normalized": "connection_refused:postgres:5439",
  "first_seen": "2025-10-22T10:20:00Z",
  "occurrences": 1,
  "severity": "critical",
  "impact": {
    "blocks_agents": true,
    "affects_features": ["all database operations"]
  },
  "auto_fix": {
    "available": true,
    "safe": true,
    "strategy": "start_database"
  }
}
```
