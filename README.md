# TERMAITE

Multi-agent AI CLI wrapper with intelligent rotation, fallback, and conversation management. Seamlessly use multiple AI agents (Claude, Gemini, Qwen, Cursor, etc.) with automatic failover and smart rotation strategies.

## Features

- 🔄 **Multiple Rotation Strategies**: Exhaustion (priority-based), Round-robin, and Random
- 🛡️ **Automatic Failover**: Seamlessly switches to backup agents on failure
- 💾 **Project-based History**: Maintains separate conversation history per project
- 🎨 **Beautiful Terminal UI**: Gradient-styled interface with smooth animations
- ⏱️ **Flexible Timeouts**: Global and per-agent timeout configuration
- 🔧 **Auto-configuration**: Creates working config on first run
- 📝 **Context Management**: Smart history compaction when approaching token limits

## Installation

```bash
npm install -g termaite
```

## Quick Start

```bash
# Interactive mode (default)
termaite

# Non-interactive mode
termaite --prompt "Your question here"

# Continue from most recent conversation
termaite -c

# Use specific agent
termaite --agent claude --prompt "Your question"

# Override rotation strategy
termaite --rotation round-robin
```

## Configuration

On first run, TERMAITE creates `~/.termaite/settings.json` with sensible defaults:

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
    },
    {
      "name": "gemini",
      "command": "gemini --prompt --yolo",
      "contextWindowTokens": 1000000,
      "timeoutSeconds": 300
    }
    // ... more agents
  ]
}
```

### Rotation Strategies

- **exhaustion** (default): Always tries agents in priority order. Cost-effective as it uses cheaper/preferred agents first.
- **round-robin**: Rotates through agents for load distribution
- **random**: Randomly selects agents

### Timeout Configuration

- **Per-agent**: Set `timeoutSeconds` on each agent (default: 300)
- **Global override**: Set `globalTimeoutSeconds` to override all agents
- **No timeout**: Set to `0` or negative value

## Slash Commands

- `/help` - Show available commands
- `/clear` - Clear chat history
- `/config` - Open settings in your editor
- `/init` - Analyze and document current project
- `/compact` - Manually compact chat history
- `/switch <agent>` - Switch to specific agent
- `/exit` - Exit application

## Project History

TERMAITE maintains separate conversation history for each project directory:
- Histories stored in `~/.termaite/projects/<project-path>/history.jsonl`
- Use `-c` flag to continue most recent conversation
- Automatic compaction at 75% of smallest agent's context window

## Supported Agents

Pre-configured commands for popular agents:
- **Claude**: `claude --print --dangerously-skip-permissions`
- **Gemini**: `gemini --prompt --yolo`
- **Qwen**: `qwen --prompt --yolo`
- **Cursor**: `cursor-agent --print --force --output-format text`
- **LLxprt**: `llxprt --yolo --prompt`

Add your own agents or local models in `settings.json`.

## Advanced Usage

### Non-interactive Mode
```bash
# Pipe input
echo "Explain this code" | termaite --prompt "Review the input"

# Use in scripts
result=$(termaite --prompt "Generate a UUID")
```

### Agent-specific Override
```bash
# Force specific agent for one request
termaite --agent gemini --prompt "Complex calculation"
```

### Custom Rotation for Session
```bash
# Use round-robin for this session only
termaite --rotation round-robin
```

## Requirements

- Node.js >= 18.0.0
- At least one AI CLI agent installed (claude, gemini, qwen, etc.)

## License

MIT

## Contributing

Contributions welcome! Please submit PRs to the GitHub repository.

## Troubleshooting

### No agents available
- Check that at least one agent CLI is installed
- Verify agent commands in `~/.termaite/settings.json`
- Test agent commands directly in terminal

### Agent timeouts
- Increase `timeoutSeconds` for slow agents
- Set `globalTimeoutSeconds` for consistent timeouts
- Use `0` for no timeout on long-running tasks

### UI Issues
- Ensure terminal supports Unicode and colors
- Try different terminal emulators if display is corrupted
- Check terminal size is at least 80x24