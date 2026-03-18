/**
 * SignalDB Config-as-Code — signaldb.yaml parser, validator, and resolver
 *
 * Supports two modes:
 *   - Single-app (app: ...) — for bring-your-own-repo
 *   - Multi-app monorepo (apps: ...) — for org-level repos with template apps
 *
 * Config precedence:
 *   Explicit deploy request fields > signaldb.yaml > FRAMEWORK_CONFIGS defaults
 */

import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Framework = 'bun-server' | 'hono' | 'react-router' | 'nextjs' | 'sveltekit';

const VALID_FRAMEWORKS: ReadonlySet<string> = new Set([
  'bun-server', 'hono', 'react-router', 'nextjs', 'sveltekit',
]);

const VALID_ENV_NAMES: ReadonlySet<string> = new Set([
  'production', 'dev', 'staging', 'preview', 'test', 'qa',
]);

const ALLOWED_EXECUTABLES: ReadonlySet<string> = new Set([
  'bun', 'npm', 'npx', 'node', 'react-router', 'next', 'vite', 'tsc', 'svelte-kit',
]);

const KNOWN_CAPABILITIES: ReadonlySet<string> = new Set([
  'email', 'storage', 'images', 'flags', 'database', 'auth', 'sse', 'cache', 'queue',
]);

export interface FrontendBuildConfig {
  dir: string;
  install?: string[];
  command?: string[];
}

export interface BuildConfig {
  install?: string[];
  command?: string[];
  entry_point?: string;
  frontend?: FrontendBuildConfig;
}

export interface HealthConfig {
  path?: string;
  timeout?: number;
  interval?: number;
}

export interface EnvironmentConfig {
  branch: string;
}

export interface DependencyConfig {
  app: string;      // target app slug
  alias: string;    // becomes SIGNALDB_SVC_{ALIAS}_URL
  env?: string;     // target environment (default: same name, fallback production)
  required?: boolean; // default true
}

export interface ScheduleActionConfig {
  type?: 'webhook' | 'bash';
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  command?: string;
}

export interface ScheduleConfig {
  cron: string;
  action: ScheduleActionConfig;
  timeout?: number;
  retries?: number;
}

export interface AuthRoleConfig {
  permissions: string[];
  description?: string;
}

export interface AuthConfig {
  roles?: Record<string, AuthRoleConfig>;
}

export type CapabilityConfig = boolean | Record<string, unknown>;

export interface AppConfig {
  dir?: string;               // Required in monorepo mode
  framework: Framework;
  build?: BuildConfig;
  health?: HealthConfig;
  environments?: Record<string, EnvironmentConfig>;
  dependencies?: DependencyConfig[];
  schedules?: Record<string, ScheduleConfig>;
  // Auth roles config (synced to auth_configs.role_definitions on deploy)
  // Set to `false` to disable auth gate entirely (public apps, marketing sites)
  auth?: AuthConfig | false;
  // Informational only (Console is authoritative)
  database?: unknown;
  // Declared platform capabilities (email, storage, images, flags, database, auth, sse)
  capabilities?: Record<string, CapabilityConfig>;
}

export interface SignalDBConfigV1 {
  version: 1;
  app?: AppConfig;
  apps?: Record<string, AppConfig>;
}

export interface ResolvedAppConfig {
  framework: Framework;
  installCmd: string[];
  buildCmd: string[];
  entryPoint: string;
  frontendDir?: string;
  frontendInstallCmd?: string[];
  frontendBuildCmd?: string[];
  healthPath: string;
  healthTimeout: number;
  healthInterval: number;
  environments: Record<string, EnvironmentConfig>;
  dependencies: DependencyConfig[];
}

// ---------------------------------------------------------------------------
// Framework defaults
// ---------------------------------------------------------------------------

