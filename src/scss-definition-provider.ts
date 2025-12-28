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

    context.subscriptions.push(definitionProvider, linkProvider);
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
          `Cannot find SCSS file: ${importPath}`,
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
