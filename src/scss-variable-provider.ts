import * as vscode from "vscode";
import { PathAliasMap, RepositoryContextMap } from "./types";
import { resolveScssPath, findScssFile } from "./scss-definition-provider";
import { scssCache, ScssImport } from "./scss-cache";
import { getRepositoryContext } from "./extension";

/**
 * Parses the SCSS imports in a document
 */
export function parseScssImports(
  document: vscode.TextDocument,
  aliasMap: PathAliasMap,
  repositoryPath: string
): ScssImport[] {
  const cached = scssCache.getImports(repositoryPath, document.uri.toString());
  if (cached) {
    return cached;
  }

  const imports: ScssImport[] = [];

  const useRegex = /@use\s+["']([^"']+)["'](?:\s+as\s+(\*|\w+))?/g;
  const forwardRegex = /@forward\s+["']([^"']+)["']/g;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;

    let match: RegExpExecArray | null;
    const useRegexCopy = new RegExp(useRegex);
    while ((match = useRegexCopy.exec(line)) !== null) {
      const importPath = match[1];
      let namespace: string | null = match[2] || null;

      if (importPath.startsWith("sass:")) {
        continue;
      }

      if (!namespace) {
        const parts = importPath.split("/");
        namespace = parts[parts.length - 1].replace(/^_/, "");
      }

      if (namespace === "*") {
        namespace = null;
      }

      const resolvedPath = resolveScssPath(importPath, document.uri, aliasMap);
      const filePath = findScssFile(resolvedPath);

      if (filePath) {
        imports.push({ filePath, namespace });
      }
    }

    const forwardRegexCopy = new RegExp(forwardRegex);
    while ((match = forwardRegexCopy.exec(line)) !== null) {
      const importPath = match[1];
      const resolvedPath = resolveScssPath(importPath, document.uri, aliasMap);
      const filePath = findScssFile(resolvedPath);

      if (filePath) {
        imports.push({ filePath, namespace: null });
      }
    }
  }

  scssCache.setImports(repositoryPath, document.uri.toString(), imports);
  return imports;
}

/**
 * Parses the forward imports in a file
 */
export async function parseForwardImports(
  filePath: string,
  aliasMap: PathAliasMap,
  repositoryPath: string
): Promise<string[]> {
  const cached = scssCache.getForwards(repositoryPath, filePath);
  if (cached) {
    return cached;
  }

  const forwardedFiles: string[] = [];

  try {
    const fileUri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(content).toString("utf8");
    const lines = text.split(/\r?\n/);

    const forwardRegex = /@forward\s+["']([^"']+)["']/;

    for (const line of lines) {
      const match = line.match(forwardRegex);
      if (match) {
        const importPath = match[1];
        const resolvedPath = resolveScssPath(importPath, fileUri, aliasMap);
        const resolvedFile = findScssFile(resolvedPath);
        if (resolvedFile) {
          forwardedFiles.push(resolvedFile);
        }
      }
    }
  } catch (error) {
    return [];
  }

  scssCache.setForwards(repositoryPath, filePath, forwardedFiles);
  return forwardedFiles;
}

/**
 * Finds the definition of a variable, mixin, or function in a file
 */
export async function findDefinitionInFile(
  filePath: string,
  name: string,
  type: "variable" | "mixin" | "function",
  aliasMap: PathAliasMap,
  repositoryPath: string,
  visitedFiles: Set<string> = new Set()
): Promise<vscode.Location | null> {
  if (visitedFiles.has(filePath)) {
    return null;
  }
  visitedFiles.add(filePath);

  const cacheKey = `${filePath}:${name}:${type}`;
  if (visitedFiles.size === 1) {
    const cached = scssCache.getDefinition(repositoryPath, cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  }

  if (name.startsWith("_") || name.startsWith("-")) {
    return null;
  }

  try {
    const fileUri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(content).toString("utf8");
    const lines = text.split(/\r?\n/);

    let regex: RegExp;

    switch (type) {
      case "variable":
        regex = new RegExp(`\\$${name}\\s*:`);
        break;
      case "mixin":
        regex = new RegExp(`@mixin\\s+${name}\\s*[({]`);
        break;
      case "function":
        regex = new RegExp(`@function\\s+${name}\\s*\\(`);
        break;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith("//") || line.trim().startsWith("/*")) {
        continue;
      }

      if (regex.test(line)) {
        const match = line.match(regex);
        if (match) {
          const col = line.indexOf(match[0]);
          const location = new vscode.Location(
            fileUri,
            new vscode.Position(i, col)
          );

          if (visitedFiles.size === 1) {
            scssCache.setDefinition(repositoryPath, cacheKey, location);
          }

          return location;
        }
      }
    }

    const forwardedFiles = await parseForwardImports(
      filePath,
      aliasMap,
      repositoryPath
    );
    for (const forwardedFile of forwardedFiles) {
      const location = await findDefinitionInFile(
        forwardedFile,
        name,
        type,
        aliasMap,
        repositoryPath,
        visitedFiles
      );
      if (location) {
        return location;
      }
    }
  } catch (error) {
    // Ignore
  }

  if (visitedFiles.size === 1) {
    scssCache.setDefinition(repositoryPath, cacheKey, null);
  }

  return null;
}