const FRAMEWORK_DEFAULTS: Record<Framework, {
  buildCmd: string[];
  entryPoint: string;
}> = {
  'bun-server': {
    buildCmd: ['bun', 'build', 'src/index.ts', '--outdir', 'dist', '--target', 'bun'],
    entryPoint: 'dist/index.js',
  },
  'hono': {
    buildCmd: ['bun', 'run', 'build'],
    entryPoint: 'dist/index.js',
  },
  'react-router': {
    buildCmd: ['bun', 'run', 'build'],
    entryPoint: 'build/server/index.js',
  },
  'nextjs': {
    buildCmd: ['bun', 'run', 'build'],
    entryPoint: '.next/standalone/server.js',
  },
  'sveltekit': {
    buildCmd: ['bun', 'run', 'build'],
    entryPoint: 'build/index.js',
  },
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

class ConfigValidationError extends Error {
  constructor(message: string) {
    super(`signaldb.yaml: ${message}`);
    this.name = 'ConfigValidationError';
  }
}

function validateCommandArray(arr: unknown, fieldName: string): string[] {
  if (!Array.isArray(arr)) {
    throw new ConfigValidationError(`${fieldName} must be an array`);
  }
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'string') {
      throw new ConfigValidationError(`${fieldName}[${i}] must be a string`);
    }
  }
  const cmd = arr as string[];
  if (cmd.length === 0) {
    throw new ConfigValidationError(`${fieldName} must not be empty`);
  }
  // Validate first element is an allowed executable
  if (!ALLOWED_EXECUTABLES.has(cmd[0])) {
    throw new ConfigValidationError(
      `${fieldName}[0] "${cmd[0]}" is not an allowed executable. ` +
      `Allowed: ${[...ALLOWED_EXECUTABLES].join(', ')}`
    );
  }
  return cmd;
}

function validateDependencies(deps: unknown, path: string): DependencyConfig[] {
  if (!Array.isArray(deps)) {
    throw new ConfigValidationError(`${path} must be an array`);
  }
  const ALIAS_RE = /^[A-Z][A-Z0-9_]{0,49}$/;
  const seen = new Set<string>();
  const result: DependencyConfig[] = [];

  for (let i = 0; i < deps.length; i++) {
    const dep = deps[i];
    if (!dep || typeof dep !== 'object') {
      throw new ConfigValidationError(`${path}[${i}] must be an object`);
    }
    const d = dep as Record<string, unknown>;
    if (!d.app || typeof d.app !== 'string') {
      throw new ConfigValidationError(`${path}[${i}].app is required`);
    }
    if (!d.alias || typeof d.alias !== 'string') {
      throw new ConfigValidationError(`${path}[${i}].alias is required`);
    }
    if (!ALIAS_RE.test(d.alias)) {
      throw new ConfigValidationError(
        `${path}[${i}].alias "${d.alias}" must match ${ALIAS_RE.source}`
      );
    }
    if (seen.has(d.alias)) {
      throw new ConfigValidationError(`${path}[${i}].alias "${d.alias}" is duplicated`);
    }
    seen.add(d.alias);

    const entry: DependencyConfig = { app: d.app, alias: d.alias };
    if (d.env !== undefined) {
      if (typeof d.env !== 'string') {
        throw new ConfigValidationError(`${path}[${i}].env must be a string`);
      }
      entry.env = d.env;
    }
    if (d.required !== undefined) {
      if (typeof d.required !== 'boolean') {
        throw new ConfigValidationError(`${path}[${i}].required must be a boolean`);
      }
      entry.required = d.required;
    }
    result.push(entry);
  }
  return result;
}

