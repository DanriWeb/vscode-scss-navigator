# 🧭 SCSS Navigator: Navigation for SCSS files in VS Code

[![Static Badge](https://img.shields.io/badge/Status-In_Development-yellow?style=for-the-badge&labelColor=black)](https://github.com/DanriWeb/vscode-scss-navigator)
[![Static Badge](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=black)](https://www.typescriptlang.org/)
[![Static Badge](https://img.shields.io/badge/VS_Code-1.104.0+-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white&labelColor=black)](https://code.visualstudio.com/)

**SCSS Navigator** is a Visual Studio Code extension that provides navigation support for SCSS/SASS files, including support for path aliases from `tsconfig.json`.

> **ℹ️ About the extension:**
> The extension automatically reads path aliases from `tsconfig.json` and allows you to navigate to SCSS module definitions, variables, and mixins using Ctrl+Click (or Cmd+Click on macOS).

---

## 🎯 Key Features

- ✅ **Navigation for `@use` and `@import`** — Jump to SCSS/SASS files by clicking on imports
- ✅ **Path Alias Support** — Automatically reads `paths` from `tsconfig.json`
- ✅ **Intelligent Autocomplete** — Suggestions for variables, mixins, functions, and path aliases
- ✅ **Recursive Symbol Search** — Supports `@forward` for re-exporting variables
- ✅ **Variable/Mixin/Function Navigation** — Jump to definitions with Ctrl+Click
- ✅ **Diagnostic** — Highlights non-existent files and broken imports
- ✅ **Monorepo Support** — Works with multiple `tsconfig.json` files
- ✅ **Project References** — Automatically reads related configurations

---

## 📑 Contents

- [1. Usage](#1-usage)
- [2. Configuration](#2-configuration)
- [3. License](#3-license)
- [4. Contacts](#4-contacts)

---

## 2. Usage

### Import Navigation

Hover over a path in `@use` or `@import` and press `Ctrl+Click` (or `Cmd+Click` on macOS):

```scss
@use "@/shared/styles/variables/colors"; // Ctrl+Click to jump
@import "~bootstrap/scss/functions"; // Tilde support
```

### Variable Navigation

Jump to variable definitions:

```scss
.button {
  color: $primary-color; // Ctrl+Click to jump to definition
}
```

### Mixin Navigation

Jump to mixin definitions:

```scss
.card {
  @include flex-center; // Ctrl+Click to jump to definition
}
```

### Function Navigation

Jump to function definitions:

```scss
.container {
  width: calculate-width(12); // Ctrl+Click to jump to definition
  padding: spacing(2); // Support for functions from imported modules
}
```

### Intelligent Autocomplete

The extension provides context-sensitive autocompletion for SCSS symbols:

- **Variables (`$`)**: Type `$` to see available variables from imported files (`@use`, `@import`, and `@forward` are supported).
- **Mixins (`@include`)**: Type `@include` to see available mixins.
- **Functions**: Type `()` and start typing the function name before `()` to see suggestions.
- **Path Aliases**: Type `@use "@` or `@import "~` to see available aliases from `tsconfig.json`.

```scss
@use "@/shared/styles/variables" as vars;

.container {
  // Autocomplete variables from 'vars' namespace
  color: vars.$px-20;

  // Autocomplete global variables
  padding: $spacing-md;
}
```

---

### Import Navigation / Definition

## 3. Configuration

### Automatic tsconfig.json Search

By default, the extension automatically looks for `tsconfig.json` in the workspace root.

> **Important:**
> The extension activates upon opening the first `.scss` or `.sass` file. If you change `scssNavigator.repositoryPaths` settings after files have already been opened, you must reload the VS Code window (`Ctrl+Shift+P` → `Developer: Reload Window`) to apply the changes.

### Monorepo Configuration

For monorepos, you can specify repository directories or use object configuration with explicit root and `tsconfig.json` paths:

**Option 1: Directories (auto-search tsconfig.json)**

```json
{
  "scssNavigator.repositoryPaths": ["./packages/frontend", "./packages/backend"]
}
```

The extension will automatically find `tsconfig.json` in each specified directory.

**Option 2: Object Configuration**

```json
{
  "scssNavigator.repositoryPaths": [
    {
      "root": "./packages/frontend",
      "tsconfig": "./packages/frontend/tsconfig.json"
    },
    {
      "root": "./packages/backend",
      "tsconfig": "./packages/backend/config/tsconfig.build.json"
    }
  ]
}
```

Useful when `tsconfig.json` is not in the repository root or a specific configuration is needed.

**Option 3: Mixed Usage**

```json
{
  "scssNavigator.repositoryPaths": [
    "./packages/frontend",
    {
      "root": "./packages/backend",
      "tsconfig": "./packages/backend/config/tsconfig.build.json"
    }
  ]
}
```

**Benefits:**

- ✅ Isolated aliases for each repository
- ✅ Separate caching for better performance
- ✅ Support for conflicting aliases (e.g., `@/*` in different repositories)
- ✅ Flexibility in TypeScript configuration selection
- ✅ Explicit repository root and tsconfig path definition

### Example tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["src/shared/*"],
      "~bootstrap/*": ["node_modules/bootstrap/*"]
    }
  }
}
```

---

## 4. License

This project is licensed under the **MIT** License.

---

## 5. Contacts

I am open to new proposals and career opportunities. If you are interested in my experience or have a suitable vacancy, I would be happy to discuss cooperation.

You can contact me via the following channels:

| Channel         | Link / ID                                                                           |
| :-------------- | :---------------------------------------------------------------------------------- |
| **Telegram**    | [**@danriweb_online**](https://t.me/danriweb_online)                                |
| **Email**       | [danri.web@gmail.com](mailto:danri.web@gmail.com)                                   |
| **HeadHunter**  | [Resume on HeadHunter](https://hh.ru/resume/741ea29dff0f262c1c0039ed1f7730326d694e) |
| **Habr Career** | [Profile on Habr Career](https://career.habr.com/danriweb)                          |

---

**Creation Date:** December 27, 2025
