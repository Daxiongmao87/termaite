const esbuild = require('esbuild');
const path = require('path');

const buildPackage = async (packageName, options = {}) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const entryPoint = packageName === 'cli' 
    ? `packages/${packageName}/src/main.tsx`
    : `packages/${packageName}/src/index.ts`;
  
  return esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    outdir: `packages/${packageName}/dist`,
    platform: 'node',
    target: 'node18',
    format: packageName === 'cli' ? 'esm' : 'cjs',
    sourcemap: !isProduction,
    minify: isProduction,
    external: packageName === 'cli' ? ['react', 'ink', 'commander', 'chalk', 'ws'] : [],
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
