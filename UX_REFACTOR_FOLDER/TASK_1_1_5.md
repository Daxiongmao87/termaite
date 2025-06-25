# Task 1.1.5: Configure Development Environment

## Overview
Configure the development environment including IDE settings, Git configuration, and workspace tools for optimal developer experience.

## Objective
Set up comprehensive development environment configuration that supports the monorepo structure, TypeScript development, and debugging.

## Files to Create/Modify

### 1. VSCode Workspace Configuration
**File**: `/termaite.code-workspace`
**Content Requirements**:
- Multi-root workspace configuration
- Package-specific settings
- Recommended extensions

```json
{
  "folders": [
    {
      "name": "🏠 Root",
      "path": "."
    },
    {
      "name": "🎨 CLI Package",
      "path": "./packages/cli"
    },
    {
      "name": "⚙️ Core Package", 
      "path": "./packages/core"
    }
  ],
  "settings": {
    "typescript.preferences.includePackageJsonAutoImports": "auto",
    "typescript.preferences.includeCompletionsWithSnippetText": true,
    "typescript.suggest.paths": true,
    "typescript.updateImportsOnFileMove.enabled": "always",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": true,
      "source.organizeImports": true
    },
    "files.associations": {
      "*.ts": "typescript",
      "*.tsx": "typescriptreact"
    },
    "search.exclude": {
      "**/node_modules": true,
      "**/dist": true,
      "**/.git": true,
      "**/coverage": true
    },
    "files.exclude": {
      "**/dist": true,
      "**/node_modules": true
    }
  },
  "extensions": {
    "recommendations": [
      "ms-vscode.vscode-typescript-next",
      "bradlc.vscode-tailwindcss",
      "esbenp.prettier-vscode",
      "dbaeumer.vscode-eslint",
      "ms-vscode.vscode-json"
    ]
  },
  "tasks": {
    "version": "2.0.0",
    "tasks": [
      {
        "label": "Build All Packages",
        "type": "shell",
        "command": "npm run build",
        "group": {
          "kind": "build",
          "isDefault": true
        },
        "presentation": {
          "echo": true,
          "reveal": "always",
          "focus": false,
          "panel": "shared"
        }
      },
      {
        "label": "Watch Build",
        "type": "shell", 
        "command": "npm run build:watch",
        "group": "build",
        "isBackground": true,
        "presentation": {
          "echo": true,
          "reveal": "always",
          "focus": false,
          "panel": "shared"
        }
      },
      {
        "label": "Run CLI",
        "type": "shell",
        "command": "npm run dev:cli",
        "group": "test",
        "presentation": {
          "echo": true,
          "reveal": "always",
          "focus": true,
          "panel": "new"
        }
      }
    ]
  }
}
```

### 2. Update .gitignore for Monorepo
**File**: `/.gitignore`
**Content Requirements**:
- Ignore build artifacts for all packages
- Node.js and IDE specific ignores
- OS specific ignores

```gitignore
# Dependencies
node_modules/
*/node_modules/
packages/*/node_modules/

# Build outputs
dist/
build/
packages/*/dist/
packages/*/build/

# TypeScript
*.tsbuildinfo

# IDE files
.vscode/settings.json
.vscode/launch.json
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Coverage
coverage/
*.lcov
.nyc_output

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Cache
.cache/
.parcel-cache/
.eslintcache

# Temporary files
tmp/
temp/
*.tmp
*.temp

# Package manager lockfiles (keep package-lock.json)
yarn.lock
pnpm-lock.yaml

# Testing
test-results/
playwright-report/

# Build tools
.esbuild/
```

### 3. ESLint Configuration
**File**: `/.eslintrc.js`
**Content Requirements**:
- TypeScript support
- React/JSX support for CLI package
- Shared rules across packages

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./packages/*/tsconfig.json'],
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['packages/cli/src/**/*.{ts,tsx}'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      plugins: ['react', 'react-hooks'],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'react/prop-types': 'off',
        'react/react-in-jsx-scope': 'off',
      },
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
```

### 4. Prettier Configuration
**File**: `/.prettierrc.js`
**Content Requirements**:
- Consistent code formatting
- TypeScript and JSX support

```javascript
module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 200,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'always',
      },
    },
  ],
};
```

### 5. Editor Configuration
**File**: `/.editorconfig`
**Content Requirements**:
- Consistent editor settings
- Cross-platform compatibility

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[*.json]
indent_size = 2

[*.{yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
```

### 6. Debug Configuration
**File**: `/.vscode/launch.json`
**Content Requirements**:
- TypeScript debugging support
- Package-specific debug configurations

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug CLI",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/packages/cli/dist/index.js",
      "args": ["test", "task"],
      "outFiles": ["${workspaceFolder}/packages/cli/dist/**/*.js"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "preLaunchTask": "Build All Packages"
    },
    {
      "name": "Debug Core Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run", "--reporter=verbose"],
      "cwd": "${workspaceFolder}/packages/core",
      "outFiles": ["${workspaceFolder}/packages/core/dist/**/*.js"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug CLI Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run", "--reporter=verbose"],
      "cwd": "${workspaceFolder}/packages/cli",
      "outFiles": ["${workspaceFolder}/packages/cli/dist/**/*.js"],
      "console": "integratedTerminal"
    }
  ]
}
```

## Implementation Steps

1. **Create VSCode workspace configuration**
   - Set up multi-root workspace
   - Configure TypeScript settings
   - Add recommended extensions

2. **Update Git configuration**
   - Update .gitignore for monorepo
   - Ignore build artifacts and dependencies
   - Add OS and IDE specific ignores

3. **Set up linting and formatting**
   - Create ESLint configuration
   - Add Prettier configuration
   - Set up editor config

4. **Configure debugging**
   - Set up VSCode debug configurations
   - Add build tasks
   - Configure test debugging

5. **Test development environment**
   - Verify TypeScript intellisense works
   - Test debugging capabilities
   - Validate linting and formatting

## Validation Criteria

### ✅ VSCode Integration
- [ ] Workspace opens correctly with folder structure
- [ ] TypeScript intellisense works across packages
- [ ] Build tasks execute successfully
- [ ] Debugging configurations work

### ✅ Code Quality Tools
- [ ] ESLint runs without errors on sample code
- [ ] Prettier formats code consistently
- [ ] EditorConfig settings apply correctly
- [ ] Cross-package imports are linted correctly

### ✅ Git Configuration
- [ ] .gitignore properly excludes build artifacts
- [ ] .gitignore excludes node_modules in all packages
- [ ] Repository remains clean after builds
- [ ] IDE files are properly ignored

### ✅ Development Workflow
- [ ] Auto-imports work between packages
- [ ] Code formatting happens on save
- [ ] Build errors are clearly displayed
- [ ] Watch mode works smoothly

## Dependencies Required
- @typescript-eslint/eslint-plugin
- @typescript-eslint/parser
- eslint-plugin-react (for CLI package)
- eslint-plugin-react-hooks (for CLI package)
- prettier

## Success Criteria
✅ **Complete development environment that provides excellent developer experience with proper tooling, debugging, and code quality enforcement.**

## Notes for AI Implementation
- Test VSCode workspace configuration thoroughly
- Ensure debugging works for both packages
- Validate that linting catches common issues
- Test auto-imports between packages
- Verify that formatting is consistent
