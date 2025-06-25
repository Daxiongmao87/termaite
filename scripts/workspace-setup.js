#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up termaite workspace...');

// Create package directories
const packages = ['cli', 'core'];
packages.forEach(pkg => {
  const pkgDir = path.join('packages', pkg);
  if (!fs.existsSync(pkgDir)) {
    fs.mkdirSync(pkgDir, { recursive: true });
    console.log(`✅ Created ${pkgDir}`);
  } else {
    console.log(`✅ ${pkgDir} already exists`);
  }
});

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

console.log('🎉 Workspace setup complete!');
