# TERMAITE Project Guidelines

## Project Overview

**TERMAITE** is a multi-agent AI CLI orchestrator that intelligently manages and rotates between multiple AI command-line agents (Claude, Gemini, Qwen, Cursor, etc.). It provides a unified terminal interface with automatic failover, conversation persistence, and beautiful UI features.

### Key Characteristics
- **Type**: Node.js CLI application (CommonJS)
- **Node Version**: >=18.0.0
- **Package Manager**: npm
- **UI Framework**: blessed (terminal UI library)
- **Architecture**: Modular component-based design
- **License**: MIT
- **Repository**: https://github.com/Daxiongmao87/termaite

## Architecture Overview

### Directory Structure
```
term.ai.te/
├── src/
│   ├── index.cjs              # Main entry point (CLI argument parsing, mode selection)
│   ├── components/            # UI components (blessed-based)
│   │   ├── GradientChatUI.cjs # Main chat interface with gradient styling
│   │   ├── SpinnerAnimation.cjs # Loading spinner during agent processing
│   │   ├── EnhancedInput.cjs  # Input field with history navigation
│   │   └── ...
│   ├── managers/              # Core business logic managers
│   │   ├── AgentManager.cjs   # Agent rotation, failover, and state management
│   │   ├── ConfigManager.cjs  # Settings and configuration management
│   │   ├── HistoryManager.cjs # Conversation history per project
│   │   └── HistoryCompactor.cjs # Token management and history summarization
│   ├── services/              # External service interactions
│   │   └── AgentWrapper.cjs   # Agent command execution and I/O handling
│   └── utils/                 # Utility functions
│       └── tokenEstimator.cjs # Token counting estimation
├── package.json               # NPM configuration
├── CHANGELOG.md              # Version history (standard-version)
├── CONTRIBUTING.md           # Development guidelines
└── README.md                 # User documentation
```

### Component Relationships

1. **Entry Point** (`src/index.cjs`):
   - Parses CLI arguments using yargs
   - Handles both interactive (UI) and non-interactive (CLI) modes
   - Initializes managers and UI components

2. **Managers Layer**:
   - **ConfigManager**: Loads/saves `~/.termaite/settings.json`, manages agent configurations
   - **AgentManager**: Implements rotation strategies (exhaustion, round-robin, random), tracks failed agents with exponential backoff
   - **HistoryManager**: Manages per-project conversation history in JSONL format
   - **HistoryCompactor**: Handles automatic history compression when approaching token limits

3. **UI Components** (blessed-based):
   - **GradientChatUI**: Main interactive chat interface with gradient borders
   - **SpinnerAnimation**: Visual feedback during agent processing
   - **EnhancedInput**: Input field with command history and cursor navigation

4. **Services**:
   - **AgentWrapper**: Spawns agent processes, handles I/O piping, implements timeouts

## Development Workflow

### Setup
```bash
# Clone repository
git clone https://github.com/Daxiongmao87/termaite.git
cd termaite

# Install dependencies
npm install

# Link for local development
npm link

# Run locally
npm start
# or
node src/index.cjs
```

### Available NPM Scripts
- `npm start` - Run the application
- `npm run release` - Create a new release (uses standard-version)
- `npm run release:patch` - Patch version bump (0.0.x)
- `npm run release:minor` - Minor version bump (0.x.0)
- `npm run release:major` - Major version bump (x.0.0)
- `npm run release:dry` - Dry run to preview changes
- `npm run postrelease` - Push tags and publish to npm

### Git Workflow
The project uses:
- **Conventional Commits** specification (enforced via git hooks)
- **standard-version** for automated versioning and changelog generation
- Git hooks configured in `.githooks/` directory

## Key Technical Patterns

### 1. Agent Management Strategy
- **Rotation Strategies**: exhaustion (default), round-robin, random
- **Failover Logic**: Exponential backoff (1min → 2min → 4min... max 30min)
- **Timeout Handling**: Configurable per-agent with global override option
- **State Persistence**: Rotation state saved in `~/.termaite/state.json`

### 2. History Management
- **Per-Project Isolation**: History stored at `~/.termaite/projects/<slug>/history.jsonl`
- **JSONL Format**: Each line is a JSON object with sender, text, timestamp
- **Automatic Compaction**: Triggers at 75% of smallest agent's context window
- **Token Estimation**: Simple algorithm (1 token ≈ 4 characters)