function validateAppConfig(config: unknown, path: string, requireDir: boolean): AppConfig {
  if (!config || typeof config !== 'object') {
    throw new ConfigValidationError(`${path} must be an object`);
  }
  const obj = config as Record<string, unknown>;

  // framework (required)
  if (!obj.framework || typeof obj.framework !== 'string') {
    throw new ConfigValidationError(`${path}.framework is required and must be a string`);
  }
  if (!VALID_FRAMEWORKS.has(obj.framework)) {
    throw new ConfigValidationError(
      `${path}.framework "${obj.framework}" is invalid. ` +
      `Valid: ${[...VALID_FRAMEWORKS].join(', ')}`
    );
  }

  // dir (required in monorepo mode)
  if (requireDir && (!obj.dir || typeof obj.dir !== 'string')) {
    throw new ConfigValidationError(`${path}.dir is required in multi-app (apps) mode`);
  }
  if (obj.dir !== undefined && typeof obj.dir !== 'string') {
    throw new ConfigValidationError(`${path}.dir must be a string`);
  }

  // build
  const build: BuildConfig = {};
  if (obj.build !== undefined) {
    if (typeof obj.build !== 'object' || obj.build === null) {
      throw new ConfigValidationError(`${path}.build must be an object`);
    }
    const b = obj.build as Record<string, unknown>;
    if (b.install !== undefined) {
      build.install = validateCommandArray(b.install, `${path}.build.install`);
    }
    if (b.command !== undefined) {
      build.command = validateCommandArray(b.command, `${path}.build.command`);
    }
    if (b.entry_point !== undefined) {
      if (typeof b.entry_point !== 'string') {
        throw new ConfigValidationError(`${path}.build.entry_point must be a string`);
      }
      build.entry_point = b.entry_point;
    }
    if (b.frontend !== undefined) {
      if (typeof b.frontend !== 'object' || b.frontend === null) {
        throw new ConfigValidationError(`${path}.build.frontend must be an object`);
      }
      const f = b.frontend as Record<string, unknown>;
      if (!f.dir || typeof f.dir !== 'string') {
        throw new ConfigValidationError(`${path}.build.frontend.dir is required`);
      }
      const frontend: FrontendBuildConfig = { dir: f.dir };
      if (f.install !== undefined) {
        frontend.install = validateCommandArray(f.install, `${path}.build.frontend.install`);
      }
      if (f.command !== undefined) {
        frontend.command = validateCommandArray(f.command, `${path}.build.frontend.command`);
      }
      build.frontend = frontend;
    }
  }

  // health
  const health: HealthConfig = {};
  if (obj.health !== undefined) {
    if (typeof obj.health !== 'object' || obj.health === null) {
      throw new ConfigValidationError(`${path}.health must be an object`);
    }
    const h = obj.health as Record<string, unknown>;
    if (h.path !== undefined) {
      if (typeof h.path !== 'string') {
        throw new ConfigValidationError(`${path}.health.path must be a string`);
      }
      health.path = h.path;
    }
    if (h.timeout !== undefined) {
      if (typeof h.timeout !== 'number' || h.timeout <= 0) {
        throw new ConfigValidationError(`${path}.health.timeout must be a positive number`);
      }
      health.timeout = h.timeout;
    }
    if (h.interval !== undefined) {
      if (typeof h.interval !== 'number' || h.interval <= 0) {
        throw new ConfigValidationError(`${path}.health.interval must be a positive number`);
      }
      health.interval = h.interval;
    }
  }

  // environments
  const environments: Record<string, EnvironmentConfig> = {};
  if (obj.environments !== undefined) {
    if (typeof obj.environments !== 'object' || obj.environments === null) {
      throw new ConfigValidationError(`${path}.environments must be an object`);
    }
    const envs = obj.environments as Record<string, unknown>;
    for (const [envName, envConfig] of Object.entries(envs)) {
      if (!VALID_ENV_NAMES.has(envName)) {
        throw new ConfigValidationError(
          `${path}.environments.${envName} is not a valid environment name. ` +
          `Valid: ${[...VALID_ENV_NAMES].join(', ')}`
        );
      }
      if (typeof envConfig !== 'object' || envConfig === null) {
        throw new ConfigValidationError(`${path}.environments.${envName} must be an object`);
      }
      const ec = envConfig as Record<string, unknown>;
      if (!ec.branch || typeof ec.branch !== 'string') {
        throw new ConfigValidationError(`${path}.environments.${envName}.branch is required`);
      }
      environments[envName] = { branch: ec.branch };
    }
  }

  // dependencies
  let dependencies: DependencyConfig[] | undefined;
  if (obj.dependencies !== undefined) {
    dependencies = validateDependencies(obj.dependencies, `${path}.dependencies`);
  }

  // schedules
  let schedules: Record<string, ScheduleConfig> | undefined;
  if (obj.schedules !== undefined) {
    if (typeof obj.schedules !== 'object' || obj.schedules === null) {
      throw new ConfigValidationError(`${path}.schedules must be an object`);
    }
    schedules = {};
    const scheds = obj.schedules as Record<string, unknown>;
    for (const [name, schedConfig] of Object.entries(scheds)) {
      if (typeof schedConfig !== 'object' || schedConfig === null) {
        throw new ConfigValidationError(`${path}.schedules.${name} must be an object`);
      }
      const sc = schedConfig as Record<string, unknown>;
      if (!sc.cron || typeof sc.cron !== 'string') {
        throw new ConfigValidationError(`${path}.schedules.${name}.cron is required`);
      }
      if (!sc.action || typeof sc.action !== 'object') {
        throw new ConfigValidationError(`${path}.schedules.${name}.action is required`);
      }
      const action = sc.action as Record<string, unknown>;
      const actionType = (action.type as string) || 'webhook';
      if (!['webhook', 'bash'].includes(actionType)) {
        throw new ConfigValidationError(`${path}.schedules.${name}.action.type must be "webhook" or "bash"`);
      }
      if (actionType === 'webhook' && !action.url) {
        throw new ConfigValidationError(`${path}.schedules.${name}.action.url is required for webhook actions`);
      }
      if (actionType === 'bash' && !action.command) {
        throw new ConfigValidationError(`${path}.schedules.${name}.action.command is required for bash actions`);
      }
      schedules[name] = {
        cron: sc.cron,
        action: {
          type: actionType as 'webhook' | 'bash',
          url: action.url as string | undefined,
          method: action.method as string | undefined,
          headers: action.headers as Record<string, string> | undefined,
          body: action.body as string | undefined,
          command: action.command as string | undefined,
        },
        timeout: typeof sc.timeout === 'number' ? sc.timeout : undefined,
        retries: typeof sc.retries === 'number' ? sc.retries : undefined,
      };
    }
  }

  // auth — either `false` (opt-out) or object with roles
  let auth: AuthConfig | false | undefined;
  if (obj.auth !== undefined) {
    if (obj.auth === false) {
      // Explicit opt-out: auth: false disables auth gate entirely
      auth = false;
    } else if (typeof obj.auth !== 'object' || obj.auth === null) {
      throw new ConfigValidationError(`${path}.auth must be an object or false`);
    } else {
      const authObj = obj.auth as Record<string, unknown>;
      if (authObj.roles !== undefined) {
        if (typeof authObj.roles !== 'object' || authObj.roles === null) {
          throw new ConfigValidationError(`${path}.auth.roles must be an object`);
        }
        const roles: Record<string, AuthRoleConfig> = {};
        const rolesObj = authObj.roles as Record<string, unknown>;
        for (const [roleName, roleDef] of Object.entries(rolesObj)) {
          if (typeof roleDef !== 'object' || roleDef === null) {
            throw new ConfigValidationError(`${path}.auth.roles.${roleName} must be an object`);
          }
          const rd = roleDef as Record<string, unknown>;
          if (!Array.isArray(rd.permissions)) {
            throw new ConfigValidationError(`${path}.auth.roles.${roleName}.permissions must be an array`);
          }
          for (let i = 0; i < rd.permissions.length; i++) {
            if (typeof rd.permissions[i] !== 'string') {
              throw new ConfigValidationError(`${path}.auth.roles.${roleName}.permissions[${i}] must be a string`);
            }
          }
          roles[roleName] = {
            permissions: rd.permissions as string[],
            description: typeof rd.description === 'string' ? rd.description : undefined,
          };
        }
        auth = { roles };
      }
    }
  }

  // capabilities
  let capabilities: Record<string, CapabilityConfig> | undefined;
  if (obj.capabilities !== undefined) {
    if (typeof obj.capabilities !== 'object' || obj.capabilities === null) {
      throw new ConfigValidationError(`${path}.capabilities must be an object`);
    }
    capabilities = {};
    const capsObj = obj.capabilities as Record<string, unknown>;
    for (const [capName, capValue] of Object.entries(capsObj)) {
      if (!KNOWN_CAPABILITIES.has(capName)) {
        console.warn(`signaldb.yaml: Unknown capability "${capName}" — ignoring for forward compatibility`);
      }
      if (typeof capValue === 'boolean') {
        capabilities[capName] = capValue;
      } else if (typeof capValue === 'object' && capValue !== null) {
        capabilities[capName] = capValue as Record<string, unknown>;
      } else {
        throw new ConfigValidationError(
          `${path}.capabilities.${capName} must be true, false, or an object`
        );
      }
    }
  }

  return {
    dir: obj.dir as string | undefined,
    framework: obj.framework as Framework,
    build: Object.keys(build).length > 0 ? build : undefined,
    health: Object.keys(health).length > 0 ? health : undefined,
    environments: Object.keys(environments).length > 0 ? environments : undefined,
    dependencies,
    schedules,
    auth,
    capabilities,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse and validate a signaldb.yaml string.
 * Throws ConfigValidationError on invalid input.
 */
export function parseSignalDBConfig(yamlStr: string): SignalDBConfigV1 {
  let raw: unknown;
  try {
    raw = yaml.load(yamlStr);
  } catch (err) {
    throw new ConfigValidationError(
      `Invalid YAML: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!raw || typeof raw !== 'object') {
    throw new ConfigValidationError('Config must be a YAML object');
  }

  const obj = raw as Record<string, unknown>;

  // version (required)
  if (obj.version !== 1) {
    throw new ConfigValidationError(`version must be 1 (got ${obj.version})`);
  }

  // Exactly one of app or apps
  const hasApp = obj.app !== undefined;
  const hasApps = obj.apps !== undefined;
  if (hasApp === hasApps) {
    throw new ConfigValidationError('Exactly one of "app" or "apps" must be present');
  }

  if (hasApp) {
    return {
      version: 1,
      app: validateAppConfig(obj.app, 'app', false),
    };
  }

  // Multi-app mode
  if (typeof obj.apps !== 'object' || obj.apps === null) {
    throw new ConfigValidationError('"apps" must be an object');
  }
  const appsObj = obj.apps as Record<string, unknown>;
  const apps: Record<string, AppConfig> = {};
  for (const [slug, appConfig] of Object.entries(appsObj)) {
    apps[slug] = validateAppConfig(appConfig, `apps.${slug}`, true);
  }

  if (Object.keys(apps).length === 0) {
    throw new ConfigValidationError('"apps" must contain at least one app');
  }

  return {
    version: 1,
    apps,
  };
}

/**
 * Check if config uses multi-app monorepo mode.
 */
export function isMonorepoConfig(config: SignalDBConfigV1): boolean {
  return config.apps !== undefined;
}

/**
 * Get the AppConfig for a specific app slug.
 * For single-app mode, returns the single app config regardless of slug.
 * For multi-app mode, looks up by slug.
 */
export function getAppConfig(config: SignalDBConfigV1, appSlug: string): AppConfig | null {
  if (config.app) {
    return config.app;
  }
  if (config.apps) {
    return config.apps[appSlug] || null;
  }
  return null;
}

/**
 * Resolve a full app config by merging YAML settings with framework defaults.
 * The resolved config is ready for the deploy agent to use.
 */
export function resolveAppConfig(
  config: SignalDBConfigV1,
  appSlug: string,
  fallbackFramework?: Framework,
): ResolvedAppConfig | null {
  const appConfig = getAppConfig(config, appSlug);
  if (!appConfig && !fallbackFramework) return null;

  const framework = appConfig?.framework || fallbackFramework || 'bun-server';
  const defaults = FRAMEWORK_DEFAULTS[framework];
  const build = appConfig?.build;
  const health = appConfig?.health;

  const resolved: ResolvedAppConfig = {
    framework,
    installCmd: build?.install || ['bun', 'install'],
    buildCmd: build?.command || defaults.buildCmd,
    entryPoint: build?.entry_point || defaults.entryPoint,
    healthPath: health?.path || '/health',
    healthTimeout: health?.timeout || 30000,
    healthInterval: health?.interval || 1000,
    environments: appConfig?.environments || { production: { branch: 'main' } },
    dependencies: appConfig?.dependencies || [],
  };

  // Frontend build
  if (build?.frontend) {
    resolved.frontendDir = build.frontend.dir;
    resolved.frontendInstallCmd = build.frontend.install || ['bun', 'install'];
    resolved.frontendBuildCmd = build.frontend.command || ['bun', 'run', 'build'];
  }

  return resolved;
}

/**
 * Generate a signaldb.yaml string for one or more apps.
 */
export function generateSignalDBYaml(
  apps: Array<{
    slug: string;
    dir?: string;
    framework: Framework;
    dependencies?: DependencyConfig[];
  }>,
): string {
  // Default auth roles block for all generated configs
  const defaultAuth = {
    roles: {
      owner: { permissions: ['*'] },
      member: { permissions: [] },
    },
  };

  if (apps.length === 1 && !apps[0].dir) {
    // Single-app mode
    const app = apps[0];
    const defaults = FRAMEWORK_DEFAULTS[app.framework];
    const appObj: Record<string, unknown> = {
      framework: app.framework,
      build: {
        command: defaults.buildCmd,
        entry_point: defaults.entryPoint,
      },
      health: {
        path: '/health',
      },
      environments: {
        production: { branch: 'main' },
      },
      auth: defaultAuth,
    };
    if (app.dependencies && app.dependencies.length > 0) {
      appObj.dependencies = app.dependencies;
    }
    const config: Record<string, unknown> = {
      version: 1,
      app: appObj,
    };
    return yaml.dump(config, { lineWidth: 120, quotingType: "'", forceQuotes: false });
  }

  // Multi-app mode
  const appsObj: Record<string, unknown> = {};
  for (const app of apps) {
    const defaults = FRAMEWORK_DEFAULTS[app.framework];
    const appObj: Record<string, unknown> = {
      dir: app.dir || app.slug,
      framework: app.framework,
      build: {
        command: defaults.buildCmd,
        entry_point: defaults.entryPoint,
      },
      health: {
        path: '/health',
      },
      environments: {
        production: { branch: 'main' },
      },
      auth: defaultAuth,
    };
    if (app.dependencies && app.dependencies.length > 0) {
      appObj.dependencies = app.dependencies;
    }
    appsObj[app.slug] = appObj;
  }

  const config: Record<string, unknown> = {
    version: 1,
    apps: appsObj,
  };
  return yaml.dump(config, { lineWidth: 120, quotingType: "'", forceQuotes: false });
}

/**
 * Add an app entry to an existing multi-app config YAML string.
 * Returns the updated YAML string.
 */
export function addAppToYaml(
  existingYaml: string,
  app: { slug: string; dir: string; framework: Framework },
): string {
  const config = parseSignalDBConfig(existingYaml);

  // If it was single-app mode, convert to multi-app
  if (config.app) {
    throw new ConfigValidationError(
      'Cannot add app to single-app config. Convert to multi-app (apps) mode first.'
    );
  }

  if (!config.apps) {
    config.apps = {};
  }

  const defaults = FRAMEWORK_DEFAULTS[app.framework];
  config.apps[app.slug] = {
    dir: app.dir,
    framework: app.framework,
    build: {
      command: defaults.buildCmd,
      entry_point: defaults.entryPoint,
    },
    health: {
      path: '/health',
    },
    environments: {
      production: { branch: 'main' },
    },
    auth: {
      roles: {
        owner: { permissions: ['*'] },
        member: { permissions: [] },
      },
    },
  };

  // Re-serialize
  const rawConfig: Record<string, unknown> = {
    version: 1,
    apps: {} as Record<string, unknown>,
  };
  for (const [slug, appConf] of Object.entries(config.apps)) {
    const ac = appConf as AppConfig;
    const entry: Record<string, unknown> = {
      dir: ac.dir || slug,
      framework: ac.framework,
    };
    if (ac.build) entry.build = ac.build;
    if (ac.health) entry.health = ac.health;
    if (ac.environments) entry.environments = ac.environments;
    if (ac.dependencies && ac.dependencies.length > 0) entry.dependencies = ac.dependencies;
    if (ac.auth !== undefined) entry.auth = ac.auth;
    (rawConfig.apps as Record<string, unknown>)[slug] = entry;
  }

  return yaml.dump(rawConfig, { lineWidth: 120, quotingType: "'", forceQuotes: false });
}
