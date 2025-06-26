const chokidar = require('chokidar');
const { buildPackage } = require('../esbuild.config.js');

console.log('🔄 Starting watch mode...');

const buildWithLogging = async (packageName) => {
  const start = Date.now();
  try {
    await buildPackage(packageName);
    const duration = Date.now() - start;
    console.log(`✅ ${packageName} built in ${duration}ms`);
  } catch (error) {
    console.error(`❌ ${packageName} build failed:`, error.message);
  }
};

// Watch CLI package
chokidar.watch('packages/cli/src/**/*.{ts,tsx}', {
  ignored: /node_modules/,
  persistent: true
}).on('change', () => {
  console.log('📦 CLI files changed, rebuilding...');
  buildWithLogging('cli');
});

// Watch Core package
chokidar.watch('packages/core/src/**/*.ts', {
  ignored: /node_modules/,
  persistent: true
}).on('change', () => {
  console.log('🔧 Core files changed, rebuilding...');
  buildWithLogging('core');
});

// Initial build
Promise.all([
  buildWithLogging('cli'),
  buildWithLogging('core')
]).then(() => {
  console.log('👀 Watching for changes...');
}).catch(error => {
  console.error('❌ Initial build failed:', error);
  process.exit(1);
});
