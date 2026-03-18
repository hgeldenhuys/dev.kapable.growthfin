/**
 * Download Routes
 * Endpoints for downloading SDK bundles and assets
 */

import { Elysia } from 'elysia';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const downloadRoutes = new Elysia({ prefix: '/download' })
  /**
   * HEAD /download/hooks-sdk.tgz
   * Get metadata for the hooks SDK tarball
   */
  .head('/hooks-sdk.tgz', async ({ set }) => {
    const tarballPath = join(
      process.cwd(),
      '..',
      '..',
      'packages',
      'hooks-sdk',
      'dist',
      'hooks-sdk.tgz'
    );

    if (!existsSync(tarballPath)) {
      set.status = 404;
      return;
    }

    const file = Bun.file(tarballPath);
    const size = file.size;

    set.headers['Content-Type'] = 'application/gzip';
    set.headers['Content-Disposition'] = 'attachment; filename="hooks-sdk.tgz"';
    set.headers['Content-Length'] = size.toString();

    return new Response(null, { status: 200 });
  })

  /**
   * GET /download/hooks-sdk.tgz
   * Download the hooks SDK tarball
   */
  .get('/hooks-sdk.tgz', async ({ set }) => {
    const tarballPath = join(
      process.cwd(),
      '..',
      '..',
      'packages',
      'hooks-sdk',
      'dist',
      'hooks-sdk.tgz'
    );

    if (!existsSync(tarballPath)) {
      set.status = 404;
      return { error: 'Hooks SDK bundle not found. Please build it first.' };
    }

    // Use Bun.file() for better handling
    const file = Bun.file(tarballPath);

    set.headers['Content-Type'] = 'application/gzip';
    set.headers['Content-Disposition'] = 'attachment; filename="hooks-sdk.tgz"';

    return file;
  })

  /**
   * GET /download/hooks-sdk/version
   * Get the current hooks SDK version
   */
  .get('/hooks-sdk/version', async ({ set }) => {
    const packageJsonPath = join(
      process.cwd(),
      '..',
      '..',
      'packages',
      'hooks-sdk',
      'package.json'
    );

    if (!existsSync(packageJsonPath)) {
      set.status = 404;
      return { error: 'Package information not found' };
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    return {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
    };
  });
