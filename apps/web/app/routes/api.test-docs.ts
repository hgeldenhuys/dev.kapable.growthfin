/**
 * Test docs loader API endpoint
 */

import { getAllFeatures } from '~/lib/docs-loader';

export async function loader() {
  const fs = await import('fs');
  const path = await import('path');
  const yaml = await import('js-yaml');

  const docsPath = '/Users/hgeldenhuys/WebstormProjects/agios/.claude/sdlc/docs/features';

  try {
    // Test single file load
    let singleLoadError: any = null;
    let singleFeature: any = null;
    try {
      const filePath = path.join(docsPath, 'workspaces.yaml');
      const fileContents = fs.readFileSync(filePath, 'utf8');
      singleFeature = yaml.load(fileContents);
    } catch (err: any) {
      singleLoadError = {
        message: err.message,
        stack: err.stack,
      };
    }

    // Try getAllFeatures
    const features = getAllFeatures();

    return Response.json({
      success: true,
      docsPath,
      featuresCount: features.length,
      singleLoadError,
      singleFeatureId: singleFeature?.feature?.id || null,
      singleFeatureName: singleFeature?.feature?.name || null,
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
