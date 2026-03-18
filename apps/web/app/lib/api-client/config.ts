/**
 * API Client Configuration
 *
 * This file configures the HeyAPI client with base URL, headers, and interceptors.
 */

import { client } from './client.gen';

// Get API URL from environment or default to localhost
const API_URL = typeof window !== 'undefined'
  ? window.ENV?.API_URL || 'http://localhost:3000'
  : process.env.API_URL || 'http://localhost:3000';

// Configure the client with base URL and defaults
client.setConfig({
  baseUrl: API_URL,
});

// Export the configured client
export { client };

// Re-export all SDK functions for convenience
export * from './sdk.gen';
export type * from './types.gen';
