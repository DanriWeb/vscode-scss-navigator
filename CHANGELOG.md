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

## [1.0.2] - 2025-12-28

### Changed

- Lowered minimum VS Code version requirement to ^1.90.0 for better compatibility.

### Fixed

- Fixed false positive diagnostics for built-in Sass modules (e.g., `sass:math`, `sass:color`).

## [1.1.0] - 2025-12-28

### Added

- Added autocompletion for the aliases themselves.

## [1.2.0] - December 28, 2025

### Added

- **Smart autocomplete:**

- Variables (`$var`), mixins (`@include mixin`), and functions ().
- Context-sensitive suggestions (testing stage)
- Automatic function insertion before ()
- Support for re-exporting variables via `@forward` (recursive symbol search).

- **Improved DX:**

- Duplicate symbol removal.
- Correct text replacement when entering variables (e.g., correct handling of `$var-name`).
- Icons for different symbol types.
