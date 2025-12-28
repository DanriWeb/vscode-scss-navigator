import * as vscode from "vscode";
import { PathAliasMap } from "./types";
import {
  parseScssImports,
  findDefinitionInFile,
} from "./scss-variable-provider";

/**
 * Validates SCSS symbols (variables, mixins, functions) in the document
 */
export async function validateScssSymbols(
  document: vscode.TextDocument,
  aliasMap: PathAliasMap,
  repositoryPath: string
): Promise<vscode.Diagnostic[]> {
  const diagnostics: vscode.Diagnostic[] = [];

  const imports = parseScssImports(document, aliasMap, repositoryPath);

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    const text = line.text;

    if (text.trim().startsWith("//") || text.trim().startsWith("/*")) {
      continue;
    }

    const varRegex = /([\w-]+)\.\$([\w-]+)/g;
    let varMatch: RegExpExecArray | null;

    while ((varMatch = varRegex.exec(text)) !== null) {
      const namespace = varMatch[1];
      const variableName = varMatch[2];

      const importInfo = imports.find((imp) => imp.namespace === namespace);
      if (importInfo) {
        const location = await findDefinitionInFile(
          importInfo.filePath,
          variableName,
          "variable",
          aliasMap,
          repositoryPath
        );

        if (!location) {
          const start = varMatch.index;
          const end = start + varMatch[0].length;
          const range = new vscode.Range(i, start, i, end);

          const diagnostic = new vscode.Diagnostic(
            range,
            `Cannot find variable '$${variableName}' in '${namespace}'`,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostic.source = "SCSS Navigator";
          diagnostics.push(diagnostic);
        }
      }
    }

    const varNoNsRegex = /\$[\w-]+/g;
    let varNoNsMatch: RegExpExecArray | null;

    while ((varNoNsMatch = varNoNsRegex.exec(text)) !== null) {
      const fullMatch = varNoNsMatch[0];
      const variableName = fullMatch.substring(1);

      const charBefore =
        varNoNsMatch.index > 0 ? text[varNoNsMatch.index - 1] : "";
      if (charBefore === ".") {
        continue;
      }

      const noNamespaceImports = imports.filter(
        (imp) => imp.namespace === null
      );
      if (noNamespaceImports.length > 0) {
        let found = false;

        for (const importInfo of noNamespaceImports) {
          const location = await findDefinitionInFile(
            importInfo.filePath,
            variableName,
            "variable",
            aliasMap,
            repositoryPath
          );

          if (location) {
            found = true;
            break;
          }
        }

        if (!found) {
          const varDefRegex = new RegExp(`\\$${variableName}\\s*:`);
          let isDefinedInCurrentFile = false;

          for (let j = 0; j < document.lineCount; j++) {
            if (varDefRegex.test(document.lineAt(j).text)) {
              isDefinedInCurrentFile = true;
              break;
            }
          }

          if (!isDefinedInCurrentFile) {
            const start = varNoNsMatch.index;
            const end = start + fullMatch.length;
            const range = new vscode.Range(i, start, i, end);

            const diagnostic = new vscode.Diagnostic(
              range,
              `Cannot find variable '${fullMatch}'`,
              vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = "SCSS Navigator";
            diagnostics.push(diagnostic);
          }
        }
      }
    }

    const mixinRegex = /@include\s+([\w-]+)\.([\w-]+)/g;
    let mixinMatch: RegExpExecArray | null;

    while ((mixinMatch = mixinRegex.exec(text)) !== null) {
      const namespace = mixinMatch[1];
      const mixinName = mixinMatch[2];

      const importInfo = imports.find((imp) => imp.namespace === namespace);
      if (importInfo) {
        const location = await findDefinitionInFile(
          importInfo.filePath,
          mixinName,
          "mixin",
          aliasMap,
          repositoryPath
        );

        if (!location) {
          const start = mixinMatch.index;
          const end = start + mixinMatch[0].length;
          const range = new vscode.Range(i, start, i, end);

          const diagnostic = new vscode.Diagnostic(
            range,
            `Cannot find mixin '${mixinName}' in '${namespace}'`,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostic.source = "SCSS Navigator";
          diagnostics.push(diagnostic);
        }
      }
    }

    const mixinNoNsRegex = /@include\s+([\w-]+)/g;
    let mixinNoNsMatch: RegExpExecArray | null;

    while ((mixinNoNsMatch = mixinNoNsRegex.exec(text)) !== null) {
      const mixinName = mixinNoNsMatch[1];

      const fullMatch = mixinNoNsMatch[0];
      const afterMixinName = mixinNoNsMatch.index + fullMatch.length;
      if (afterMixinName < text.length && text[afterMixinName] === ".") {
        continue;
      }

      const noNamespaceImports = imports.filter(
        (imp) => imp.namespace === null
      );

      if (noNamespaceImports.length > 0) {
        let found = false;

        for (const importInfo of noNamespaceImports) {
          const location = await findDefinitionInFile(
            importInfo.filePath,
            mixinName,
            "mixin",
            aliasMap,
            repositoryPath
          );

          if (location) {
            found = true;
            break;
          }
        }

        if (!found) {
          const mixinDefRegex = new RegExp(`@mixin\\s+${mixinName}\\s*[({]`);
          let isDefinedInCurrentFile = false;

          for (let j = 0; j < document.lineCount; j++) {
            if (mixinDefRegex.test(document.lineAt(j).text)) {
              isDefinedInCurrentFile = true;
              break;
            }
          }

          if (!isDefinedInCurrentFile) {
            const start = mixinNoNsMatch.index;
            const end = start + fullMatch.length;
            const range = new vscode.Range(i, start, i, end);

            const diagnostic = new vscode.Diagnostic(
              range,
              `Cannot find mixin '${mixinName}'`,
              vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = "SCSS Navigator";
            diagnostics.push(diagnostic);
          }
        }
      }
    }

    const funcRegex = /([\w-]+)\.([\w-]+)\s*\(/g;
    let funcMatch: RegExpExecArray | null;

    while ((funcMatch = funcRegex.exec(text)) !== null) {
      const namespace = funcMatch[1];
      const functionName = funcMatch[2];

      const importInfo = imports.find((imp) => imp.namespace === namespace);
      if (importInfo) {
        const location = await findDefinitionInFile(
          importInfo.filePath,
          functionName,
          "function",
          aliasMap,
          repositoryPath
        );

        if (!location) {
          const start = funcMatch.index;
          const end = start + namespace.length + 1 + functionName.length;
          const range = new vscode.Range(i, start, i, end);

          const diagnostic = new vscode.Diagnostic(
            range,
            `Cannot find function '${functionName}' in '${namespace}'`,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostic.source = "SCSS Navigator";
          diagnostics.push(diagnostic);
        }
      }
    }

    const funcNoNsRegex = /([\w-]+)\s*\(/g;
    let funcNoNsMatch: RegExpExecArray | null;

    while ((funcNoNsMatch = funcNoNsRegex.exec(text)) !== null) {
      const functionName = funcNoNsMatch[1];

      const charBefore =
        funcNoNsMatch.index > 0 ? text[funcNoNsMatch.index - 1] : "";
      if (charBefore === ".") {
        continue;
      }

      const cssBuiltins = [
        "calc",
        "var",
        "rgb",
        "rgba",
        "hsl",
        "hsla",
        "url",
        "linear-gradient",
        "radial-gradient",
        "if",
        "not",
        "and",
        "or",
      ];
      if (cssBuiltins.includes(functionName)) {
        continue;
      }

      const noNamespaceImports = imports.filter(
        (imp) => imp.namespace === null
      );

      if (noNamespaceImports.length > 0) {
        let found = false;

        for (const importInfo of noNamespaceImports) {
          const location = await findDefinitionInFile(
            importInfo.filePath,
            functionName,
            "function",
            aliasMap,
            repositoryPath
          );

          if (location) {
            found = true;
            break;
          }
        }

        if (!found) {
          const funcDefRegex = new RegExp(
            `@function\\s+${functionName}\\s*\\(`
          );
          let isDefinedInCurrentFile = false;

          for (let j = 0; j < document.lineCount; j++) {
            if (funcDefRegex.test(document.lineAt(j).text)) {
              isDefinedInCurrentFile = true;
              break;
            }
          }

          if (!isDefinedInCurrentFile) {
            const start = funcNoNsMatch.index;
            const end = start + functionName.length;
            const range = new vscode.Range(i, start, i, end);

            const diagnostic = new vscode.Diagnostic(
              range,
              `Cannot find function '${functionName}'`,
              vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = "SCSS Navigator";
            diagnostics.push(diagnostic);
          }
        }
      }
    }
  }

  return diagnostics;
}
