# Contributing to Termaite

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the application: `npm start`

## Commit Message Guidelines

**IMPORTANT**: This project follows [Conventional Commits](https://www.conventionalcommits.org/) specification.

All commit messages must:
1. Start with a type prefix (feat, fix, docs, etc.)
2. Be limited to 50 characters on the first line
3. Use present tense and imperative mood

### Format:
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Allowed Types:
- `feat` - A new feature
- `fix` - A bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `build` - Build system changes
- `ci` - CI/CD changes
- `chore` - Maintenance tasks
- `revert` - Revert a previous commit

### Good Examples:
- `feat: add user authentication`
- `fix(auth): resolve login timeout issue`
- `docs: update README with examples`
- `refactor: simplify input handling logic`
- `perf: optimize history loading`

### Bad Examples:
- `Updated commit hook` ❌ (missing type prefix)
- `feat: add user authentication with OAuth2 and session management` ❌ (exceeds 50 chars)
- `Fix bug` ❌ (missing type prefix, too vague)

### Tips:
- Keep the first line under 50 characters
- Use the body for detailed explanations if needed
- Reference issues/PRs in the footer (e.g., "Closes #123")

## Publishing a New Version

The project uses automated versioning and changelog generation:

### Dry Run (Test First):
```bash
npm run publish:patch:dry  # Test patch version (0.0.x)
npm run publish:minor:dry  # Test minor version (0.x.0)
npm run publish:major:dry  # Test major version (x.0.0)
```

### Actual Publish:
```bash
npm run publish:patch  # Publish patch version
npm run publish:minor  # Publish minor version
npm run publish:major  # Publish major version
```

The publish script will:
1. Check for uncommitted changes
2. Collect all commits since last version
3. Generate changelog entry
4. Bump version in package.json
5. Commit and tag the release
6. Push to GitHub
7. Publish to npm

## Code Style

- Use 2 spaces for indentation
- No semicolons in JavaScript
- Use single quotes for strings
- Add comments for complex logic
- Keep functions small and focused

## Testing

Before submitting changes:
1. Test the application manually
2. Ensure no runtime errors
3. Test with multiple AI agents if possible
4. Verify UI renders correctly

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Commit with a descriptive message (≤50 chars!)
5. Push to your fork
6. Open a pull request with description of changes