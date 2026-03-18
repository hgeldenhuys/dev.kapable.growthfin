/**
 * SDLC File Scanner Service
 * Scans .claude/sdlc directory and parses files
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { SDLCSnapshot } from '../types';
import { parseFileContent } from './file-parser';

// Find project root (go up from apps/api to project root)
const PROJECT_ROOT = resolve(process.cwd(), '../..');
const SDLC_ROOT = join(PROJECT_ROOT, '.claude/sdlc');

console.log('[SDLC Scanner] Project root:', PROJECT_ROOT);
console.log('[SDLC Scanner] SDLC root:', SDLC_ROOT);

/**
 * Recursively scan directory and collect files
 */
async function scanDirectory(dirPath: string): Promise<Array<{ path: string; content: any }>> {
  const files: Array<{ path: string; content: any }> = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Skip hidden files and temp files
        if (entry.name.startsWith('.') || entry.name.includes('~')) {
          continue;
        }

        try {
          const content = await readFile(fullPath, 'utf-8');
          const parsed = parseFileContent(fullPath, content);
          const relativePath = relative(SDLC_ROOT, fullPath);

          files.push({
            path: relativePath,
            content: parsed,
          });
        } catch (error) {
          console.error(`Error reading ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  return files;
}

/**
 * Categorize file based on path
 */
function categorizeFile(path: string): string {
  if (path.startsWith('stories/')) return 'stories';
  if (path.startsWith('epics/')) return 'epics';
  if (path.startsWith('kanban/')) return 'kanban';
  if (path.startsWith('knowledge/graph/')) return 'knowledgeGraph';
  if (path.startsWith('coherence/')) return 'coherence';
  // Coherence check reports can be in reports/ directory
  if (path.startsWith('reports/') && (path.includes('coherence') || path.includes('COHERENCE'))) return 'coherence';
  // Audits with coherence checks
  if (path.startsWith('audits/') && path.includes('coherence')) return 'coherence';
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
 * Scan entire SDLC directory and return categorized snapshot
 */
export async function scanSDLCDirectory(): Promise<SDLCSnapshot> {
  console.log('[SDLC Scanner] Starting full directory scan...');
  const startTime = Date.now();

  const allFiles = await scanDirectory(SDLC_ROOT);

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
      totalFiles: allFiles.length,
      categories: {},
    },
  };

  // Categorize and organize files
  for (const file of allFiles) {
    const category = categorizeFile(file.path);

    // Count by category
    snapshot.metadata.categories[category] = (snapshot.metadata.categories[category] || 0) + 1;

    // Organize into appropriate structure
    switch (category) {
      case 'stories': {
        const status = getStoryStatus(file.path);
        if (status && status in snapshot.stories) {
          snapshot.stories[status as keyof typeof snapshot.stories].push(file.content);
        }
        break;
      }

      case 'epics': {
        const status = getEpicStatus(file.path);
        if (status && status in snapshot.epics) {
          snapshot.epics[status as keyof typeof snapshot.epics].push(file.content);
        }
        break;
      }

      case 'kanban': {
        if (file.path.includes('board.json')) {
          snapshot.kanban.board = file.content;
        } else if (file.path.includes('wip-limits')) {
          snapshot.kanban.wipLimits = file.content;
        } else if (file.path.includes('board-history/')) {
          snapshot.kanban.boardHistory.push(file.content);
        }
        break;
      }

      case 'knowledgeGraph': {
        const entityType = getKnowledgeGraphType(file.path);
        if (entityType && entityType in snapshot.knowledgeGraph.entities) {
          snapshot.knowledgeGraph.entities[entityType as keyof typeof snapshot.knowledgeGraph.entities].push(file.content);
        } else if (file.path.includes('relations/')) {
          snapshot.knowledgeGraph.relations.push(file.content);
        }
        break;
      }

      case 'coherence': {
        if (file.path.includes('latest') || file.path.includes('COHERENCE-CHECK')) {
          snapshot.coherence.latest = file.content;
        } else {
          snapshot.coherence.historical.push(file.content);
        }
        break;
      }

      case 'retrospectives': {
        snapshot.retrospectives.push(file.content);
        break;
      }

      case 'backlog': {
        const backlogCategory = getBacklogCategory(file.path);
        if (backlogCategory && backlogCategory in snapshot.backlog) {
          snapshot.backlog[backlogCategory as keyof typeof snapshot.backlog].push(file.content);
        }
        break;
      }

      case 'prds': {
        snapshot.prds.push(file.content);
        break;
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[SDLC Scanner] Scan complete in ${duration}ms - ${allFiles.length} files processed`);

  return snapshot;
}

/**
 * Read a single file from SDLC directory
 */
export async function readSDLCFile(relativePath: string): Promise<any> {
  try {
    const fullPath = join(SDLC_ROOT, relativePath);
    const content = await readFile(fullPath, 'utf-8');
    return parseFileContent(fullPath, content);
  } catch (error) {
    console.error(`Error reading SDLC file ${relativePath}:`, error);
    throw error;
  }
}
