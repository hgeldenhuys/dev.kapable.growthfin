/**
 * SDLC Snapshot Builder Service
 * Builds SDLC snapshot from database records instead of filesystem
 */

import { db } from '@agios/db/client';
import { sdlcFiles } from '@agios/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { SDLCSnapshot } from '../types';
import { parseFileContent } from './file-parser';

/**
 * Extract individual coherence metrics from markdown content
 * Parses the "## Coherence Metrics" section to extract metric scores
 */
function extractCoherenceMetrics(content: string): any {
  const metrics: any = {};

  // Extract all metrics dynamically using pattern matching
  // Pattern: ### Metric N: Name ... **Actual**: **0.XX**
  const metricRegex = /###\s+Metric\s+\d+:\s+([^\n]+)\s*\n[\s\S]*?\*\*Actual\*\*:\s+\*\*([0-9.]+)\*\*/gi;

  let match;
  while ((match = metricRegex.exec(content)) !== null) {
    const metricName = match[1].trim();
    const metricValue = parseFloat(match[2]);

    // Convert metric name to snake_case key
    const key = metricName.toLowerCase().replace(/\s+/g, '_');
    metrics[key] = metricValue;
  }

  return Object.keys(metrics).length > 0 ? metrics : null;
}

/**
 * Categorize file based on path
 */
function categorizeFile(path: string): string {
  if (path.startsWith('stories/')) return 'stories';
  if (path.startsWith('epics/')) return 'epics';
  if (path.startsWith('kanban/')) return 'kanban';
  if (path.startsWith('knowledge/graph/')) return 'knowledgeGraph';
  if (path.startsWith('coherence/') || path.includes('coherence-check') || path.startsWith('audits/')) return 'coherence';
  if (path.startsWith('logs/retrospectives/')) return 'retrospectives';
  if (path.startsWith('backlog/')) return 'backlog';
  if (path.startsWith('prds/') || path.startsWith('prd/')) return 'prds';
  return 'unknown';
}

/**
 * Get story status from file path
 */
