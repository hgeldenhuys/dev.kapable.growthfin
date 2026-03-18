---
name: find-concept
description: Locate code by high-level concepts (authentication, campaigns, contacts) when you don't know exact file names - gets architectural overview
trigger: When exploring unfamiliar modules, understanding how a feature works, or finding entry points for a concept
examples:
  - "Where is authentication implemented?"
  - "Show me all campaign-related code"
  - "How is the CRM module structured?"
  - "Find everything related to contacts"
---

# find-concept - Concept Locator

## When to Use This Skill

**ALWAYS use this skill when:**
- 🗺️ Exploring unfamiliar parts of the codebase
- 🎯 Finding where to add new code
- 📖 Understanding how a feature is implemented
- 🔍 Locating entry points for a module
- 🏗️ Getting architectural overview of a concept

**Example triggers:**
- User asks: "Where is X implemented?"
- Before coding: "Let me understand the module structure first"
- Code exploration: "How does the campaigns feature work?"
- Finding files: "Where should I add this code?"

## How to Use

**Find code by concept:**
```bash
bun .claude/sdlc/scripts/find-concept.ts "<concept-keyword>"
```

**Examples:**
```bash
bun .claude/sdlc/scripts/find-concept.ts "authentication"
bun .claude/sdlc/scripts/find-concept.ts "campaigns"
bun .claude/sdlc/scripts/find-concept.ts "contacts"
bun .claude/sdlc/scripts/find-concept.ts "workspace"
```

**Get help:**
```bash
bun .claude/sdlc/scripts/find-concept.ts --help
```

## Examples

### Understanding a Feature
```bash
# How does the campaigns feature work?
bun .claude/sdlc/scripts/find-concept.ts "campaigns"

# Output shows:
# - Entry Points: API routes, React hooks
# - Core Services: campaigns.ts, recurring.ts
# - Data Models: Database schemas
# - UI Routes: Route components
# - Config: Settings and types

# Now you understand the full architecture
```

### Finding Where to Add Code
```bash
# Need to add contact validation logic
bun .claude/sdlc/scripts/find-concept.ts "contacts"

# Shows:
# - Services: contacts.ts (business logic)
# - Routes: contacts routes (API)
# - Schema: contacts schema (database)

# Add validation to contacts.ts service
```

### Exploring Authentication
```bash
# How is auth implemented?
bun .claude/sdlc/scripts/find-concept.ts "auth"

# Shows complete auth flow:
# - Hooks: useAuth
# - Middleware: requireAuth
# - Routes: login, logout
# - Services: JWT handling
# - Database: users, sessions
```

## What the Tool Does

1. **Semantic search** with keyword expansion (auth → authentication, login, session, jwt)
2. **Weighted scoring**: 60% file path structure + 40% content
3. **Categorizes results** by architectural layer
4. **Shows entry points** first (routes, pages)
5. **Fast search** (~0.05s for 880 files)

## Output Format

```
Concept: campaigns

Found 52 relevant files

Entry Points:
  → apps/api/src/modules/crm/routes/campaigns.ts (score: 51)
  → apps/web/app/hooks/useCampaigns.ts (score: 39)
  → apps/web/app/hooks/useCampaignStream.ts (score: 37)

Core Services:
  → apps/api/src/modules/crm/services/campaigns.ts (score: 45)
  → apps/api/src/modules/crm/services/recurring.ts (score: 5)

Data Models:
  → packages/db/src/schema/campaigns.ts (score: 49)

API Routes:
  → apps/web/app/routes/dashboard.$workspaceId.crm.campaigns._index.tsx
  → apps/web/app/routes/dashboard.$workspaceId.crm.campaigns.new.tsx
```

## Categories Explained

### Entry Points
**What:** Routes, pages, hooks - where users/code enter the feature

**Use when:**
- Starting to understand a feature
- Finding user-facing endpoints
- Locating API routes

### Core Services
**What:** Business logic layer - services, handlers, processors

**Use when:**
- Adding business logic
- Understanding data flow
- Finding where to add validation

### Data Models
**What:** Database schemas, types, migrations

**Use when:**
- Understanding data structure
- Adding new fields
- Database changes needed

### API Routes
**What:** HTTP endpoints, route handlers

**Use when:**
- Adding new endpoints
- Understanding API contract
- Finding request/response handling

### Components
**What:** React components, UI elements

**Use when:**
- Adding UI features
- Understanding frontend
- Finding component usage

### Config
**What:** Configuration files, constants, settings

**Use when:**
- Understanding feature flags
- Finding environment config
- Locating constants

## Scoring System

**Path weighting (60%):**
- File path matches concept → High score
- Deep in directory tree → Medium score
- Generic location → Low score

**Content weighting (40%):**
- Keyword in file content → Points
- Multiple mentions → More points
- Related keywords → Bonus points

**Example:**
```
File: apps/api/src/modules/crm/services/campaigns.ts
Concept: "campaigns"

Path score: 65 pts (perfect match in path)
Content score: 16 pts (keyword appears 12 times)
Total: 81 pts (High relevance!)
```

## Keyword Expansion

The tool automatically expands your search:

| Your Input | Expands To |
|------------|------------|
| "auth" | authentication, login, logout, session, token, jwt, user |
| "campaign" | campaigns, email, drip, recurring, marketing |
| "contact" | contacts, people, leads, recipients, crm |
| "workspace" | workspaces, tenant, organization, team, multi-tenant |

## Performance

- Analyzes 881 files in ~0.05 seconds
- Hierarchical categorization
- Relevance-ranked results
- Keyword expansion for better matches

## Workflow Integration

**Typical usage in feature development:**

```python
# 1. BEFORE starting work on unfamiliar module
Use find-concept skill to map architecture
  ↓
# 2. Understand structure
Review entry points, services, models
  ↓
# 3. Find right file to modify
Navigate to appropriate layer
  ↓
# 4. Make changes
Confident you're in the right place
```

## Tips

**Choosing keywords:**
- Use singular form: "campaign" not "campaigns"
- Try broad terms first: "auth" not "jwt-authentication"
- One or two words max
- Check spelling

**Reading output:**
- Start with Entry Points (routes, hooks)
- Then Core Services (business logic)
- Then Data Models (database)
- Scores show relevance (higher = better match)

**When few results:**
- Try broader term ("contact" instead of "contact-validation")
- Try related term ("auth" instead of "authentication")
- Check spelling
- Concept might not exist yet

**When too many results:**
- Be more specific ("campaign-email" instead of "campaign")
- Look at scores (>40 = very relevant)
- Focus on Entry Points first

## Related Skills

- **find-pattern** - Find architectural patterns within the concept
- **deps** - Analyze dependencies of concept files
- **rubber-duck** - Understand complex module architecture

## Remember

**ALWAYS explore with find-concept BEFORE diving into code.**

This prevents:
- ❌ Modifying wrong files
- ❌ Missing related code
- ❌ Breaking existing patterns
- ❌ Wasting time searching manually

The 5 seconds spent finding the concept saves 30 minutes of exploring files.

**Pro tip:** Combine with other skills:
1. find-concept to locate module
2. find-pattern to see how it's built
3. deps to check dependencies
4. Now you fully understand it!
