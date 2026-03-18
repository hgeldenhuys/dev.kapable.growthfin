/**
 * RSC Validator Service
 *
 * Loads WASM modules for RSC schema compilation and entity validation.
 * Caches compiled schemas per-table for fast validation on row insert/update.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// Types (mirror @ayios/svm-wasm types, kept local to avoid dependency issues)
// ============================================================================

export interface CompiledSchema {
  version: string;
  entities: EntitySchema[];
  enums?: EnumSchema[];
  predicates: PredicateSchema[];
  invariants: InvariantSchema[];
  [key: string]: unknown;
}

interface EntitySchema {
  name: string;
  fields: FieldSchema[];
  typeId: number;
  identityFields?: string[];
}

interface FieldSchema {
  name: string;
  typeName: string;
  optional?: boolean;
  defaultValue?: unknown;
}

interface EnumSchema {
  name: string;
  variants: string[];
  typeId: number;
}

interface PredicateSchema {
  name: string;
  predicateType: 'state' | 'transformation';
  entityType: string;
}

interface InvariantSchema {
  name: string;
  predicateName: string;
  entityType: string;
  severity: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  expectedType?: string;
  actualValue?: string;
}

export interface CompileResult {
  success: boolean;
  schema: CompiledSchema | null;
  bytecode: string | null;
  errors: CompileDiagnostic[];
  warnings?: CompileDiagnostic[];
}

export interface CompileDiagnostic {
  errorId: string;
  severity: string;
  message: string;
  span: { start: number; end: number };
  context?: string;
}

// ============================================================================
// WASM Module Paths
// ============================================================================

const __dirname_resolved = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

// Paths to wasm-pack output relative to this service file
const SVM_WASM_PKG = resolve(
  __dirname_resolved,
  '../../../../../ayios/infrastructure/svm-wasm/pkg'
);
const COMPILER_WASM_PKG = resolve(
  __dirname_resolved,
  '../../../../../ayios/initiatives/rsc-svm-invariant-prototype/compiler-wasm/pkg'
);

// ============================================================================
// Module State
// ============================================================================

interface SvmWasmModule {
  validateEntity: (entityJson: string, schemaJson: string) => unknown;
  initSync: (input: { module: BufferSource }) => unknown;
}

interface CompilerWasmModule {
  compileRsc: (source: string) => unknown;
  exportSchema: (source: string) => unknown;
  initSync: (input: { module: BufferSource }) => unknown;
}

let svmModule: SvmWasmModule | null = null;
let compilerModule: CompilerWasmModule | null = null;
let initError: string | null = null;

// ============================================================================
// Lazy Initialization
// ============================================================================

async function ensureSvmModule(): Promise<SvmWasmModule | null> {
  if (svmModule) return svmModule;
  if (initError) return null;

  try {
    const wasmPath = resolve(SVM_WASM_PKG, 'ayios_svm_wasm_bg.wasm');
    const jsPath = resolve(SVM_WASM_PKG, 'ayios_svm_wasm.js');

    const mod = await import(jsPath);
    const wasmBytes = readFileSync(wasmPath);
    mod.initSync({ module: wasmBytes });

    svmModule = mod;
    return mod;
  } catch (err) {
    initError = `SVM WASM init failed: ${err}`;
    console.warn(`[rsc-validator] ${initError}`);
    return null;
  }
}

async function ensureCompilerModule(): Promise<CompilerWasmModule | null> {
  if (compilerModule) return compilerModule;
  if (initError) return null;

  try {
    const wasmPath = resolve(COMPILER_WASM_PKG, 'rsc_compiler_wasm_bg.wasm');
    const jsPath = resolve(COMPILER_WASM_PKG, 'rsc_compiler_wasm.js');

    const mod = await import(jsPath);
    const wasmBytes = readFileSync(wasmPath);
    mod.initSync({ module: wasmBytes });

    compilerModule = mod;
    return mod;
  } catch (err) {
    initError = `Compiler WASM init failed: ${err}`;
    console.warn(`[rsc-validator] ${initError}`);
    return null;
  }
}

// ============================================================================
// Schema Cache
// ============================================================================

// Key: "projectId:tableName", Value: CompiledSchema
const schemaCache = new Map<string, CompiledSchema>();

function schemaCacheKey(projectId: string, tableName: string): string {
  return `${projectId}:${tableName}`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compile RSC source and return the compiled schema.
 * Used when uploading a new RSC schema for a table.
 */
export async function compileRscSource(source: string): Promise<CompileResult> {
  const mod = await ensureCompilerModule();
  if (!mod) {
    return {
      success: false,
      schema: null,
      bytecode: null,
      errors: [{
        errorId: 'WASM_NOT_AVAILABLE',
        severity: 'error',
        message: initError ?? 'RSC compiler WASM module not available',
        span: { start: 0, end: 0 },
      }],
    };
  }

  return mod.compileRsc(source) as CompileResult;
}

/**
 * Register a compiled schema for a table (used after successful compilation).
 */
export function registerSchema(
  projectId: string,
  tableName: string,
  schema: CompiledSchema
): void {
  schemaCache.set(schemaCacheKey(projectId, tableName), schema);
}

/**
 * Remove a schema registration (used when RSC schema is deleted).
 */
export function removeSchema(projectId: string, tableName: string): void {
  schemaCache.delete(schemaCacheKey(projectId, tableName));
}

/**
 * Load schema from table metadata into cache if present.
 */
export function loadSchemaFromMetadata(
  projectId: string,
  tableName: string,
  rscSchema: CompiledSchema | null | undefined
): void {
  if (rscSchema) {
    schemaCache.set(schemaCacheKey(projectId, tableName), rscSchema);
  }
}

/**
 * Validate a row against the RSC schema for a table.
 *
 * Returns null if no schema is registered (validation skipped).
 * Returns ValidationResult if schema exists.
 */
export async function validateRow(
  projectId: string,
  tableName: string,
  entity: Record<string, unknown>,
  entityType?: string
): Promise<ValidationResult | null> {
  const key = schemaCacheKey(projectId, tableName);
  const schema = schemaCache.get(key);

  if (!schema) return null; // No schema = skip validation

  const mod = await ensureSvmModule();
  if (!mod) return null; // WASM not available = skip validation (fail open)

  // Add _type hint if entity type is specified
  const entityWithType = entityType
    ? { _type: entityType, ...entity }
    : entity;

  return mod.validateEntity(
    JSON.stringify(entityWithType),
    JSON.stringify(schema)
  ) as ValidationResult;
}

/**
 * Check if RSC validation is available (WASM modules loaded).
 */
export function isAvailable(): boolean {
  return initError === null;
}

/**
 * Get initialization status for health checks.
 */
export function getStatus(): { available: boolean; error?: string; cachedSchemas: number } {
  return {
    available: initError === null,
    error: initError ?? undefined,
    cachedSchemas: schemaCache.size,
  };
}
