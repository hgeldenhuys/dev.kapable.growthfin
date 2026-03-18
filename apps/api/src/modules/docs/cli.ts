#!/usr/bin/env bun

/**
 * Documentation Generation CLI
 * Generates MDX docs and slides from YAML feature files
 */

import { DocumentationGenerator } from './generator';

async function main() {
  const command = process.argv[2] || 'generate';

  switch (command) {
    case 'generate':
    case 'build': {
      console.log('📚 Generating documentation...\n');
      const generator = new DocumentationGenerator();
      await generator.initialize();
      const result = await generator.generateAll();

      console.log('\n✅ Documentation generated successfully!');
      console.log(`   Features processed: ${result.featuresProcessed}`);
      console.log(`   Outputs: ${result.outputs.join(', ')}`);
      break;
    }

    case 'help':
    default:
      console.log(`
Documentation Generator CLI

Usage:
  bun run docs:generate [command]

Commands:
  generate    Generate MDX documentation and slides (default)
  build       Alias for generate
  help        Show this help message

Files generated:
  - .claude/sdlc/docs/generated/mdx/*.mdx       (Feature documentation)
  - .claude/sdlc/docs/generated/slides/*.html   (Presentation slides)
  - .claude/sdlc/docs/generated/scripts/*.json  (Demo scripts)
  - .claude/sdlc/docs/generated/index.json      (Navigation index)
      `);
      break;
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
