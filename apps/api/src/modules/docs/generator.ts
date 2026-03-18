/**
 * Documentation Generator Pipeline
 * Transforms YAML metadata into MDX docs and slides
 */

import { join } from 'path';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { parse } from 'yaml';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import type { FeatureDocumentation } from './types';

const DOCS_BASE = join(process.cwd(), '.claude/sdlc/docs');

export class DocumentationGenerator {
  private mdxTemplate!: HandlebarsTemplateDelegate;
  private slideTemplate!: HandlebarsTemplateDelegate;

  async initialize() {
    // Register helpers first
    this.registerHelpers();

    // Load templates
    const mdxTemplateSrc = await readFile(
      join(DOCS_BASE, 'templates/feature.mdx.hbs'),
      'utf-8'
    );
    const slideTemplateSrc = await readFile(
      join(DOCS_BASE, 'templates/slides.html.hbs'),
      'utf-8'
    );

    this.mdxTemplate = Handlebars.compile(mdxTemplateSrc);
    this.slideTemplate = Handlebars.compile(slideTemplateSrc);
  }

  private registerHelpers() {
    // Format markdown in YAML strings
    Handlebars.registerHelper('markdown', (text: string) => {
      return new Handlebars.SafeString(marked(text) as string);
    });

    // Equality check
    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // Add numbers (for array indexing)
    Handlebars.registerHelper('add', (a: number, b: number) => {
      return a + b;
    });

    // Lookup helper (for accessing array elements)
    Handlebars.registerHelper('lookup', (arr: any[], index: number, path: string) => {
      if (!arr || !arr[index]) return '';
      return path.split('.').reduce((obj, key) => obj?.[key], arr[index]);
    });

    // Generate component imports
    Handlebars.registerHelper('imports', (capabilities: any[]) => {
      const components = new Set<string>();
      for (const cap of capabilities) {
        if (cap.workflow?.interactive) {
          components.add('InteractiveDemo');
        }
        if (cap.technicalDetails?.realtime) {
          components.add('RealtimeIndicator');
        }
      }
      return Array.from(components)
        .map(c => `import { ${c} } from '@/components/docs/${c}'`)
        .join('\n');
    });

    // Generate demo timing
    Handlebars.registerHelper('timing', (minutes: number) => {
      const m = Math.floor(minutes);
      const s = Math.round((minutes - m) * 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    });
  }

  async generateAll() {
    // Ensure output directories
    await mkdir(join(DOCS_BASE, 'generated/mdx'), { recursive: true });
    await mkdir(join(DOCS_BASE, 'generated/slides'), { recursive: true });
    await mkdir(join(DOCS_BASE, 'generated/scripts'), { recursive: true });

    // Load all feature docs
    const features = await this.loadFeatures();

    // Generate MDX documentation
    for (const feature of features) {
      await this.generateMDX(feature);
    }

    // Generate slide deck
    await this.generateSlides(features);

    // Generate demo scripts
    await this.generateDemoScripts(features);

    // Generate index and navigation
    await this.generateIndex(features);

    return {
      featuresProcessed: features.length,
      outputs: ['mdx', 'slides', 'scripts']
    };
  }

  private async loadFeatures(): Promise<FeatureDocumentation[]> {
    const featuresDir = join(DOCS_BASE, 'features');
    const files = await readdir(featuresDir);
    const features: FeatureDocumentation[] = [];

    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const content = await readFile(join(featuresDir, file), 'utf-8');
        const doc = parse(content) as FeatureDocumentation;
        features.push(doc);
      }
    }

    // Sort by order
    return features.sort((a, b) => a.feature.order - b.feature.order);
  }

  private async generateMDX(feature: FeatureDocumentation) {
    const mdx = this.mdxTemplate({
      ...feature,
      generatedAt: new Date().toISOString(),
      helpers: {
        formatDate: (d: Date) => d.toLocaleDateString(),
        capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
      }
    });

    const outputPath = join(
      DOCS_BASE,
      'generated/mdx',
      `${feature.feature.id}.mdx`
    );

    await writeFile(outputPath, mdx, 'utf-8');
  }

  private async generateSlides(features: FeatureDocumentation[]) {
    const slides = this.slideTemplate({
      features,
      title: 'NewLeads CRM Platform',
      totalTime: features.reduce((sum, f) =>
        sum + f.metadata.estimatedDemoTime, 0
      )
    });

    await writeFile(
      join(DOCS_BASE, 'generated/slides/presentation.html'),
      slides,
      'utf-8'
    );
  }

  private async generateDemoScripts(features: FeatureDocumentation[]) {
    // Generate a comprehensive demo script
    const script = features.map(f => ({
      feature: f.feature.name,
      timing: f.metadata.estimatedDemoTime,
      script: f.demoScript,
      keyPoints: f.capabilities.flatMap(c =>
        c.demoTalkingPoints.filter(p => p.emphasis === 'key')
      )
    }));

    await writeFile(
      join(DOCS_BASE, 'generated/scripts/demo-script.json'),
      JSON.stringify(script, null, 2),
      'utf-8'
    );
  }

  private async generateIndex(features: FeatureDocumentation[]) {
    const index = {
      features: features.map(f => ({
        id: f.feature.id,
        name: f.feature.name,
        path: `/docs/features/${f.feature.id}`,
        category: f.feature.category,
        status: f.feature.status
      })),
      categories: this.groupByCategory(features),
      totalDemoTime: features.reduce((sum, f) =>
        sum + f.metadata.estimatedDemoTime, 0
      ),
      lastGenerated: new Date().toISOString()
    };

    await writeFile(
      join(DOCS_BASE, 'generated/index.json'),
      JSON.stringify(index, null, 2),
      'utf-8'
    );
  }

  private groupByCategory(features: FeatureDocumentation[]) {
    const grouped: Record<string, string[]> = {};

    for (const feature of features) {
      const category = feature.feature.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(feature.feature.id);
    }

    return grouped;
  }
}

// Build script integration
export async function buildDocs() {
  const generator = new DocumentationGenerator();
  await generator.initialize();
  const result = await generator.generateAll();

  console.log('✅ Documentation generated:', result);
  return result;
}