import * as vscode from "vscode";
import {
  ScssSymbol,
  ScssSymbolType,
  CompletionContext,
  RepositoryContextMap,
  PathAliasMap,
} from "./types";
import { parseScssImports } from "./scss-variable-provider";
import { getRepositoryContext } from "./extension";
import { scssCache } from "./scss-cache";

/**
 * collect symbols (variables, mixins, functions) from SCSS file
 */
export async function collectSymbolsFromFile(
  filePath: string,
  repositoryPath: string
): Promise<ScssSymbol[]> {
  const cached = scssCache.getSymbols(repositoryPath, filePath);
  if (cached) {
    return cached;
  }

  const symbols: ScssSymbol[] = [];

  try {
    const fileUri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(content).toString("utf8");
    const lines = text.split(/\r?\n/);

    const variableRegex = /^\s*\$([a-zA-Z0-9_-]+)\s*:\s*(.+?);/;
    const mixinRegex = /^\s*@mixin\s+([a-zA-Z0-9_-]+)\s*(\([^)]*\))?/;
    const functionRegex = /^\s*@function\s+([a-zA-Z0-9_-]+)\s*(\([^)]*\))/;

    let lastComment = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("//")) {
        lastComment = trimmedLine.substring(2).trim();
        continue;
      }
      const varMatch = line.match(variableRegex);
      if (varMatch) {
        const name = varMatch[1];
        const value = varMatch[2].trim();
        symbols.push({
          name,
          type: "variable",
          filePath,
          line: i,
          detail: value,
          documentation: lastComment || undefined,
        });
        lastComment = "";
        continue;
      }

      const mixinMatch = line.match(mixinRegex);
      if (mixinMatch) {
        const name = mixinMatch[1];
        const params = mixinMatch[2] || "()";
        symbols.push({
          name,
          type: "mixin",
          filePath,
          line: i,
          detail: params,
          documentation: lastComment || undefined,
        });
        lastComment = "";
        continue;
      }

      const funcMatch = line.match(functionRegex);
      if (funcMatch) {
        const name = funcMatch[1];
        const params = funcMatch[2];
        symbols.push({
          name,
          type: "function",
          filePath,
          line: i,
          detail: params,
          documentation: lastComment || undefined,
        });
        lastComment = "";
        continue;
      }

      if (trimmedLine && !trimmedLine.startsWith("/*")) {
        lastComment = "";
      }
    }
  } catch (error) {
    console.error(`Error collecting symbols from ${filePath}:`, error);
  }

  scssCache.setSymbols(repositoryPath, filePath, symbols);
  return symbols;
}

/**
 * Collect symbols recursively including @forward files
 */
async function collectSymbolsRecursively(
  filePath: string,
  repositoryPath: string,
  aliasMap: PathAliasMap,
  visitedFiles: Set<string> = new Set()
): Promise<ScssSymbol[]> {
  if (visitedFiles.has(filePath)) {
    return [];
  }
  visitedFiles.add(filePath);

  const symbols = await collectSymbolsFromFile(filePath, repositoryPath);

  const { parseForwardImports } = await import("./scss-variable-provider.js");
  const forwardedFiles = await parseForwardImports(
    filePath,
    aliasMap,
    repositoryPath
  );

  for (const forwardedFile of forwardedFiles) {
    const forwardedSymbols = await collectSymbolsRecursively(
      forwardedFile,
      repositoryPath,
      aliasMap,
      visitedFiles
    );
    symbols.push(...forwardedSymbols);
  }

  return symbols;
}

/**
 * get all available symbols with imports
 */
export async function getAvailableSymbols(
  document: vscode.TextDocument,
  aliasMap: PathAliasMap,
  repositoryPath: string
): Promise<Map<string | null, ScssSymbol[]>> {
  const imports = parseScssImports(document, aliasMap, repositoryPath);
  const symbolsByNamespace = new Map<string | null, ScssSymbol[]>();

  for (const importInfo of imports) {
    const symbols = await collectSymbolsRecursively(
      importInfo.filePath,
      repositoryPath,
      aliasMap
    );

    const existing = symbolsByNamespace.get(importInfo.namespace) || [];
    symbolsByNamespace.set(importInfo.namespace, [...existing, ...symbols]);
  }

  const currentFileSymbols = await collectSymbolsFromFile(
    document.uri.fsPath,
    repositoryPath
  );
  const existingCurrentSymbols = symbolsByNamespace.get(null) || [];
  symbolsByNamespace.set(null, [
    ...existingCurrentSymbols,
    ...currentFileSymbols,
  ]);

  return symbolsByNamespace;
}

/**
 * get completion context based on cursor position
 */
