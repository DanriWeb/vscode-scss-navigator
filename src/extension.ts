import * as vscode from "vscode";
import * as path from "path";
import {
  RepositoryContext,
  RepositoryContextMap,
  RepositoryPathConfig,
} from "./types";
import {
  readTsConfig,
  readTsConfigWithReferences,
  extractPathAliases,
  findTsConfigInDirectory,
} from "./tsconfig-parser";

/**
 * Loads repository contexts from settings
 */
async function loadRepositoryContexts(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<RepositoryContextMap> {
  const config = vscode.workspace.getConfiguration("scssNavigator");
  const repoPaths = config.get<RepositoryPathConfig[]>("repositoryPaths", []);

  console.log(`Repository paths from config: ${JSON.stringify(repoPaths)}`);

  const configs = repoPaths.length > 0 ? repoPaths : ["."]; // Use current directory if no paths specified

  console.log(`Processing ${configs.length} configuration(s)`);

  const contexts: RepositoryContextMap = new Map();

  for (const configItem of configs) {
    let rootPath: string;
    let tsconfigPath: string | undefined;

    // Parse configuration item
    if (typeof configItem === "string") {
      rootPath = configItem;
      tsconfigPath = undefined;
    } else {
      rootPath = configItem.root;
      tsconfigPath = configItem.tsconfig;
    }

    const rootUri = vscode.Uri.joinPath(workspaceFolder.uri, rootPath);
    console.log(`Processing repository: ${rootUri.fsPath}`);

    let tsconfigUri: vscode.Uri | undefined;

    if (tsconfigPath) {
      const tsconfigFullUri = vscode.Uri.joinPath(
        workspaceFolder.uri,
        tsconfigPath
      );
      try {
        await vscode.workspace.fs.stat(tsconfigFullUri);
        tsconfigUri = tsconfigFullUri;
        console.log(`Using explicit tsconfig: ${tsconfigUri.fsPath}`);
      } catch (error) {
        console.warn(`tsconfig.json not found at: ${tsconfigFullUri.fsPath}`);
        continue;
      }
    } else {
      if (rootUri.fsPath.endsWith("tsconfig.json")) {
        try {
          await vscode.workspace.fs.stat(rootUri);
          tsconfigUri = rootUri;
          const actualRootUri = vscode.Uri.file(path.dirname(rootUri.fsPath));
          console.log(
            `Direct tsconfig path: ${tsconfigUri.fsPath}, root: ${actualRootUri.fsPath}`
          );

          const referencedConfigs = await readTsConfigWithReferences(
            tsconfigUri
          );
          const allAliases = await loadAliasesFromConfigs(referencedConfigs);

          if (allAliases.size > 0) {
            contexts.set(actualRootUri.fsPath, {
              rootPath: actualRootUri.fsPath,
              rootUri: actualRootUri,
              aliases: allAliases,
              tsconfigPaths: referencedConfigs,
            });
            console.log(
              `Repository context created for ${actualRootUri.fsPath} with ${allAliases.size} alias(es)`
            );
          }
          continue;
        } catch (error) {
          console.warn(`tsconfig.json not found at: ${rootUri.fsPath}`);
          continue;
        }
      } else {
        tsconfigUri = await findTsConfigInDirectory(rootUri);
        if (!tsconfigUri) {
          console.warn(`No tsconfig.json found in: ${rootUri.fsPath}`);
          continue;
        }
      }
    }

    const referencedConfigs = await readTsConfigWithReferences(tsconfigUri);
    console.log(
      `Found ${referencedConfigs.length} config(s) (including references) for ${rootUri.fsPath}`
    );

    const allAliases = await loadAliasesFromConfigs(referencedConfigs);

    if (allAliases.size > 0) {
      const context: RepositoryContext = {
        rootPath: rootUri.fsPath,
        rootUri: rootUri,
        aliases: allAliases,
        tsconfigPaths: referencedConfigs,
      };

      contexts.set(rootUri.fsPath, context);
      console.log(
        `Repository context created for ${rootUri.fsPath} with ${allAliases.size} alias(es)`
      );
    } else {
      console.warn(`No aliases found for ${rootUri.fsPath}`);
    }
  }

  return contexts;
}

/**
 * Loads aliases from multiple tsconfig files
 */
async function loadAliasesFromConfigs(
  configUris: vscode.Uri[]
): Promise<Map<string, string[]>> {
  const allAliases = new Map<string, string[]>();

  for (const configUri of configUris) {
    const tsconfig = await readTsConfig(configUri);
    if (tsconfig) {
      const aliases = extractPathAliases(tsconfig, configUri);
      if (aliases.size > 0) {
        console.log(
          `Extracted ${aliases.size} alias(es) from ${configUri.fsPath}`
        );
        for (const [pattern, paths] of aliases.entries()) {
          console.log(`  ${pattern} -> ${paths.join(", ")}`);
          allAliases.set(pattern, paths);
        }
      }
    }
  }

  return allAliases;
}

/**
 * Determines the repository context for a file
 */
export function getRepositoryContext(
  fileUri: vscode.Uri,
  contexts: RepositoryContextMap
): RepositoryContext | undefined {
  const filePath = fileUri.fsPath.toLowerCase();

  let bestMatch: RepositoryContext | undefined;
  let bestMatchLength = 0;

  for (const [rootPath, context] of contexts) {
    const normalizedRootPath = rootPath.toLowerCase();
    if (filePath.startsWith(normalizedRootPath)) {
      if (normalizedRootPath.length > bestMatchLength) {
        bestMatch = context;
        bestMatchLength = normalizedRootPath.length;
      }
    }
  }

  return bestMatch;
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("SCSS Navigator activated");

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    console.warn("No workspace folder found");
    return;
  }

  const repositoryContexts = await loadRepositoryContexts(workspaceFolder);

  console.log(`Loaded ${repositoryContexts.size} repository context(s):`);
  for (const [rootPath, ctx] of repositoryContexts) {
    console.log(`  - ${rootPath}: ${ctx.aliases.size} alias(es)`);
  }

  const { registerScssProviders, registerScssDiagnostics } = await import(
    "./scss-definition-provider.js"
  );
  const { ScssVariableDefinitionProvider } = await import(
    "./scss-variable-provider.js"
  );

  registerScssProviders(context, repositoryContexts);
  registerScssDiagnostics(context, repositoryContexts);

  const variableProvider = new ScssVariableDefinitionProvider(
    repositoryContexts
  );
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      ["scss", "sass"],
      variableProvider
    )
  );

  console.log("SCSS Navigator providers registered");
}

export function deactivate() {}
