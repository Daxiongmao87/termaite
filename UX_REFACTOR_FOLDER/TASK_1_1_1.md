# Task 1.1.1: Create Monorepo Structure

## Overview
Create the root workspace configuration for the monorepo structure that will house both the CLI and Core packages.

## Objective
Set up a monorepo workspace that manages both `packages/cli` and `packages/core` with shared dependencies and build tools.

## Files to Create/Modify

### 1. Root package.json
**File**: `/package.json`
**Content Requirements**:
- Workspace configuration for packages/cli and packages/core
- Development dependencies for build tools
- Scripts for workspace management
- Node.js version requirements

```json
{
  "name": "termaite-workspace",
  "version": "2.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "npm run build --workspaces",
    "dev": "npm run dev --workspaces",
    "test": "npm run test --workspaces",
    "clean": "rimraf packages/*/dist packages/*/build node_modules/.cache",
    "install-all": "npm install --workspaces"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "esbuild": "^0.19.0",
    "rimraf": "^5.0.0",
    "concurrently": "^8.0.0",
    "nodemon": "^3.0.0"
  }
}
```

### 2. TypeScript Configuration
**File**: `/tsconfig.json`
**Content Requirements**:
- Base TypeScript configuration
- Project references for packages
- Shared compiler options

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "incremental": true
  },
  "references": [
    { "path": "./packages/cli" },
    { "path": "./packages/core" }
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build"
  ]
}
```

### 3. Build Configuration
**File**: `/esbuild.config.js`
**Content Requirements**:
- ESBuild configuration for both packages
- Development and production builds
- Watch mode for development

```javascript
const esbuild = require('esbuild');
const path = require('path');

const baseConfig = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: true,
  external: ['react', 'ink'],
};

const cliConfig = {
  ...baseConfig,
  entryPoints: ['packages/cli/src/main.tsx'],
  outfile: 'packages/cli/dist/cli.js',
  jsx: 'automatic',
  jsxImportSource: 'react',
};

const coreConfig = {
  ...baseConfig,
  entryPoints: ['packages/core/src/index.ts'],
  outfile: 'packages/core/dist/core.js',
};

async function build() {
  try {
    await Promise.all([
      esbuild.build(cliConfig),
      esbuild.build(coreConfig)
    ]);
    console.log('Build completed successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  build();
}

module.exports = { cliConfig, coreConfig, build };
```

### 4. Update .gitignore
**File**: `/.gitignore`
**Add these entries**:
```gitignore
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tsbuildinfo

# Cache
.cache/
.npm/
.yarn/

# IDE
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Temporary files
.tmp/
temp/

# Package manager files
package-lock.json
yarn.lock
pnpm-lock.yaml
```

### 5. Development Scripts
**File**: `/scripts/dev.js`
**Content Requirements**:
- Development server script
- Watch mode for both packages
- Live reload capabilities

```javascript
const concurrently = require('concurrently');
const path = require('path');

const { result } = concurrently([
  {
    command: 'npm run dev',
    cwd: path.join(__dirname, '../packages/core'),
    name: 'core',
    prefixColor: 'blue'
  },
  {
    command: 'npm run dev',
    cwd: path.join(__dirname, '../packages/cli'),
    name: 'cli',
    prefixColor: 'green'
  }
], {
  prefix: 'name',
  killOthers: ['failure', 'success'],
  restartTries: 3,
});

result.catch((error) => {
  console.error('Development server failed:', error);
  process.exit(1);
});
```

## Dependencies to Install
```bash
npm install --save-dev @types/node typescript esbuild rimraf concurrently nodemon
```

## Validation Criteria

### 1. Structure Validation
- [ ] Root package.json exists with workspace configuration
- [ ] TypeScript configuration is valid
- [ ] ESBuild configuration compiles without errors
- [ ] .gitignore properly excludes build artifacts

### 2. Workspace Functionality
- [ ] `npm install` completes successfully from root
- [ ] `npm run clean` removes all build artifacts
- [ ] Workspace commands work (`npm run build --workspaces`)
- [ ] TypeScript project references resolve correctly

### 3. Build System
- [ ] ESBuild configuration is valid
- [ ] Build script runs without errors
- [ ] Development scripts are executable
- [ ] Watch mode functionality works

## Success Criteria
- Monorepo structure is created and functional
- Workspace management works correctly
- Build system is configured and operational
- Development environment is ready for package creation

## Next Task
After completion, proceed to **Task 1.1.2: Create CLI Package Structure**

## Notes
- Ensure Node.js version 18+ is installed
- Test workspace functionality before proceeding
- Verify all scripts work as expected
- Document any deviations from the plan