export function getCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position
): CompletionContext {
  const line = document.lineAt(position.line).text;
  const textBeforeCursor = line.substring(0, position.character);

  const mixinWithNamespaceMatch = textBeforeCursor.match(
    /@include\s+([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]*)$/
  );
  if (mixinWithNamespaceMatch) {
    return {
      symbolType: "mixin",
      namespace: mixinWithNamespaceMatch[1],
      prefix: mixinWithNamespaceMatch[2],
    };
  }

  const mixinMatch = textBeforeCursor.match(/@include\s+([a-zA-Z0-9_-]*)$/);
  if (mixinMatch) {
    return {
      symbolType: "mixin",
      namespace: null,
      prefix: mixinMatch[1],
    };
  }

  const varWithNamespaceMatch = textBeforeCursor.match(
    /([a-zA-Z0-9_-]+)\.\$([a-zA-Z0-9_-]*)$/
  );
  if (varWithNamespaceMatch) {
    return {
      symbolType: "variable",
      namespace: varWithNamespaceMatch[1],
      prefix: varWithNamespaceMatch[2],
    };
  }

  const varMatch = textBeforeCursor.match(/\$([a-zA-Z0-9_-]*)$/);

  if (varMatch) {
    return {
      symbolType: "variable",
      namespace: null,
      prefix: varMatch[1],
    };
  }

  const funcWithNamespaceMatch = textBeforeCursor.match(
    /([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]*)$/
  );

  if (funcWithNamespaceMatch) {
    return {
      symbolType: "function",
      namespace: funcWithNamespaceMatch[1],
      prefix: funcWithNamespaceMatch[2],
    };
  }

  const inValueContext = /[:,(]\s*[a-zA-Z0-9_-]*$/.test(textBeforeCursor);

  if (inValueContext) {
    const prefixMatch = textBeforeCursor.match(/([a-zA-Z0-9_-]*)$/);
    return {
      symbolType: "function",
      namespace: null,
      prefix: prefixMatch ? prefixMatch[1] : "",
    };
  }

  return {
    symbolType: null,
    namespace: null,
    prefix: "",
  };
}

/**
 * completion provider for SCSS symbols
 */
export class ScssCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private contexts: RepositoryContextMap) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[]> {
    const context = getCompletionContext(document, position);

    if (!context.symbolType) {
      return [];
    }

    const repoContext = getRepositoryContext(document.uri, this.contexts);

    let symbolsByNamespace: Map<string | null, ScssSymbol[]>;

    if (!repoContext) {
      symbolsByNamespace = new Map();
      const currentFileSymbols = await collectSymbolsFromFile(
        document.uri.fsPath,
        document.uri.fsPath
      );
      symbolsByNamespace.set(null, currentFileSymbols);
    } else {
      symbolsByNamespace = await getAvailableSymbols(
        document,
        repoContext.aliases,
        repoContext.rootPath
      );
    }

    const completionItems: vscode.CompletionItem[] = [];

    if (context.namespace) {
      const symbols = symbolsByNamespace.get(context.namespace) || [];
      for (const symbol of symbols) {
        if (symbol.type === context.symbolType) {
          const item = this.createCompletionItem(
            symbol,
            context,
            document,
            position
          );
          if (item) {
            completionItems.push(item);
          }
        }
      }
    } else {
      const symbols = symbolsByNamespace.get(null) || [];

      const seenNames = new Set<string>();
      for (const symbol of symbols) {
        if (symbol.type === context.symbolType && !seenNames.has(symbol.name)) {
          seenNames.add(symbol.name);
          const item = this.createCompletionItem(
            symbol,
            context,
            document,
            position
          );
          if (item) {
            completionItems.push(item);
          }
        }
      }
    }

    return completionItems;
  }

  private createCompletionItem(
    symbol: ScssSymbol,
    context: CompletionContext,
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem | null {
    if (context.prefix && !symbol.name.startsWith(context.prefix)) {
      return null;
    }

    let label = symbol.name;
    let insertText = symbol.name;
    let kind: vscode.CompletionItemKind = vscode.CompletionItemKind.Variable;

    switch (symbol.type) {
      case "variable":
        kind = vscode.CompletionItemKind.Variable;
        if (!context.namespace) {
          label = `$${symbol.name}`;
          insertText = `$${symbol.name}`;
        }
        break;
      case "mixin":
        kind = vscode.CompletionItemKind.Function;
        break;
      case "function":
        kind = vscode.CompletionItemKind.Method;
        insertText = `${symbol.name}($1)$0`;
        break;
    }

    const item = new vscode.CompletionItem(label, kind);

    if (symbol.type === "function") {
      item.insertText = new vscode.SnippetString(insertText);
    } else {
      item.insertText = insertText;
    }

    item.detail = symbol.detail;
    item.documentation = symbol.documentation;

    const fileName = symbol.filePath.split(/[\\/]/).pop() || "";
    item.detail = symbol.detail ? `${symbol.detail} • ${fileName}` : fileName;

    if (symbol.type === "variable" && !context.namespace) {
      const line = document.lineAt(position.line).text;
      const textBeforeCursor = line.substring(0, position.character);
      const match = textBeforeCursor.match(/\$([a-zA-Z0-9_-]*)$/);

      if (match) {
        const startPos = new vscode.Position(
          position.line,
          position.character - match[0].length
        );
        const range = new vscode.Range(startPos, position);
        item.range = range;
      }
    }

    return item;
  }
}
