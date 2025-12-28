import * as vscode from "vscode";

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

/**
 * Context of a repository
 */
export interface RepositoryContext {
  /** Absolute path to the repository directory */
  rootPath: string;
  /** URI of the repository directory */
  rootUri: vscode.Uri;
  /** Path aliases for this repository */
  aliases: PathAliasMap;
  /** Paths to tsconfig.json files */
  tsconfigPaths: vscode.Uri[];
}

/**
 * Map of repository contexts
 * Key: absolute path to the repository directory
 * Value: repository context
 */
export type RepositoryContextMap = Map<string, RepositoryContext>;

/**
 * Repository path configuration
 * Can be either a string (directory or tsconfig path) or an object with explicit root and tsconfig
 */
export type RepositoryPathConfig =
  | string
  | {
      root: string;
      tsconfig?: string;
    };

/**
 * type of SCSS symbol
 */
export type ScssSymbolType = "variable" | "mixin" | "function";

/**
 * SCSS symbol (variable, mixin or function)
 */
export interface ScssSymbol {
  /** Name of symbol without prefixes ($, @mixin, @function) */
  name: string;
  /** Type of symbol */
  type: ScssSymbolType;
  /** Path to file where symbol is defined */
  filePath: string;
  /** Line number in file */
  line: number;
  /** Additional information (variable value, mixin/function parameters) */
  detail?: string;
  /** Documentation from comments */
  documentation?: string;
}

/**
 * Контекст автодополнения
 */
export interface CompletionContext {
  /** Тип запрашиваемого символа */
  symbolType: ScssSymbolType | null;
  /** Namespace, если указан */
  namespace: string | null;
  /** Префикс для фильтрации */
  prefix: string;
}
