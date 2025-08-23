#!/usr/bin/env node

/**
 * NPM publish script with automatic versioning and changelog generation
 * Usage: npm run publish:patch [--dry-run]
 *        npm run publish:minor [--dry-run]
 *        npm run publish:major [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse arguments
const args = process.argv.slice(2);
const versionType = args[0]; // major, minor, patch
const isDryRun = args.includes('--dry-run');

// Validate version type
const validVersionTypes = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];
if (!validVersionTypes.includes(versionType)) {
  console.error(`❌ Invalid version type: ${versionType}`);
  console.error(`   Valid types: ${validVersionTypes.join(', ')}`);
  process.exit(1);
}

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return output.trim();
  } catch (error) {
    if (!silent) {
      log(`❌ Command failed: ${command}`, colors.red);
      console.error(error.message);
    }
    throw error;
  }
}

function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return packageJson.version;
}

function getLastVersionTag() {
  try {
    // Get all version tags, sorted by version
    const tags = exec('git tag -l "v*" --sort=-version:refname', true).split('\n').filter(Boolean);
    return tags[0] || null;
  } catch {
    return null;
  }
}

function getCommitsSinceLastVersion() {
  const lastTag = getLastVersionTag();
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  
  try {
    // Get commit messages since last version
    const commits = exec(`git log ${range} --pretty=format:"%s|%h|%an" --no-merges`, true)
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [message, hash, author] = line.split('|');
        return { message, hash, author };
      });
    
    return commits;
  } catch {
    return [];
  }
}

function categorizeCommits(commits) {
  const categories = {
    breaking: [],
    features: [],
    fixes: [],
    docs: [],
    style: [],
    refactor: [],
    perf: [],
    test: [],
    chore: [],
    other: []
  };
  
  commits.forEach(commit => {
    const msg = commit.message.toLowerCase();
    
    // Check for conventional commit format
    if (msg.match(/^feat(\(.+\))?(!)?:/)) {
      if (msg.includes('!:')) {
        categories.breaking.push(commit);
      } else {
        categories.features.push(commit);
      }
    } else if (msg.match(/^fix(\(.+\))?:/)) {
      categories.fixes.push(commit);
    } else if (msg.match(/^docs(\(.+\))?:/)) {
      categories.docs.push(commit);
    } else if (msg.match(/^style(\(.+\))?:/)) {
      categories.style.push(commit);
    } else if (msg.match(/^refactor(\(.+\))?:/)) {
      categories.refactor.push(commit);
    } else if (msg.match(/^perf(\(.+\))?:/)) {
      categories.perf.push(commit);
    } else if (msg.match(/^test(\(.+\))?:/)) {
      categories.test.push(commit);
    } else if (msg.match(/^chore(\(.+\))?:/)) {
      categories.chore.push(commit);
    } else if (msg.match(/^revert(\(.+\))?:/)) {
      categories.other.push(commit);
    } else {
      // Categorize by keywords
      if (msg.includes('break')) {
        categories.breaking.push(commit);
      } else if (msg.includes('add') || msg.includes('implement') || msg.includes('create')) {
        categories.features.push(commit);
      } else if (msg.includes('fix') || msg.includes('resolve') || msg.includes('correct')) {
        categories.fixes.push(commit);
      } else if (msg.includes('update') || msg.includes('change') || msg.includes('modify')) {
        categories.refactor.push(commit);
      } else {
        categories.other.push(commit);
      }
    }
  });
  
  return categories;
}

function generateChangelogEntry(version, commits) {
  const date = new Date().toISOString().split('T')[0];
  const categories = categorizeCommits(commits);
  
  let entry = `## [${version}] - ${date}\n\n`;
  
  if (categories.breaking.length > 0) {
    entry += '### ⚠️ BREAKING CHANGES\n\n';
    categories.breaking.forEach(({ message, hash }) => {
      entry += `- ${message} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.features.length > 0) {
    entry += '### ✨ Features\n\n';
    categories.features.forEach(({ message, hash }) => {
      entry += `- ${message} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.fixes.length > 0) {
    entry += '### 🐛 Bug Fixes\n\n';
    categories.fixes.forEach(({ message, hash }) => {
      entry += `- ${message} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.perf.length > 0) {
    entry += '### ⚡ Performance\n\n';
    categories.perf.forEach(({ message, hash }) => {
      entry += `- ${message} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.refactor.length > 0) {
    entry += '### ♻️ Refactoring\n\n';
    categories.refactor.forEach(({ message, hash }) => {
      entry += `- ${message} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.docs.length > 0) {
    entry += '### 📝 Documentation\n\n';
    categories.docs.forEach(({ message, hash }) => {
      entry += `- ${message} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.test.length > 0) {
    entry += '### ✅ Tests\n\n';
    categories.test.forEach(({ message, hash }) => {
      entry += `- ${message} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.other.length > 0) {
    entry += '### 🔧 Other Changes\n\n';
    categories.other.forEach(({ message, hash }) => {
      entry += `- ${message} (${hash})\n`;
    });
    entry += '\n';
  }
  
  return entry;
}

function updateChangelog(version, commits) {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  const newEntry = generateChangelogEntry(version, commits);
  
  let existingContent = '';
  if (fs.existsSync(changelogPath)) {
    existingContent = fs.readFileSync(changelogPath, 'utf8');
  } else {
    existingContent = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }
  
  // Insert new entry after the header
  const lines = existingContent.split('\n');
  let insertIndex = 0;
  
  // Find where to insert (after the header and any blank lines)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      insertIndex = i;
      break;
    }
    if (lines[i].trim() === '' && i > 0) {
      continue;
    }
    insertIndex = i + 1;
  }
  
  // Insert the new entry
  lines.splice(insertIndex, 0, newEntry);
  
  const updatedContent = lines.join('\n');
  
  if (!isDryRun) {
    fs.writeFileSync(changelogPath, updatedContent);
    log(`✅ Updated CHANGELOG.md`, colors.green);
  } else {
    log('\n📝 Would update CHANGELOG.md with:', colors.yellow);
    console.log(newEntry);
  }
  
  return newEntry;
}

async function main() {
  try {
    log(`\n🚀 NPM Publish Script${isDryRun ? ' (DRY RUN)' : ''}`, colors.bright + colors.cyan);
    log(`   Version type: ${versionType}\n`, colors.cyan);
    
    // Check for uncommitted changes
    try {
      exec('git diff-index --quiet HEAD --', true);
    } catch {
      log('❌ You have uncommitted changes. Please commit or stash them first.', colors.red);
      process.exit(1);
    }
    
    // Get current version
    const currentVersion = getCurrentVersion();
    log(`📦 Current version: ${currentVersion}`, colors.blue);
    
    // Get commits since last version
    const commits = getCommitsSinceLastVersion();
    if (commits.length === 0) {
      log('⚠️  No commits since last version tag', colors.yellow);
    } else {
      log(`📝 Found ${commits.length} commits since last version`, colors.blue);
    }
    
    // Bump version
    let newVersion;
    if (isDryRun) {
      // Simulate version bump for dry run
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      switch (versionType) {
        case 'major':
          newVersion = `${major + 1}.0.0`;
          break;
        case 'minor':
          newVersion = `${major}.${minor + 1}.0`;
          break;
        case 'patch':
        default:
          newVersion = `${major}.${minor}.${patch + 1}`;
          break;
      }
      log(`📦 Would bump version to: ${newVersion}`, colors.yellow);
    } else {
      log(`📦 Bumping ${versionType} version...`, colors.blue);
      newVersion = exec(`npm version ${versionType} --no-git-tag-version`, true);
      newVersion = newVersion.replace(/^v/, '');
      log(`📦 New version: ${newVersion}`, colors.green);
    }
    
    // Update changelog
    log(`\n📝 Updating CHANGELOG.md...`, colors.blue);
    updateChangelog(newVersion, commits);
    
    if (!isDryRun) {
      // Commit changes
      log(`\n📝 Committing changes...`, colors.blue);
      exec('git add package.json package-lock.json CHANGELOG.md');
      exec(`git commit -m "Release v${newVersion}"`);
      
      // Create git tag
      log(`🏷️  Creating git tag v${newVersion}...`, colors.blue);
      exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
      
      // Push to git
      log(`\n📤 Pushing to git...`, colors.blue);
      exec('git push');
      exec('git push --tags');
      
      // Publish to npm
      log(`\n📦 Publishing to npm...`, colors.blue);
      exec('npm publish');
      
      log(`\n✨ Successfully published v${newVersion}!`, colors.bright + colors.green);
    } else {
      log(`\n✨ Dry run complete! Would publish v${newVersion}`, colors.bright + colors.yellow);
      log('\n📋 Next steps:', colors.cyan);
      log('   1. Review the changelog entry above', colors.cyan);
      log('   2. Run without --dry-run to actually publish', colors.cyan);
    }
    
  } catch (error) {
    log(`\n❌ Publishing failed!`, colors.red);
    process.exit(1);
  }
}

// Run the script
main();