import * as vscode from "vscode";

interface ScssImport {
  filePath: string;
  namespace: string | null;
}

/**
 * Cache for SCSS navigation to speed up repeated lookups
 */
class ScssCache {
  private importsCache = new Map<string, ScssImport[]>();
  private definitionsCache = new Map<string, vscode.Location | null>();
  private forwardCache = new Map<string, string[]>();

  private hits = 0;
  private misses = 0;

  getImports(uri: string): ScssImport[] | undefined {
    const cached = this.importsCache.get(uri);
    if (cached) {
      this.hits++;
    } else {
      this.misses++;
    }
    return cached;
  }

  setImports(uri: string, imports: ScssImport[]): void {
    this.importsCache.set(uri, imports);
  }

  getDefinition(key: string): vscode.Location | null | undefined {
    const cached = this.definitionsCache.get(key);
    if (cached !== undefined) {
      this.hits++;
    } else {
      this.misses++;
    }
    return cached;
  }

  setDefinition(key: string, location: vscode.Location | null): void {
    this.definitionsCache.set(key, location);
  }

  getForwards(filePath: string): string[] | undefined {
    return this.forwardCache.get(filePath);
  }

  setForwards(filePath: string, forwards: string[]): void {
    this.forwardCache.set(filePath, forwards);
  }

  invalidateFile(uri: string): void {
    this.importsCache.delete(uri);

    for (const [key] of this.definitionsCache) {
      if (key.startsWith(uri + ":")) {
        this.definitionsCache.delete(key);
      }
    }

    this.forwardCache.delete(uri);
  }

  clear(): void {
    this.importsCache.clear();
    this.definitionsCache.clear();
    this.forwardCache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "0%",
      size: {
        imports: this.importsCache.size,
        definitions: this.definitionsCache.size,
        forwards: this.forwardCache.size,
      },
    };
  }
}

export const scssCache = new ScssCache();
export type { ScssImport };
