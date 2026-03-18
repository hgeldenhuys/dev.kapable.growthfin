import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-fetch',
  input: 'http://localhost:3000/swagger/json',
  output: {
    path: './src/generated',
    format: 'prettier',
    lint: 'eslint',
  },
  types: {
    enums: 'typescript',
  },
  services: {
    asClass: true,
  },
});
