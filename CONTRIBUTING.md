# Contributing to Termaite

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the application: `npm start`

## Commit Message Guidelines

**IMPORTANT**: Commit messages are limited to 50 characters on the first line.

This is enforced by a git hook that will reject commits with longer messages.

### Good Examples:
- `Add user authentication feature`
- `Fix memory leak in agent rotation`
- `Update dependencies to latest versions`
- `Refactor input handling for better performance`

### Bad Examples (too long):
- `Add user authentication feature with OAuth2 and session management` ❌
- `Fix memory leak in agent rotation when switching between multiple agents` ❌

### Tips:
- Be concise and descriptive
- Use present tense ("Add" not "Added")
- Use imperative mood ("Fix" not "Fixes" or "Fixed")
- If you need more detail, add it in the commit body (second paragraph)

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