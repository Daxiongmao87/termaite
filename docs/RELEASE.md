# Release Process

This project uses [standard-version](https://github.com/conventional-changelog/standard-version) for automated versioning and changelog generation based on [Conventional Commits](https://www.conventionalcommits.org/).

## How It Works

1. **Development**: Write commits using conventional format:
   - `feat:` New features (triggers minor bump)
   - `fix:` Bug fixes (triggers patch bump)  
   - `feat!:` or `BREAKING CHANGE:` (triggers major bump)

2. **Release**: When ready to release:
   ```bash
   # Automatic version detection based on commits
   npm run release
   
   # Or force a specific version type
   npm run release:patch  # 0.0.X
   npm run release:minor  # 0.X.0
   npm run release:major  # X.0.0
   
   # Test first with dry-run
   npm run release:dry
   ```

3. **What happens**:
   - Analyzes commits since last tag
   - Bumps version in package.json
   - Updates CHANGELOG.md
   - Creates git commit and tag
   - The `postrelease` script then pushes and publishes

## Example Workflow

```bash
# Make changes and commit
git add .
git commit -m "feat: add new awesome feature"

# When ready to release
npm run release:dry  # Preview changes
npm run release      # Actually release

# If you need OTP for npm
npm publish --otp=123456
```

## Commit Types

- `feat:` New feature → Minor version bump
- `fix:` Bug fix → Patch version bump
- `docs:` Documentation → No version bump (unless forced)
- `style:` Code style → No version bump
- `refactor:` Code refactoring → No version bump
- `perf:` Performance → Patch version bump
- `test:` Tests → No version bump
- `build:` Build changes → No version bump
- `ci:` CI/CD → No version bump
- `chore:` Maintenance → No version bump

Add `!` or `BREAKING CHANGE:` in body for major version bump.