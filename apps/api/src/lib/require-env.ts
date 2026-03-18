/**
 * Require an environment variable to be set.
 * Throws immediately at startup if missing, preventing silent fallback to dev credentials.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required environment variable ${name} is not set. ` +
      `Set it in your .env file or /etc/signaldb/*.env on production.`
    );
  }
  return value;
}
