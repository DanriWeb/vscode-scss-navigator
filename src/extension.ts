import * as vscode from "vscode";
import { PathAliasMap } from "./types";
import {
  readTsConfig,
  readTsConfigWithReferences,
  extractPathAliases,
  mergeAliasMaps,
} from "./tsconfig-parser";

async function findTsConfig(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<vscode.Uri | undefined> {
  const tsconfigPath = vscode.Uri.joinPath(
    workspaceFolder.uri,
    "tsconfig.json"
  );

  try {
    await vscode.workspace.fs.stat(tsconfigPath);
    console.log(`tsconfig.json found: ${tsconfigPath.fsPath}`);

    return tsconfigPath;
  } catch (error) {
    console.log("tsconfig.json not found");

    return undefined;
  }
}

async function getTsConfigPaths(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<vscode.Uri[]> {
  const config = vscode.workspace.getConfiguration("scssNavigator");
  const tsconfigPaths = config.get<string[]>("tsconfigPaths", []);

  const foundPaths = tsconfigPaths.map(async (path) => {
    const uri = vscode.Uri.joinPath(workspaceFolder.uri, path);
    try {
      await vscode.workspace.fs.stat(uri);

      return uri;
    } catch (error) {
      console.log(`tsconfig.json not found: ${uri.fsPath}`);
      return undefined;
    }
  });

  const autoFound = await findTsConfig(workspaceFolder);
  return autoFound ? [autoFound] : [];
}

/**
 * SCSS Navigator activation
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log("SCSS Navigator activated");

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0] || null;

  if (workspaceFolder) {
    const tsconfigPaths = await getTsConfigPaths(workspaceFolder);

    const aliasMaps: PathAliasMap[] = [];
    const allTsconfigUris: vscode.Uri[] = [];

    for (const tsconfigUri of tsconfigPaths) {
      console.log(`Loading tsconfig: ${tsconfigUri.fsPath}`);

      const referencedConfigs = await readTsConfigWithReferences(tsconfigUri);
      allTsconfigUris.push(...referencedConfigs);

      console.log(
        `Found ${referencedConfigs.length} config(s) (including references)`
      );
    }

    const uniqueConfigs = Array.from(
      new Map(
        allTsconfigUris.map((uri) => [uri.fsPath.toLowerCase(), uri])
      ).values()
    );

    for (const tsconfigUri of uniqueConfigs) {
      const tsconfig = await readTsConfig(tsconfigUri);
      if (tsconfig) {
        const aliases = extractPathAliases(tsconfig, tsconfigUri);

        if (aliases.size > 0) {
          aliasMaps.push(aliases);

          console.log(
            `Extracted ${aliases.size} alias(es) from ${tsconfigUri.fsPath}`
          );

          for (const [pattern, paths] of aliases.entries()) {
            console.log(`  ${pattern} -> ${paths.join(", ")}`);
          }
        }
      }
    }

    const mergedAliases = mergeAliasMaps(...aliasMaps);
    console.log(`Total aliases after merging: ${mergedAliases.size}`);

    const { registerScssProviders } = await import(
      "./scss-definition-provider.js"
    );
    registerScssProviders(context, mergedAliases);

    console.log("SCSS providers registered");
  }
}

export function deactivate() {}
