/**
 * Build Script for Hooks SDK
 * Creates a distributable bundle that can be downloaded and used without npm
 */

import { build } from 'bun';
import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const distDir = join(import.meta.dir, 'dist');
const bundleDir = join(distDir, 'bundle');

// Clean dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir, { recursive: true });
mkdirSync(bundleDir, { recursive: true });

console.log('🔨 Building hooks SDK...\n');

// Build the main bundle
console.log('📦 Bundling source files...');
await build({
  entrypoints: ['./src/index.ts'],
  outdir: bundleDir,
  target: 'bun',
  format: 'esm',
  splitting: false,
  minify: false,
  sourcemap: 'external',
});

console.log('✅ Bundle created\n');

// Copy package.json
console.log('📄 Creating package.json...');
const packageJson = JSON.parse(readFileSync(join(import.meta.dir, 'package.json'), 'utf-8'));

// Create a simplified package.json for distribution
const distPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  main: './index.js',
  types: './index.d.ts',
  type: 'module',
  keywords: packageJson.keywords,
  license: packageJson.license,
};

writeFileSync(
  join(bundleDir, 'package.json'),
  JSON.stringify(distPackageJson, null, 2)
);

console.log('✅ package.json created\n');

// Copy README
console.log('📄 Copying README...');
const readmePath = join(import.meta.dir, 'README.md');
if (existsSync(readmePath)) {
  cpSync(readmePath, join(bundleDir, 'README.md'));
  console.log('✅ README copied\n');
}

// Copy types
console.log('📄 Copying type definitions...');
cpSync(join(import.meta.dir, 'src'), join(bundleDir, 'types'), {
  recursive: true,
  filter: (src) => src.endsWith('.ts') && !src.endsWith('.test.ts'),
});

// Create index.d.ts that re-exports everything
const dtsContent = `export * from './types/index';`;
writeFileSync(join(bundleDir, 'index.d.ts'), dtsContent);

console.log('✅ Type definitions copied\n');

// Create installation instructions
const installInstructions = `# @agios/hooks-sdk

Type-safe TypeScript SDK for Claude Code hooks.

## Installation

This package is distributed directly via the Agios CLI:

\`\`\`bash
agios hooks install
\`\`\`

## Usage

\`\`\`typescript
import { HookManager, success, block } from '@agios/hooks-sdk';

const manager = new HookManager({
  projectId: 'your-project-id',
  apiUrl: 'https://api.agios.dev',
});

manager.onPreToolUse(async (input, context) => {
  if (input.tool_name === 'Bash' && input.tool_input.command.includes('rm -rf')) {
    return block('Dangerous command detected!');
  }
  return success();
});

manager.run();
\`\`\`

## Documentation

Full documentation: https://docs.agios.dev/hooks-sdk
`;

writeFileSync(join(bundleDir, 'INSTALL.md'), installInstructions);

console.log('✅ Installation instructions created\n');

// Create a tarball
console.log('📦 Creating tarball...');
const { execSync } = await import('child_process');
const tarballName = 'hooks-sdk.tgz';

try {
  execSync(`tar -czf ${tarballName} -C ${bundleDir} .`, {
    cwd: distDir,
  });
  console.log(`✅ Tarball created: dist/${tarballName}\n`);
} catch (error) {
  console.error('❌ Failed to create tarball:', error);
}

console.log('🎉 Build complete!\n');
console.log(`Distribution bundle: ${bundleDir}`);
console.log(`Tarball: ${join(distDir, tarballName)}`);
