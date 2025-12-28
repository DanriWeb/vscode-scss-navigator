import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { PathAliasMap } from "./types";
import { resolveAlias } from "./tsconfig-parser";

function parseScssImport(line: string): string | null {
  const regex = /@(?:use|forward|import)\s+['"]([^'"]+)['"]/;
  const match = line.match(regex);
  return match ? match[1] : null;
}

function resolveScssPath(
  importPath: string,
  currentFileUri: vscode.Uri,
  aliasMap: PathAliasMap
): string {
  if (importPath.startsWith(".")) {
    return path.resolve(path.dirname(currentFileUri.fsPath), importPath);
  }

  const resolved = resolveAlias(importPath, aliasMap);
  return (
    resolved || path.resolve(path.dirname(currentFileUri.fsPath), importPath)
  );
}

function findScssFile(basePath: string): string | null {
  const basename = path.basename(basePath);
  const dirname = path.dirname(basePath);
  const variants: string[] = [];

  for (const ext of ["scss", "sass"]) {
    variants.push(
      `${basePath}.${ext}`,
      path.join(dirname, `_${basename}.${ext}`)
    );

    if (!basePath.endsWith("/index") && !basePath.endsWith("\\index")) {
      variants.push(
        path.join(basePath, `index.${ext}`),
        path.join(basePath, `_index.${ext}`)
      );
    }
  }

  return variants.find(fs.existsSync) || null;
}

async function getScssCompletions(
  partialPath: string,
  currentFileUri: vscode.Uri,
  aliasMap: PathAliasMap
): Promise<vscode.CompletionItem[]> {
  const completions: vscode.CompletionItem[] = [];

  let dirPath = partialPath;
  const lastSlash = partialPath.lastIndexOf("/");
  if (lastSlash !== -1) {
    dirPath = partialPath.substring(0, lastSlash);
  } else {
    dirPath = "";
  }

  const resolvedPath = dirPath
    ? resolveScssPath(dirPath, currentFileUri, aliasMap)
    : path.dirname(currentFileUri.fsPath);

  try {
    const dirUri = vscode.Uri.file(resolvedPath);
    const entries = await vscode.workspace.fs.readDirectory(dirUri);

    for (const [name, type] of entries) {
      if (name.startsWith(".")) {
        continue;
      }

      if (type === vscode.FileType.Directory) {
        const item = new vscode.CompletionItem(
          name + "/",
          vscode.CompletionItemKind.Folder
        );
        item.insertText = name + "/";
        item.command = {
          command: "editor.action.triggerSuggest",
          title: "Trigger Suggest",
        };
        completions.push(item);
      } else if (name.endsWith(".scss") || name.endsWith(".sass")) {
        let displayName = name;
        let insertText = name.replace(/\.(scss|sass)$/, "");

        if (name.startsWith("_")) {
          displayName = name;
          insertText = name.substring(1).replace(/\.(scss|sass)$/, "");
        }

        const item = new vscode.CompletionItem(
          displayName,
          vscode.CompletionItemKind.File
        );
        item.insertText = insertText;
        item.detail = "SCSS file";
        completions.push(item);
      }
    }
  } catch (error) {
    // Directory doesn't exist
  }

  return completions;
}

export function registerScssProviders(
  context: vscode.ExtensionContext,
  aliasMap: PathAliasMap
): void {
  const languages = ["scss", "sass"];

  languages.forEach((language) => {
    const definitionProvider = vscode.languages.registerDefinitionProvider(
      language,
      {
        provideDefinition(document, position) {
          const line = document.lineAt(position.line).text;
          const importPath = parseScssImport(line);

          if (!importPath) {
            return;
          }

          const resolvedPath = resolveScssPath(
            importPath,
            document.uri,
            aliasMap
          );
          const filePath = findScssFile(resolvedPath);

          if (filePath) {
            return new vscode.Location(
              vscode.Uri.file(filePath),
              new vscode.Position(0, 0)
            );
          }
        },
      }
    );

    const linkProvider = vscode.languages.registerDocumentLinkProvider(
      { language },
      {
        provideDocumentLinks(document) {
          const links: vscode.DocumentLink[] = [];
          const regex = /@(?:use|forward|import)\s+['"]([^'"]+)['"]/g;

          for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            let match: RegExpExecArray | null;

            while ((match = regex.exec(line.text)) !== null) {
              const importPath = match[1];
              const resolvedPath = resolveScssPath(
                importPath,
                document.uri,
                aliasMap
              );
              const filePath = findScssFile(resolvedPath);

              if (filePath) {
                const start = line.text.indexOf(importPath);
                const range = new vscode.Range(
                  i,
                  start,
                  i,
                  start + importPath.length
                );
                links.push(
                  new vscode.DocumentLink(range, vscode.Uri.file(filePath))
                );
              }
            }
          }

          return links.length ? links : undefined;
        },
      }
    );

    const hoverProvider = vscode.languages.registerHoverProvider(
      { language },
      {
        provideHover(document, position) {
          const line = document.lineAt(position.line).text;
          const importPath = parseScssImport(line);

          if (!importPath) {
            return;
          }

          const resolvedPath = resolveScssPath(
            importPath,
            document.uri,
            aliasMap
          );
          const filePath = findScssFile(resolvedPath);

          if (filePath) {
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`\`${filePath}\``);
            return new vscode.Hover(markdown);
          }
        },
      }
    );

    const completionProvider = vscode.languages.registerCompletionItemProvider(
      { language },
      {
        async provideCompletionItems(document, position) {
          const line = document.lineAt(position.line).text;
          const textBeforeCursor = line.substring(0, position.character);
          const regex = /@(?:use|forward|import)\s+["']([^"']*)$/;
          const match = textBeforeCursor.match(regex);

          if (!match) {
            return;
          }

          const partialPath = match[1];
          return getScssCompletions(partialPath, document.uri, aliasMap);
        },
      },
      "/",
      "@"
    );

    context.subscriptions.push(
      definitionProvider,
      linkProvider,
      hoverProvider,
      completionProvider
    );
  });
}

function validateScssImports(
  document: vscode.TextDocument,
  aliasMap: PathAliasMap
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const regex = /@(?:use|forward|import)\s+['"]([^'"]+)['"]/g;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line.text)) !== null) {
      const importPath = match[1];
      const resolvedPath = resolveScssPath(importPath, document.uri, aliasMap);
      const filePath = findScssFile(resolvedPath);

      if (!filePath) {
        const start = line.text.indexOf(importPath);
        const range = new vscode.Range(i, start, i, start + importPath.length);

        const diagnostic = new vscode.Diagnostic(
          range,
          `Cannot find SCSS file: \`${importPath}\``,
          vscode.DiagnosticSeverity.Error
        );

        diagnostic.source = "SCSS Navigator";
        diagnostics.push(diagnostic);
      }
    }
  }

  return diagnostics;
}

export function registerScssDiagnostics(
  context: vscode.ExtensionContext,
  aliasMap: PathAliasMap
): void {
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("scss");
  context.subscriptions.push(diagnosticCollection);

  function updateDiagnostics(document: vscode.TextDocument) {
    if (document.languageId === "scss" || document.languageId === "sass") {
      const diagnostics = validateScssImports(document, aliasMap);
      diagnosticCollection.set(document.uri, diagnostics);
    }
  }

  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDiagnostics(editor.document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      updateDiagnostics(event.document);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(updateDiagnostics)
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      diagnosticCollection.delete(document.uri);
    })
  );
}
