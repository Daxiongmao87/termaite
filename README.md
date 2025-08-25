<div align="center">

# TERMAITE

**Multi-Agent AI CLI Orchestrator**

[![npm version](https://img.shields.io/npm/v/termaite.svg)](https://www.npmjs.com/package/termaite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/termaite.svg)](https://nodejs.org)

[Installation](#-installation) • [Quick Start](#-quick-start) • [Features](#-features) • [Configuration](#-configuration) • [Contributing](#contributing)

</div>

---

> ⚠️ **Early Alpha**: This project is under active development. Expect rapid changes and potential breaking updates. Review the Safety Disclaimer and use in non-production environments.

## ✨ Why TERMAITE?

TERMAITE orchestrates multiple AI CLI agents into a unified interface with intelligent rotation and automatic failover. Never lose a conversation due to rate limits or service outages again.


## 🚀 Installation

```bash
# Install globally via npm
npm install -g termaite

# Or run directly with npx
npx termaite
```

### Prerequisites
- Node.js >= 18.0.0
- At least one CLI-accessible AI agent installed and configured (user-provided; see your chosen agent’s documentation)

## ⚠️ Safety Disclaimer

TERMAITE can invoke external CLI agents that you configure. Granting agents full permissions or bypassing permission prompts (for example, using flags like `--dangerously-skip-permissions`) may allow unintended file, network, or system changes.

- Proceed cautiously and review every agent command before use
- Prefer least-privilege settings and interactive confirmation prompts
- Do not run as root/admin; test in non-production environments first

## 🎯 Quick Start

### 1. First Run - Automatic Setup
```bash
termaite
```
On first run, TERMAITE creates a starter configuration file at `~/.termaite/settings.json`. You control which agents to add and how they are invoked.

### 2. Interactive Chat
```bash
# Start chatting with automatic agent management
termaite

# Continue your last conversation
termaite -c

# Start with a specific agent
termaite --agent claude
```

### 3. Non-Interactive Usage
```bash
# Quick command execution
termaite --prompt "Explain quantum computing"

# Pipe input for code review
cat main.py | termaite --prompt "Review this code for security issues"

# Use in scripts
result=$(termaite --prompt "Generate a secure random password")
```

## 🌟 Key Features

### 🔄 **Intelligent Agent Rotation**
- **Exhaustion** (default): Prioritizes agents by cost/preference, switching only on failure
- **Round-Robin**: Distributes load evenly across all agents
- **Random**: Randomized selection for varied responses

### 🛡️ **Automatic Failover**
- Seamlessly switches to backup agents on:
  - Rate limit errors
  - Service outages  
  - Timeouts
  - Non-zero exit codes
- Exponential backoff with cooldown periods

### 💾 **Project-Based History**
- Separate conversation history per project directory
- Automatic history compaction at 75% context limit
- Continue conversations across sessions with `-c`

### ⚡ **Smart Context Management**
- Automatic token counting and estimation
- Intelligent history summarization
- Configurable context windows per agent

## 📋 Commands & Options

### Command Line Flags
```bash
Options:
      --help      Show help                                            [boolean]
      --version   Show version number                                  [boolean]
  -c, --continue  Automatically loads the chat history from the most recently
                  used project                                         [boolean]
  -a, --agent     Overrides the default rotation for the first turn, starting
                  with the specified agent name                         [string]
  -r, --rotation  Overrides the rotationStrategy from settings.json for the
                  current session                                       [string]
  -p, --prompt    Enables non-interactive mode. The application will execute a
                  single prompt with the chosen agent, print the result to
                  stdout, and then exit                                 [string]
```

### Slash Commands (Interactive Mode)
```bash
/help           Show available commands
/clear          Clear chat history
/config         Edit settings in $EDITOR
/init           Analyze and document current project
/compact        Manually trigger history compaction
/select         Switch to specific agent
/strategy       Change rotation strategy
/agents         List available agents
/instructions   View/edit agent instructions
/exit           Exit application
```

## ⚙️ Configuration

### Settings Structure (`~/.termaite/settings.json`)
```json
{
  "rotationStrategy": "exhaustion",
  "globalTimeoutSeconds": null,  // Optional: Override all timeouts
  "agents": [
    {
      "name": "claude",
      "command": "claude --print --dangerously-skip-permissions",
      "contextWindowTokens": 200000,
      "timeoutSeconds": 300  // Optional: 0 for no timeout
    },
    {
      "name": "gemini", 
      "command": "gemini --prompt --yolo",
      "contextWindowTokens": 1000000,
      "timeoutSeconds": 300
    }
  ]
}
```

### Custom Agents & Local Models
```json
{
  "name": "local-llama",
  "command": "ollama run llama2 --no-multiline",
  "contextWindowTokens": 4096,
  "timeoutSeconds": 60
}
```

## 📁 Project History Management

TERMAITE maintains conversation history per project:
- Stored in `~/.termaite/projects/<project-path>/history.jsonl`
- Automatic cleanup with `/clear` command
- Smart compaction when approaching context limits

### History Continuity
```bash
# Work on project A
cd ~/projects/website
termaite  # Creates history for this project

# Switch to project B  
cd ~/projects/api
termaite  # Separate history for API project

# Return to any project and continue
cd ~/projects/website
termaite -c  # Continues website conversation
```

## 🎯 Common Use Cases

### Development Workflow
```bash
# Initialize project understanding
termaite
> /init

# Get help with specific file
cat complex_algorithm.py | termaite --prompt "Explain this algorithm"

# Interactive debugging session
termaite --agent claude
> Help me debug this error: [paste error]
```

### Multi-Agent Strategies
```bash
# Cost optimization (use cheaper agents first)
termaite --rotation exhaustion

# Load balancing (distribute across agents)
termaite --rotation round-robin  

# Varied perspectives (random selection)
termaite --rotation random
```

### CI/CD Integration
```bash
#!/bin/bash
# Automated code review
git diff | termaite --prompt "Review these changes for potential issues"

# Documentation generation
termaite --prompt "Generate API docs for functions in api.js" > docs.md
```

## 🔧 Advanced Configuration

### Global Timeout Override
Set a system-wide timeout that overrides individual agent settings:
```json
{
  "globalTimeoutSeconds": 120,  // Applies to all agents
  "agents": [...]
}
```

### Failover Behavior
Agents enter cooldown after failures:
- 1st failure: 1 minute cooldown
- 2nd failure: 2 minutes  
- 3rd failure: 4 minutes
- Maximum: 30 minutes

### Token Management
Automatic compaction triggers at 75% of the smallest agent's context window. Manual compaction available via `/compact`.


## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
git clone https://github.com/Daxiongmao87/termaite.git
cd termaite
npm install
npm link  # Test locally
```

### Running Tests
```bash
npm test
```

## 📜 License

MIT © 2025 Daxiongmao87

## 🔗 Links

- [GitHub Repository](https://github.com/Daxiongmao87/termaite)
- [NPM Package](https://www.npmjs.com/package/termaite)
- [Issue Tracker](https://github.com/Daxiongmao87/termaite/issues)
- [Changelog](https://github.com/Daxiongmao87/termaite/releases)

---

<div align="center">
  <p>Built with ❤️ for the AI CLI community</p>
  <p>
    <a href="https://github.com/Daxiongmao87/termaite">Star on GitHub</a> •
    <a href="https://www.npmjs.com/package/termaite">View on NPM</a> •
    <a href="https://github.com/Daxiongmao87/termaite/issues">Report Issues</a>
  </p>
</div>