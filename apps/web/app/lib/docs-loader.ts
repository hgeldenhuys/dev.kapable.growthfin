/**
 * Documentation Loader
 * Loads and parses feature documentation from YAML files
 */

import yaml from 'js-yaml';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface FeatureMetadata {
  id: string;
  name: string;
  icon: string;
  order: number;
  category: string;
  status: 'stable' | 'beta' | 'planned' | 'deprecated' | 'development';
}

export interface BusinessValueMetric {
  metric: string;
  impact: string;
  explanation: string;
}

export interface TargetUser {
  role: string;
  useCase: string;
}

export interface FeatureOverview {
  headline: string;
  description: string;
  businessValue: BusinessValueMetric[];
  targetUsers: TargetUser[];
}

export interface WorkflowStep {
  action: string;
  expectedResult: string;
  screenshot?: string;
}

export interface TalkingPoint {
  point: string;
  emphasis: 'key' | 'supporting' | 'optional';
}

export interface TechnicalDetails {
  api: string;
  realtime: boolean;
  permissions: string[];
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  workflow: {
    steps: WorkflowStep[];
  };
  demoTalkingPoints: TalkingPoint[];
  technicalDetails: TechnicalDetails;
}

export interface Integration {
  feature: string;
  touchpoint: string;
  dataFlow: string;
}

export interface FAQ {
  question: string;
  answer: string;
  category: string;
  relatedWorkflow: string | null;
}

export interface Metrics {
  documentation: {
    completeness: number;
    lastReviewed: string;
    missingElements: string[];
  };
  demo: {
    rehearsals: number;
    averageTime: number;
    feedbackScore: number;
  };
}

export interface FeatureDocumentation {
  type: string;
  version: string;
  feature: FeatureMetadata;
  metadata: {
    lastUpdated: string;
    owners: string[];
    relatedFeatures: string[];
    dependencies: string[];
    estimatedDemoTime: number;
  };
  overview: FeatureOverview;
  capabilities: Capability[];
  integrations: Integration[];
  faq: FAQ[];
  metrics: Metrics;
}

// Resolve path - find project root and build path to docs
// Uses process.cwd() which works in both dev and production
function resolveDocsPath(): string {
  const cwd = process.cwd();
  // If running from apps/web, go up to project root
  if (cwd.includes('/apps/web')) {
    return join(cwd.replace(/\/apps\/web.*$/, ''), '.claude/sdlc/docs/features');
  }
  // If running from project root
  return join(cwd, '.claude/sdlc/docs/features');
}

const DOCS_PATH = resolveDocsPath();

console.log('[docs-loader] DOCS_PATH:', DOCS_PATH);

/**
 * Load all available feature documentation files
 */
export function getAllFeatures(): FeatureDocumentation[] {
  const features: FeatureDocumentation[] = [];

  console.log('[getAllFeatures] DOCS_PATH:', DOCS_PATH);

  try {
    const files = readdirSync(DOCS_PATH);
    console.log('[getAllFeatures] Files found:', files.length);

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const featureId = file.replace(/\.(yaml|yml)$/, '');
        console.log('[getAllFeatures] Loading feature:', featureId);
        try {
          const doc = loadFeatureDoc(featureId);
          if (doc) {
            features.push(doc);
            console.log('[getAllFeatures] Loaded:', featureId);
          }
        } catch (error) {
          console.error(`Error loading feature ${featureId}:`, error);
        }
      }
    }

    // Sort by order field
    features.sort((a, b) => (a.feature.order || 999) - (b.feature.order || 999));

    console.log('[getAllFeatures] Total features loaded:', features.length);
    return features;
  } catch (error) {
    console.error('Error reading features directory:', error);
    console.error('DOCS_PATH was:', DOCS_PATH);
    return [];
  }
}

/**
 * Load a specific feature documentation file
 */
export function loadFeatureDoc(featureId: string): FeatureDocumentation | null {
  try {
    const filePath = join(DOCS_PATH, `${featureId}.yaml`);
    const fileContents = readFileSync(filePath, 'utf8');
    const doc = yaml.load(fileContents) as FeatureDocumentation;
    return doc;
  } catch (error) {
    console.error(`Error loading feature ${featureId}:`, error);
    return null;
  }
}

/**
 * Get feature summary for cards
 */
export interface FeatureSummary {
  id: string;
  title: string;
  category: string;
  status: FeatureMetadata['status'];
  completeness: number;
  businessValue: string;
  technicalSummary?: string;
  featureCount: number;
}

export function getFeatureSummary(doc: FeatureDocumentation): FeatureSummary {
  return {
    id: doc.feature.id,
    title: doc.feature.name,
    category: doc.feature.category,
    status: doc.feature.status,
    completeness: doc.metrics?.documentation?.completeness ?? 50,
    businessValue: doc.overview?.headline ?? doc.feature.name,
    technicalSummary: doc.overview?.description,
    featureCount: doc.capabilities?.length ?? 0,
  };
}

