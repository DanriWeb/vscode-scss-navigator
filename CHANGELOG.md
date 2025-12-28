# Change Log

All notable changes to the "vscode-scss-navigator" extension will be documented in this file.

## [1.0.1] - 2025-12-28

### Added

- Navigation support for `@use`, `@forward` and `@import` in SCSS/SASS files.
- Path alias resolution from `tsconfig.json`.
- Go to Definition for SCSS variables, mixins, and functions.
- **Monorepo support:**
  - Multiple `tsconfig.json` configurations via `scssNavigator.repositoryPaths`.
  - Isolated caching and alias resolution for each repository.
  - Support for object-based configuration with explicit `root` and `tsconfig` paths.
- Diagnostic support (highlighting broken imports).

### Changed

- Localized README and package configuration to English.
- Updated extension configuration structure for better flexibility.