### 3. Configuration System
```json
{
  "rotationStrategy": "exhaustion",
  "globalTimeoutSeconds": null,
  "agents": [
    {
      "name": "claude",
      "command": "claude --print --dangerously-skip-permissions",
      "contextWindowTokens": 200000,
      "timeoutSeconds": 300
    }
  ]
}
```

### 4. UI Implementation
- **blessed library**: Terminal UI framework
- **Event-driven**: Keyboard and mouse event handling
- **Scrollable chat**: PageUp/PageDown + mouse wheel support
- **Gradient effects**: Custom ASCII art and colored borders

### 5. Process Management
- **Child Process Spawning**: Uses Node.js spawn with shell:true
- **I/O Piping**: stdin/stdout/stderr handling
- **Cancellation Support**: SIGKILL for immediate termination
- **Exit Code Handling**: Non-zero codes trigger failover

## Coding Standards

### General Guidelines
- **Module System**: CommonJS (`.cjs` extension)
- **No TypeScript**: Pure JavaScript
- **Error Handling**: Graceful degradation, automatic failover
- **Async Patterns**: Promises and async/await
- **File Size**: Keep modules focused and under 500 lines

### Code Style
- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Optional (project doesn't enforce)
- **Comments**: JSDoc for public methods, inline for complex logic
- **Naming**: camelCase for variables/functions, PascalCase for classes

### Commit Message Format
Follow Conventional Commits:
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

### Testing Approach
Currently no automated tests. Manual testing checklist:
1. Test with multiple AI agents
2. Verify failover behavior
3. Check UI rendering in different terminal sizes
4. Test history persistence across sessions
5. Validate command-line flags

## Important Implementation Details

### 1. Agent Command Execution
- Commands run via shell with full environment
- Input augmented with conversation context (last 10 messages)
- Automatic summary request appended to prompts
- Global instructions propagated before each execution

### 2. Slash Commands
- `/init` - Project investigation and documentation
- `/clear` - Delete current project history
- `/compact` - Manual history compaction
- `/config` - Open settings in $EDITOR
- `/switch <agent>` - Temporary agent override
- `/help` - Show available commands
- `/exit` - Graceful shutdown

### 3. Non-Interactive Mode
```bash
termaite --prompt "Your question" [--agent claude] [--continue]
```
- Outputs to stdout (agent info to stderr)
- Supports piping and scripting
- Automatic failover still applies

### 4. Safety Considerations
- Never run as root/admin
- Agents execute with full shell access
- Users must configure agent commands carefully
- Permission bypass flags should be used cautiously

## Common Development Tasks

### Adding New Features
1. Identify appropriate manager/component
2. Follow existing patterns in codebase
3. Update configuration schema if needed
4. Test with multiple agents
5. Update README documentation

### Debugging Tips
- Check `~/.termaite/settings.json` for configuration issues
- Verify agent commands work standalone
- Monitor `~/.termaite/state.json` for rotation state
- Use stderr for debug output in non-interactive mode
- Test timeout behavior with slow/hanging commands

### Release Process
1. Ensure all changes committed
2. Run `npm run release:dry` to preview
3. Choose appropriate version bump
4. Run actual release command
5. Verify GitHub tags and npm package

## Future Considerations

### Potential Enhancements
- Automated testing framework
- Plugin system for custom agents
- Web UI alternative
- Advanced token counting algorithms
- Streaming response support
- Multi-turn conversation planning

### Known Limitations
- No built-in tests
- Simple token estimation
- Terminal-only interface
- Requires Node.js 18+
- Depends on external agent CLIs

## Support Resources

- **GitHub Issues**: https://github.com/Daxiongmao87/termaite/issues
- **NPM Package**: https://www.npmjs.com/package/termaite
- **Documentation**: README.md, SPECIFICATION.md
- **Contributing**: CONTRIBUTING.md

## Summary

TERMAITE is a well-structured Node.js CLI application that elegantly solves the problem of managing multiple AI agents through intelligent orchestration. The codebase follows clean separation of concerns with managers handling business logic, components managing UI, and services wrapping external interactions. When working on this project, maintain the existing patterns, respect the CommonJS module system, and ensure changes are tested with multiple agent configurations.