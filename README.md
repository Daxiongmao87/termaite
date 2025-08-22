# TERMAITE - Multi-CLI-Agent Wrapper

TERMAITE is a command-line interface (CLI) wrapper that manages and rotates between multiple third-party CLI AI agents. It provides a unified interface that allows users to leverage multiple smaller subscriptions or free tiers from different AI providers, making the use of AI agents more affordable and flexible.

## Features

- **Agent Rotation**: Intelligently rotate between configured agents using round-robin, exhaustion, or random strategies
- **Project-Specific History**: Maintains separate chat history for each project
- **Automatic Compaction**: Manages context size by automatically compacting history when needed
- **Beautiful Terminal UI**: Modern chat-like interface with gradient colors and ASCII art
- **Non-Interactive Mode**: Execute single prompts from the command line
- **Resilient Agent Management**: Handles agent failures gracefully with timeouts and cool-down periods

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd term.ai.te

# Install dependencies
npm install

# Make the CLI executable globally (optional)
npm link
```

## Configuration

Create or edit `~/.termaite/settings.json`:

```json
{
  "rotationStrategy": "round-robin",
  "agents": [
    {
      "name": "claude",
      "command": "claude-code",
      "contextWindowTokens": 100000,
      "timeoutSeconds": 30
    },
    {
      "name": "gemini",
      "command": "gemini-cli",
      "contextWindowTokens": 32000,
      "timeoutSeconds": 30
    }
  ]
}
```

### Agent Configuration Fields

- `name`: Unique identifier for the agent
- `command`: The bash command to invoke the agent
- `contextWindowTokens`: Maximum context window size for the agent
- `timeoutSeconds`: Timeout duration for agent responses

## Usage

### Interactive Mode

```bash
# Start the interactive chat interface
termaite

# Continue from the most recent project
termaite --continue

# Start with a specific agent
termaite --agent claude

# Use a specific rotation strategy
termaite --rotation random
```

### Non-Interactive Mode

```bash
# Execute a single prompt
termaite --prompt "Your question here"

# Combine with other flags
termaite --agent gemini --prompt "Your question here"
```

### Command-Line Options

- `-c, --continue`: Load chat history from the most recently used project
- `-a, --agent <name>`: Override default rotation for the first turn
- `-r, --rotation <strategy>`: Override rotation strategy (round-robin, exhaustion, random)
- `-p, --prompt <text>`: Execute single prompt in non-interactive mode

### Slash Commands

While in interactive mode, you can use these commands:

- `/help`: Show available commands
- `/clear`: Delete the chat history for the current project
- `/compact`: Manually trigger history summarization
- `/init`: Investigate and summarize the current project
- `/switch <agent>`: Temporarily switch to a specific agent
- `/config`: Open the settings file in your default editor
- `/exit`: Exit the application

## Project Structure

```
term.ai.te/
├── src/
│   ├── index.cjs           # Main application entry point
│   ├── components/         # UI components
│   │   ├── GradientChatUI.cjs
│   │   └── PipeAnimation.cjs
│   ├── managers/           # Core management modules
│   │   ├── AgentManager.cjs
│   │   ├── ConfigManager.cjs
│   │   ├── HistoryCompactor.cjs
│   │   └── HistoryManager.cjs
│   ├── services/           # Service layer
│   │   └── AgentWrapper.cjs
│   └── utils/              # Utility functions
│       └── tokenEstimator.cjs
├── package.json
└── test-agent.cjs          # Test agent for development

```

## History Management

Chat histories are stored in `~/.termaite/projects/` with a unique slug for each project directory. The history is maintained in JSONL format and automatically compacted when it reaches 75% of the smallest configured agent's context window.

## Agent Rotation Strategies

- **round-robin**: Cycles through agents sequentially
- **exhaustion**: Uses the same agent until it fails, then switches
- **random**: Randomly selects an agent for each interaction

## Troubleshooting

### Agent Timeout Issues
If an agent frequently times out, increase its `timeoutSeconds` value in the configuration.

### History Compaction
If automatic compaction is triggered too frequently, consider using agents with larger context windows or manually compact with `/compact`.

### Agent Failures
Failed agents enter a cool-down period. The duration increases exponentially with consecutive failures, up to 30 minutes.

## Development

```bash
# Run tests
npm test

# Start development mode
npm start

# Test with the included test agent
node test-agent.cjs
```

## License

MIT

## Contributing

Contributions are welcome! Please read the SPECIFICATION.md and DEVELOPMENT.md files for detailed information about the project architecture and development guidelines.