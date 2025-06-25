# Task 1.1.4: Setup Build Configuration

## Overview
Create build configuration using esbuild for fast compilation of both CLI and Core packages.

## Objective
Set up efficient build tools that can compile TypeScript for both packages, handle bundling, and provide development/production builds.

## Files to Create/Modify

### 1. ESBuild Configuration
**File**: `/esbuild.config.js`
**Content Requirements**:
- Build configuration for both packages
- Development and production modes
- TypeScript compilation
- Bundle optimization

```javascript
const esbuild = require('esbuild');
const path = require('path');

const buildPackage = async (packageName, options = {}) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return esbuild.build({
    entryPoints: [`packages/${packageName}/src/index.ts`],
    bundle: true,
    outdir: `packages/${packageName}/dist`,
    platform: packageName === 'cli' ? 'node' : 'node',
    target: 'node18',
    format: packageName === 'cli' ? 'cjs' : 'cjs',
    sourcemap: !isProduction,
    minify: isProduction,
    external: packageName === 'cli' ? ['react', 'ink'] : [],
    ...options
  });
};

const buildAll = async () => {
  try {
    await Promise.all([
      buildPackage('cli'),
      buildPackage('core')
    ]);
    console.log('✅ All packages built successfully');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  buildAll();
}

module.exports = { buildPackage, buildAll };
```

### 2. Update Root Package.json Scripts
**File**: `/package.json`
**Modifications**:
- Add build scripts
- Add development scripts
- Add clean scripts

```json
{
  "scripts": {
    "build": "node esbuild.config.js",
    "build:dev": "NODE_ENV=development node esbuild.config.js",
    "build:prod": "NODE_ENV=production node esbuild.config.js",
    "build:watch": "node scripts/watch.js",
    "clean": "rimraf packages/*/dist packages/*/node_modules/.cache",
    "dev:cli": "npm run build:dev && node packages/cli/dist/index.js",
    "dev:core": "npm run build:dev",
    "lint": "eslint packages/*/src/**/*.{ts,tsx}",
    "type-check": "npm run type-check --workspaces",
    "install:all": "npm install && npm install --workspaces"
  }
}
```

### 3. Watch Script for Development
**File**: `/scripts/watch.js`
**Content Requirements**:
- File watching for development
- Automatic rebuilding
- Error handling

```javascript
const chokidar = require('chokidar');
const { buildPackage } = require('../esbuild.config.js');

console.log('🔄 Starting watch mode...');

const buildWithLogging = async (packageName) => {
  const start = Date.now();
  try {
    await buildPackage(packageName);
    console.log(`✅ ${packageName} built in ${Date.now() - start}ms`);
  } catch (error) {
    console.error(`❌ ${packageName} build failed:`, error.message);
  }
};

// Watch CLI package
chokidar.watch('packages/cli/src/**/*.{ts,tsx}', {
  ignored: /node_modules/,
  persistent: true
}).on('change', () => buildWithLogging('cli'));

// Watch Core package  
chokidar.watch('packages/core/src/**/*.{ts,tsx}', {
  ignored: /node_modules/,
  persistent: true
}).on('change', () => buildWithLogging('core'));

// Initial build
buildWithLogging('cli');
buildWithLogging('core');
```

### 4. TypeScript Configuration for Workspace
**File**: `/tsconfig.json`
**Content Requirements**:
- Workspace-level TypeScript configuration
- Path mapping for packages
- Build references

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs", 
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@termaite/core": ["./packages/core/src"],
      "@termaite/core/*": ["./packages/core/src/*"],
      "@termaite/cli": ["./packages/cli/src"],
      "@termaite/cli/*": ["./packages/cli/src/*"]
    }
  },
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/cli" }
  ],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### 5. Development Dependencies
**Dependencies to Add to Root Package.json**:
```json
{
  "devDependencies": {
    "esbuild": "^0.19.0",
    "chokidar": "^3.5.3",
    "rimraf": "^5.0.5",
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0"
  }
}
```

## Implementation Steps

1. **Create esbuild.config.js**
   - Implement build configuration for both packages
   - Add development and production modes
   - Configure TypeScript compilation

2. **Create watch script**
   - Set up file watching for development
   - Implement automatic rebuilding
   - Add error handling and logging

3. **Update root package.json**
   - Add build scripts
   - Add development dependencies
   - Configure workspace scripts

4. **Create workspace TypeScript config**
   - Set up path mapping
   - Configure build references
   - Add strict type checking

5. **Test build configuration**
   - Verify builds work for both packages
   - Test watch mode functionality
   - Validate TypeScript compilation

## Validation Criteria

### ✅ Build Configuration Working
- [ ] `npm run build` successfully builds both packages
- [ ] `npm run build:dev` creates development builds
- [ ] `npm run build:prod` creates optimized production builds
- [ ] Build outputs are created in correct directories

### ✅ Development Environment
- [ ] `npm run build:watch` starts watch mode
- [ ] File changes trigger automatic rebuilds
- [ ] TypeScript compilation errors are shown clearly
- [ ] Build times are reasonable (< 2 seconds for incremental)

### ✅ TypeScript Configuration
- [ ] TypeScript compiles without errors
- [ ] Path mapping works for cross-package imports
- [ ] Type checking works across packages
- [ ] IDE intellisense works correctly

### ✅ Scripts and Dependencies
- [ ] All npm scripts execute without errors
- [ ] Dependencies install correctly
- [ ] Clean script removes build artifacts
- [ ] Linting works across packages

## Dependencies Required
- esbuild (bundling)
- chokidar (file watching)
- rimraf (cleaning)
- typescript (type checking)
- @types/node (Node.js types)
- eslint + TypeScript plugins (linting)

## Success Criteria
✅ **Fast and reliable build system that supports both development and production modes, with automatic rebuilding during development.**

## Notes for AI Implementation
- Start with basic esbuild configuration
- Add watch mode after basic building works
- Test build performance with sample files
- Ensure TypeScript path mapping works correctly
- Validate that both packages can import from each other