function getStoryStatus(path: string): string | null {
  const match = path.match(/^stories\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Get epic status from file path
 */
function getEpicStatus(path: string): string | null {
  const match = path.match(/^epics\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Get backlog category from file path
 */
function getBacklogCategory(path: string): string | null {
  const match = path.match(/^backlog\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Get knowledge graph entity type from file path
 */
function getKnowledgeGraphType(path: string): string | null {
  const match = path.match(/^knowledge\/graph\/entities\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Build SDLC snapshot from database records
 * Uses DISTINCT ON to get the latest version of each file per PROJECT
 *
 * IMPORTANT: SDLC files are scoped by PROJECT, not session.
 * A retrospective, story, or epic belongs to the project across all sessions.
 *
 * @param projectIdOrSessionId - If provided and looks like UUID, treated as projectId filter. Otherwise returns all projects' data.
 */
export async function getSnapshotFromDatabase(projectIdOrSessionId: string | undefined): Promise<SDLCSnapshot> {
  // For backwards compatibility, support both projectId and sessionId
  // But prioritize projectId since that's the correct scope
  let projectId: string | undefined;

  if (projectIdOrSessionId) {
    // Try to get projectId from sessions table if it looks like a sessionId
    // Or use it directly as projectId
    const session = await db
      .select({ projectId: claudeSessions.projectId })
      .from(claudeSessions)
      .where(eq(claudeSessions.id, projectIdOrSessionId))
      .limit(1);

    if (session.length > 0 && session[0].projectId) {
      projectId = session[0].projectId;
      console.log('[SDLC Snapshot Builder] Building snapshot for project:', projectId, '(from session)');
    } else {
      // Assume it's a projectId
      projectId = projectIdOrSessionId;
      console.log('[SDLC Snapshot Builder] Building snapshot for project:', projectId);
    }
  } else {
    console.log('[SDLC Snapshot Builder] Building snapshot from ALL projects (no filter)');
  }

  const startTime = Date.now();

  // Query for latest version of each file PER PROJECT
  // Using DISTINCT ON to get only the latest eventTimestamp per path
  // JOIN with claude_sessions to filter by projectId (sdlc_files doesn't have projectId column yet)
  const files = projectId
    ? await db
        .selectDistinctOn([sdlcFiles.path], {
          path: sdlcFiles.path,
          content: sdlcFiles.content,
          operation: sdlcFiles.operation,
          category: sdlcFiles.category,
          eventTimestamp: sdlcFiles.eventTimestamp,
          parsedData: sdlcFiles.parsedData,
        })
        .from(sdlcFiles)
        .innerJoin(claudeSessions, eq(sdlcFiles.sessionId, claudeSessions.id))
        .where(eq(claudeSessions.projectId, projectId))
        .orderBy(sdlcFiles.path, desc(sdlcFiles.eventTimestamp))
    : await db
        .selectDistinctOn([sdlcFiles.path], {
          path: sdlcFiles.path,
          content: sdlcFiles.content,
          operation: sdlcFiles.operation,
          category: sdlcFiles.category,
          eventTimestamp: sdlcFiles.eventTimestamp,
          parsedData: sdlcFiles.parsedData,
        })
        .from(sdlcFiles)
        .orderBy(sdlcFiles.path, desc(sdlcFiles.eventTimestamp));

  // ALSO query coherence files from ALL sessions (not session-specific)
  const coherenceFiles = await db
    .selectDistinctOn([sdlcFiles.path], {
      path: sdlcFiles.path,
      content: sdlcFiles.content,
      operation: sdlcFiles.operation,
      category: sdlcFiles.category,
      eventTimestamp: sdlcFiles.eventTimestamp,
      parsedData: sdlcFiles.parsedData,
    })
    .from(sdlcFiles)
    .where(eq(sdlcFiles.category, 'coherence'))
    .orderBy(sdlcFiles.path, desc(sdlcFiles.eventTimestamp));

  // ALSO query knowledge graph files from ALL sessions (not session-specific)
  const knowledgeGraphFiles = await db
    .selectDistinctOn([sdlcFiles.path], {
      path: sdlcFiles.path,
      content: sdlcFiles.content,
      operation: sdlcFiles.operation,
      category: sdlcFiles.category,
      eventTimestamp: sdlcFiles.eventTimestamp,
      parsedData: sdlcFiles.parsedData,
    })
    .from(sdlcFiles)
    .where(eq(sdlcFiles.category, 'knowledgeGraph'))
    .orderBy(sdlcFiles.path, desc(sdlcFiles.eventTimestamp));

  // ALSO query kanban files from ALL sessions (not session-specific)
  const kanbanFiles = await db
    .selectDistinctOn([sdlcFiles.path], {
      path: sdlcFiles.path,
      content: sdlcFiles.content,
      operation: sdlcFiles.operation,
      category: sdlcFiles.category,
      eventTimestamp: sdlcFiles.eventTimestamp,
      parsedData: sdlcFiles.parsedData,
    })
    .from(sdlcFiles)
    .where(eq(sdlcFiles.category, 'kanban'))
    .orderBy(sdlcFiles.path, desc(sdlcFiles.eventTimestamp));

  // Merge coherence, knowledge graph, and kanban files with session files (non-session data takes precedence)
  const coherencePaths = new Set(coherenceFiles.map(f => f.path));
  const knowledgeGraphPaths = new Set(knowledgeGraphFiles.map(f => f.path));
  const kanbanPaths = new Set(kanbanFiles.map(f => f.path));
  const allFiles = [
    ...coherenceFiles,
    ...knowledgeGraphFiles,
    ...kanbanFiles,
    ...files.filter(f => !coherencePaths.has(f.path) && !knowledgeGraphPaths.has(f.path) && !kanbanPaths.has(f.path))
  ];

  console.log(`[SDLC Snapshot Builder] Found ${files.length} session files + ${coherenceFiles.length} coherence files + ${knowledgeGraphFiles.length} knowledge graph files + ${kanbanFiles.length} kanban files`);

  // Initialize snapshot structure
  const snapshot: SDLCSnapshot = {
    stories: {
      todo: [],
      ready: [],
      inProgress: [],
      review: [],
      done: [],
      backlog: [],
      blocked: [],
      archived: [],
    },
    epics: {
      active: [],
      planned: [],
      completed: [],
    },
    kanban: {
      board: null,
      wipLimits: null,
      boardHistory: [],
    },
    knowledgeGraph: {
      entities: {
        components: [],
        decisions: [],
        understandings: [],
        values: [],
        purposes: [],
      },
      relations: [],
    },
    coherence: {
      latest: null,
      historical: [],
    },
    retrospectives: [],
    backlog: {
      improvements: [],
      experiments: [],
      technicalDebt: [],
    },
    prds: [],
    metadata: {
      timestamp: new Date().toISOString(),
      totalFiles: 0,
      categories: {},
    },
  };

  // Process each file
  let processedCount = 0;
  for (const file of allFiles) {
    // Skip deleted files
    if (file.operation === 'deleted' || !file.content) {
      continue;
    }

    processedCount++;

    // Parse file content
    const parsed = parseFileContent(file.path, file.content);
    // Use database category if available, otherwise calculate from path
    const category = file.category || categorizeFile(file.path);

    // Count by category
    snapshot.metadata.categories[category] = (snapshot.metadata.categories[category] || 0) + 1;

    // Organize into appropriate structure
    switch (category) {
      case 'stories': {
        const status = getStoryStatus(file.path);
        if (status && status in snapshot.stories) {
          snapshot.stories[status as keyof typeof snapshot.stories].push(parsed);
        }
        break;
      }

      case 'epics': {
        const status = getEpicStatus(file.path);
        if (status && status in snapshot.epics) {
          snapshot.epics[status as keyof typeof snapshot.epics].push(parsed);
        }
        break;
      }

      case 'kanban': {
        if (file.path.includes('board.json')) {
          snapshot.kanban.board = parsed;
        } else if (file.path.includes('wip-limits')) {
          snapshot.kanban.wipLimits = parsed;
        } else if (file.path.includes('board-history/')) {
          snapshot.kanban.boardHistory.push(parsed);
        }
        break;
      }

      case 'knowledgeGraph': {
        const entityType = getKnowledgeGraphType(file.path);
        if (entityType && entityType in snapshot.knowledgeGraph.entities) {
          snapshot.knowledgeGraph.entities[entityType as keyof typeof snapshot.knowledgeGraph.entities].push(parsed);
        } else if (file.path.includes('relations/')) {
          snapshot.knowledgeGraph.relations.push(parsed);
        }
        break;
      }

      case 'coherence': {
        // Use parsedData if available (from coherence-check API endpoint), but include full content
        const coherenceData = file.parsedData ? {
          ...file.parsedData,
          content: file.content, // Always include full markdown content
        } : {
          ...parsed,
          content: file.content, // Always include full markdown content
        };

        // Extract individual metrics from content if not already present
        if (!coherenceData.metrics && file.content) {
          const extractedMetrics = extractCoherenceMetrics(file.content);
          if (extractedMetrics) {
            coherenceData.metrics = extractedMetrics;
          }
        }

        // Collect all coherence files - we'll determine latest after processing all files
        // Include eventTimestamp for sorting
        coherenceData.eventTimestamp = file.eventTimestamp;
        snapshot.coherence.historical.push(coherenceData);
        break;
      }

      case 'retrospectives': {
        snapshot.retrospectives.push(parsed);
        break;
      }

      case 'backlog': {
        const backlogCategory = getBacklogCategory(file.path);
        if (backlogCategory && backlogCategory in snapshot.backlog) {
          snapshot.backlog[backlogCategory as keyof typeof snapshot.backlog].push(parsed);
        }
        break;
      }

      case 'prds': {
        snapshot.prds.push(parsed);
        break;
      }
    }
  }

  snapshot.metadata.totalFiles = processedCount;

  // After processing all files, select the most recent coherence file as latest
  if (snapshot.coherence.historical.length > 0) {
    // Filter out files that failed to parse (have raw: true or missing overall score)
    const validCoherence = snapshot.coherence.historical.filter((c: any) =>
      !c.raw && c.overall !== undefined && c.overall !== null
    );

    if (validCoherence.length > 0) {
      // Sort by eventTimestamp descending (most recent first)
      const sortedCoherence = validCoherence.slice().sort((a: any, b: any) => {
        const timeA = a.eventTimestamp ? new Date(a.eventTimestamp).getTime() : 0;
        const timeB = b.eventTimestamp ? new Date(b.eventTimestamp).getTime() : 0;
        return timeB - timeA;
      });

      // Most recent becomes latest
      snapshot.coherence.latest = sortedCoherence[0];

      // Keep ALL checks in historical (including latest) for trend display
      snapshot.coherence.historical = sortedCoherence;

      console.log(`[SDLC Snapshot Builder] Selected most recent coherence file as latest: overall=${snapshot.coherence.latest.overall}, eventTimestamp=${snapshot.coherence.latest.eventTimestamp}`);
    } else {
      // No valid coherence files found
      snapshot.coherence.historical = [];
      console.log('[SDLC Snapshot Builder] No valid coherence files found (all failed to parse)');
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[SDLC Snapshot Builder] Snapshot built in ${duration}ms - ${processedCount} files processed`);

  return snapshot;
}