/**
 * Definition Provider for SCSS variables, mixins and functions
 */
export class ScssVariableDefinitionProvider
  implements vscode.DefinitionProvider
{
  constructor(private contexts: RepositoryContextMap) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Definition | null> {
    const line = document.lineAt(position.line).text;

    const repoContext = getRepositoryContext(document.uri, this.contexts);
    if (!repoContext) {
      return null;
    }

    const imports = parseScssImports(
      document,
      repoContext.aliases,
      repoContext.rootPath
    );

    const varWithNamespace = document.getWordRangeAtPosition(
      position,
      /[\w-]+\.\$[\w-]+/
    );
    if (varWithNamespace) {
      const word = document.getText(varWithNamespace);
      const match = word.match(/([\w-]+)\.\$([\w-]+)/);
      if (match) {
        const namespace = match[1];
        const variableName = match[2];

        const importInfo = imports.find((imp) => imp.namespace === namespace);
        if (importInfo) {
          return findDefinitionInFile(
            importInfo.filePath,
            variableName,
            "variable",
            repoContext.aliases,
            repoContext.rootPath
          );
        }
      }
    }

    const varWithoutNamespace = document.getWordRangeAtPosition(
      position,
      /\$[\w-]+/
    );
    if (varWithoutNamespace) {
      const word = document.getText(varWithoutNamespace);
      const match = word.match(/\$([\w-]+)/);
      if (match) {
        const variableName = match[1];

        for (const importInfo of imports) {
          if (importInfo.namespace === null) {
            const location = await findDefinitionInFile(
              importInfo.filePath,
              variableName,
              "variable",
              repoContext.aliases,
              repoContext.rootPath
            );
            if (location) {
              return location;
            }
          }
        }
      }
    }

    const mixinWithNamespace = line.match(/@include\s+([\w-]+)\.([\w-]+)/);
    if (mixinWithNamespace) {
      const namespace = mixinWithNamespace[1];
      const mixinName = mixinWithNamespace[2];

      const importInfo = imports.find((imp) => imp.namespace === namespace);
      if (importInfo) {
        return findDefinitionInFile(
          importInfo.filePath,
          mixinName,
          "mixin",
          repoContext.aliases,
          repoContext.rootPath
        );
      }
    }

    const mixinWithoutNamespace = line.match(/@include\s+([\w-]+)/);
    if (mixinWithoutNamespace) {
      const mixinName = mixinWithoutNamespace[1];

      for (const importInfo of imports) {
        if (importInfo.namespace === null) {
          const location = await findDefinitionInFile(
            importInfo.filePath,
            mixinName,
            "mixin",
            repoContext.aliases,
            repoContext.rootPath
          );
          if (location) {
            return location;
          }
        }
      }
    }

    const funcWithNamespace = document.getWordRangeAtPosition(
      position,
      /[\w-]+\.[\w-]+\s*\(/
    );
    if (funcWithNamespace) {
      const word = document.getText(funcWithNamespace);
      const match = word.match(/([\w-]+)\.([\w-]+)\s*\(/);
      if (match) {
        const namespace = match[1];
        const functionName = match[2];

        const importInfo = imports.find((imp) => imp.namespace === namespace);
        if (importInfo) {
          return findDefinitionInFile(
            importInfo.filePath,
            functionName,
            "function",
            repoContext.aliases,
            repoContext.rootPath
          );
        }
      }
    }

    const funcWithoutNamespace = document.getWordRangeAtPosition(
      position,
      /[\w-]+\s*\(/
    );
    if (funcWithoutNamespace) {
      const word = document.getText(funcWithoutNamespace);
      const match = word.match(/([\w-]+)\s*\(/);
      if (match) {
        const functionName = match[1];

        for (const importInfo of imports) {
          if (importInfo.namespace === null) {
            const location = await findDefinitionInFile(
              importInfo.filePath,
              functionName,
              "function",
              repoContext.aliases,
              repoContext.rootPath
            );
            if (location) {
              return location;
            }
          }
        }
      }
    }

    return null;
  }
}
