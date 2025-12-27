/**
 * Compiler options from tsconfig.json
 */
export interface TsConfigCompilerOptions {
  baseUrl?: string;
  paths?: Record<string, string[]>;
  [key: string]: unknown;
}

/**
 * Structure of tsconfig.json file
 */
export interface TsConfig {
  compilerOptions?: TsConfigCompilerOptions;
  extends?: string;
  references?: Array<{ path: string }>;
  files?: string[];
  [key: string]: unknown;
}

/**
 * Represents a single path alias mapping
 */
export interface PathAlias {
  /** Alias prefix (e.g., "@/", "@shared/") */
  prefix: string;
  /** Resolved absolute paths for this alias */
  paths: string[];
}

/**
 * Map of all path aliases in the project
 * Key: alias prefix (e.g., "@/*")
 * Value: array of resolved absolute paths
 */
export type PathAliasMap = Map<string, string[]>;
