import * as vscode from "vscode";
import { ScssSymbol } from "./types";

interface ScssImport {
  filePath: string;
  namespace: string | null;
}

/**
 * Cache for SCSS navigation to speed up repeated lookups
 * Supports per-repository caching for monorepo setups
 */
class ScssCache {
  private importsCache = new Map<string, Map<string, ScssImport[]>>();
  private definitionsCache = new Map<
    string,
    Map<string, vscode.Location | null>
  >();
  private forwardCache = new Map<string, Map<string, string[]>>();
  private symbolsCache = new Map<string, Map<string, ScssSymbol[]>>();

  private hits = 0;
  private misses = 0;

  /**
   * Returns the imports cache for a repository
   */
  private getRepositoryImportsCache(
    repositoryPath: string
  ): Map<string, ScssImport[]> {
    if (!this.importsCache.has(repositoryPath)) {
      this.importsCache.set(repositoryPath, new Map());
    }
    return this.importsCache.get(repositoryPath)!;
  }

  /**
   * Returns the definitions cache for a repository
   */
  private getRepositoryDefinitionsCache(
    repositoryPath: string
  ): Map<string, vscode.Location | null> {
    if (!this.definitionsCache.has(repositoryPath)) {
      this.definitionsCache.set(repositoryPath, new Map());
    }
    return this.definitionsCache.get(repositoryPath)!;
  }

  /**
   * Returns the forwards cache for a repository
   */
  private getRepositoryForwardCache(
    repositoryPath: string
  ): Map<string, string[]> {
    if (!this.forwardCache.has(repositoryPath)) {
      this.forwardCache.set(repositoryPath, new Map());
    }
    return this.forwardCache.get(repositoryPath)!;
  }

  /**
   * Returns the symbols cache for a repository
   */
  private getRepositorySymbolsCache(
    repositoryPath: string
  ): Map<string, ScssSymbol[]> {
    if (!this.symbolsCache.has(repositoryPath)) {
      this.symbolsCache.set(repositoryPath, new Map());
    }
    return this.symbolsCache.get(repositoryPath)!;
  }

  getImports(repositoryPath: string, uri: string): ScssImport[] | undefined {
    const cache = this.getRepositoryImportsCache(repositoryPath);
    const cached = cache.get(uri);
    if (cached) {
      this.hits++;
    } else {
      this.misses++;
    }
    return cached;
  }

  setImports(repositoryPath: string, uri: string, imports: ScssImport[]): void {
    const cache = this.getRepositoryImportsCache(repositoryPath);
    cache.set(uri, imports);
  }

  getDefinition(
    repositoryPath: string,
    key: string
  ): vscode.Location | null | undefined {
    const cache = this.getRepositoryDefinitionsCache(repositoryPath);
    const cached = cache.get(key);
    if (cached !== undefined) {
      this.hits++;
    } else {
      this.misses++;
    }
    return cached;
  }

  setDefinition(
    repositoryPath: string,
    key: string,
    location: vscode.Location | null
  ): void {
    const cache = this.getRepositoryDefinitionsCache(repositoryPath);
    cache.set(key, location);
  }

  getForwards(repositoryPath: string, filePath: string): string[] | undefined {
    const cache = this.getRepositoryForwardCache(repositoryPath);
    return cache.get(filePath);
  }

  setForwards(
    repositoryPath: string,
    filePath: string,
    forwards: string[]
  ): void {
    const cache = this.getRepositoryForwardCache(repositoryPath);
    cache.set(filePath, forwards);
  }

  getSymbols(
    repositoryPath: string,
    filePath: string
  ): ScssSymbol[] | undefined {
    const cache = this.getRepositorySymbolsCache(repositoryPath);
    const cached = cache.get(filePath);
    if (cached) {
      this.hits++;
    } else {
      this.misses++;
    }
    return cached;
  }

  setSymbols(
    repositoryPath: string,
    filePath: string,
    symbols: ScssSymbol[]
  ): void {
    const cache = this.getRepositorySymbolsCache(repositoryPath);
    cache.set(filePath, symbols);
  }

  invalidateFile(repositoryPath: string, uri: string): void {
    const importsCache = this.getRepositoryImportsCache(repositoryPath);
    const definitionsCache = this.getRepositoryDefinitionsCache(repositoryPath);
    const forwardCache = this.getRepositoryForwardCache(repositoryPath);
    const symbolsCache = this.getRepositorySymbolsCache(repositoryPath);

    importsCache.delete(uri);

    for (const [key] of definitionsCache) {
      if (key.startsWith(uri + ":")) {
        definitionsCache.delete(key);
      }
    }

    forwardCache.delete(uri);
    symbolsCache.delete(uri);
  }

  invalidateRepository(repositoryPath: string): void {
    this.importsCache.delete(repositoryPath);
    this.definitionsCache.delete(repositoryPath);
    this.forwardCache.delete(repositoryPath);
    this.symbolsCache.delete(repositoryPath);
  }

  clear(): void {
    this.importsCache.clear();
    this.definitionsCache.clear();
    this.forwardCache.clear();
    this.symbolsCache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    let totalImports = 0;
    let totalDefinitions = 0;
    let totalForwards = 0;
    let totalSymbols = 0;

    for (const cache of this.importsCache.values()) {
      totalImports += cache.size;
    }
    for (const cache of this.definitionsCache.values()) {
      totalDefinitions += cache.size;
    }
    for (const cache of this.forwardCache.values()) {
      totalForwards += cache.size;
    }
    for (const cache of this.symbolsCache.values()) {
      totalSymbols += cache.size;
    }

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "0%",
      repositories: this.importsCache.size,
      size: {
        imports: totalImports,
        definitions: totalDefinitions,
        forwards: totalForwards,
        symbols: totalSymbols,
      },
    };
  }
}

export const scssCache = new ScssCache();
export type { ScssImport };