/**
 * Extract headings from documentation for table of contents
 */
export interface Heading {
  id: string;
  text: string;
  level: number;
}

export function extractHeadings(doc: FeatureDocumentation): Heading[] {
  const headings: Heading[] = [];

  // Add main sections as h2
  headings.push(
    { id: 'overview', text: 'Overview', level: 2 },
    { id: 'business-value', text: 'Business Value', level: 2 },
    { id: 'capabilities', text: 'Capabilities', level: 2 }
  );

  // Add capabilities as h3
  for (const capability of doc.capabilities) {
    const id = `capability-${capability.id}`;
    headings.push({
      id,
      text: capability.name,
      level: 3,
    });
  }

  // Add other sections
  headings.push(
    { id: 'integrations', text: 'Integrations', level: 2 },
    { id: 'faq', text: 'Frequently Asked Questions', level: 2 }
  );

  return headings;
}

// =====================================
// MARKDOWN PRODUCT DOCUMENTATION
// =====================================

function resolveProductDocsPath(): string {
  const cwd = process.cwd();
  // If running from apps/web, go up to project root
  if (cwd.includes('/apps/web')) {
    return join(cwd.replace(/\/apps\/web.*$/, ''), 'docs/product');
  }
  // If running from project root
  return join(cwd, 'docs/product');
}

const PRODUCT_DOCS_PATH = resolveProductDocsPath();

console.log('[docs-loader] PRODUCT_DOCS_PATH:', PRODUCT_DOCS_PATH);

export interface ProductDocFrontmatter {
  title: string;
  description: string;
  category: string;
  priority: number;
  routes?: string[];
  last_updated: string;
}

export interface ProductDoc {
  frontmatter: ProductDocFrontmatter;
  content: string;
  headings: Heading[];
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter: ProductDocFrontmatter; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      frontmatter: {
        title: 'Untitled',
        description: '',
        category: 'General',
        priority: 50,
        last_updated: new Date().toISOString().split('T')[0],
      },
      content,
    };
  }

  const frontmatter = yaml.load(match[1]) as ProductDocFrontmatter;
  return { frontmatter, content: match[2] };
}

/**
 * Extract headings from markdown content for table of contents
 */
export function extractMarkdownHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    // Create slug from heading text
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    headings.push({ id, text, level });
  }

  return headings;
}

/**
 * Load a markdown product doc by category and docId
 */
export function loadProductDoc(category: string, docId: string): ProductDoc | null {
  try {
    const filePath = join(PRODUCT_DOCS_PATH, category, `${docId}.md`);
    const fileContents = readFileSync(filePath, 'utf8');
    const { frontmatter, content } = parseFrontmatter(fileContents);
    const headings = extractMarkdownHeadings(content);

    return { frontmatter, content, headings };
  } catch (error) {
    console.error(`Error loading product doc ${category}/${docId}:`, error);
    return null;
  }
}

export interface ProductDocSummary {
  category: string;
  docId: string;
  title: string;
  description: string;
  priority: number;
}

/**
 * List all product docs in a category
 */
export function listProductDocsInCategory(category: string): ProductDocSummary[] {
  const docs: ProductDocSummary[] = [];
  const categoryPath = join(PRODUCT_DOCS_PATH, category);

  try {
    const files = readdirSync(categoryPath);

    for (const file of files) {
      if (file.endsWith('.md') && file !== 'README.md' && file !== 'index.md') {
        const docId = file.replace('.md', '');
        const doc = loadProductDoc(category, docId);

        if (doc) {
          docs.push({
            category,
            docId,
            title: doc.frontmatter.title,
            description: doc.frontmatter.description,
            priority: doc.frontmatter.priority,
          });
        }
      }
    }

    // Sort by priority (higher first)
    docs.sort((a, b) => b.priority - a.priority);

    return docs;
  } catch (error) {
    console.error(`Error listing docs in category ${category}:`, error);
    return [];
  }
}

/**
 * List all product doc categories
 */
export function listProductDocCategories(): string[] {
  try {
    const entries = readdirSync(PRODUCT_DOCS_PATH, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    console.error('Error listing product doc categories:', error);
    return [];
  }
}

/**
 * Get all product docs across all categories
 */
export function getAllProductDocs(): ProductDocSummary[] {
  const categories = listProductDocCategories();
  const allDocs: ProductDocSummary[] = [];

  for (const category of categories) {
    const docs = listProductDocsInCategory(category);
    allDocs.push(...docs);
  }

  // Sort by priority (higher first)
  allDocs.sort((a, b) => b.priority - a.priority);

  return allDocs;
}
