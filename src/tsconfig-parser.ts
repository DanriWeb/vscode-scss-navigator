import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";
import * as path from "path";
import { TsConfig, PathAliasMap } from "./types";

/**
 * Read and parse tsconfig.json file
 * @param uri URI of the tsconfig.json file
 * @returns Parsed tsconfig object or null on error
 */
export async function readTsConfig(uri: vscode.Uri): Promise<TsConfig | null> {
  try {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString("utf8");

    const errors: jsonc.ParseError[] = [];
    const tsconfig = jsonc.parse(text, errors, {
      allowTrailingComma: true,
    }) as TsConfig;

    if (errors.length > 0) {
      console.error(`Failed to parse ${uri.fsPath}:`, errors);
      return null;
    }

    return tsconfig;
  } catch (error) {
    console.error(`Failed to read ${uri.fsPath}:`, error);
    return null;
  }
}

/**
 * Read tsconfig.json and all referenced configurations recursively
 * @param uri URI of the tsconfig.json file
 * @param visited Set of already visited URIs to prevent circular references
 * @returns Array of all tsconfig URIs (including referenced ones)
 */
export async function readTsConfigWithReferences(
  uri: vscode.Uri,
  visited: Set<string> = new Set()
): Promise<vscode.Uri[]> {
  const normalizedPath = uri.fsPath.toLowerCase();

  if (visited.has(normalizedPath)) {
    return [];
  }

  visited.add(normalizedPath);
  const result: vscode.Uri[] = [uri];

  const tsconfig = await readTsConfig(uri);
  if (!tsconfig) {
    return result;
  }

  if (tsconfig.references && tsconfig.references.length > 0) {
    const tsconfigDir = path.dirname(uri.fsPath);

    for (const ref of tsconfig.references) {
      let refPath = ref.path;

      if (!refPath.endsWith(".json")) {
        refPath = path.join(refPath, "tsconfig.json");
      }

      const refUri = vscode.Uri.file(path.resolve(tsconfigDir, refPath));

      try {
        await vscode.workspace.fs.stat(refUri);
        const referencedConfigs = await readTsConfigWithReferences(
          refUri,
          visited
        );
        result.push(...referencedConfigs);
      } catch (error) {
        console.warn(`Referenced tsconfig not found: ${refUri.fsPath}`);
      }
    }
  }

  return result;
}

/**
 * Extract path aliases from tsconfig.json
 * @param tsconfig Parsed tsconfig object
 * @param tsconfigUri URI of the tsconfig.json file (for resolving relative paths)
 * @returns Map of alias prefixes to resolved absolute paths
 */
export function extractPathAliases(
  tsconfig: TsConfig,
  tsconfigUri: vscode.Uri
): PathAliasMap {
  const aliasMap: PathAliasMap = new Map();

  if (!tsconfig.compilerOptions?.paths) {
    return aliasMap;
  }

  const baseUrl = tsconfig.compilerOptions.baseUrl || ".";
  const tsconfigDir = path.dirname(tsconfigUri.fsPath);
  const resolvedBaseUrl = path.resolve(tsconfigDir, baseUrl);

  for (const [aliasPattern, aliasPaths] of Object.entries(
    tsconfig.compilerOptions.paths
  )) {
    const resolvedPaths = aliasPaths.map((aliasPath) => {
      const cleanPath = aliasPath.replace(/\/\*$/, "");
      return path.resolve(resolvedBaseUrl, cleanPath);
    });

    aliasMap.set(aliasPattern, resolvedPaths);
  }

  return aliasMap;
}

/**
 * Resolve an import path using the alias map
 * @param importPath Import path from SCSS file (e.g., "@/shared/styles/colors")
 * @param aliases Map of path aliases
 * @returns Resolved absolute path or null if no matching alias found
 */
export function resolveAlias(
  importPath: string,
  aliases: PathAliasMap
): string | null {
  const sortedAliases = Array.from(aliases.entries()).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [aliasPattern, aliasPaths] of sortedAliases) {
    const aliasPrefix = aliasPattern.replace(/\/\*$/, "");

    if (importPath.startsWith(aliasPrefix)) {
      const relativePart = importPath.substring(aliasPrefix.length);

      for (const aliasPath of aliasPaths) {
        const resolvedPath = path.join(aliasPath, relativePart);
        return resolvedPath;
      }
    }
  }

  return null;
}

/**
 * Merge multiple alias maps into one
 * Later maps take precedence over earlier ones
 * @param aliasMaps Array of alias maps to merge
 * @returns Merged alias map
 */
export function mergeAliasMaps(...aliasMaps: PathAliasMap[]): PathAliasMap {
  const merged: PathAliasMap = new Map();

  for (const aliasMap of aliasMaps) {
    for (const [pattern, paths] of aliasMap.entries()) {
      merged.set(pattern, paths);
    }
  }

  return merged;
}
