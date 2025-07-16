# Termaite

A Python-based terminal agent that uses bash commands as tool calls. Termaite operates through a clean command-line interface and manages task execution through a structured JSON-based communication protocol with LLMs.

## Features

- **Goal-Driven Execution**: Immutable goal statements drive all task execution
- **Plan-Based Workflow**: Granular plans where each step equals one bash command
- **JSON Protocol**: Strict JSON-only communication with LLMs
- **Safety First**: Filesystem protection, command whitelisting, and gremlin mode
- **Context Management**: Automatic context window management with compaction
- **Session Persistence**: Complete session history with resume capability
- **Defensive Reading**: Handles large outputs intelligently

## Installation

```bash
pip install termaite
```

Or install from source:

```bash
git clone https://github.com/termaite/termaite.git
cd termaite
pip install -e .
```

## Quick Start

1. **First run**: Termaite will create a configuration file at `~/.termaite/config.toml`
2. **Configure**: Edit the configuration file to set your LLM endpoint and preferences
3. **Run**: Start termaite with `termaite`

## Configuration

On first run, Termaite creates a configuration template at `~/.termaite/config.toml`:

```toml
[llm]
endpoint = "http://localhost:11434/v1"  # OpenAI-compatible endpoint
context_window = 4096                   # Maximum context tokens
model = "llama3"                       # Preferred model name

[security]
gremlin_mode = false                   # Bypass command confirmations
project_root = "."                     # Commands restricted to this path

[session]
history_dir = "~/.termaite/sessions"   # Session storage location
max_sessions = 100                     # Maximum stored sessions

[whitelist]
enabled = true                         # Enable command whitelisting
file = "~/.termaite/whitelist.json"    # Whitelist storage
```

## Usage

### Built-in Commands

- `/new` - Create a new session
- `/history` - Browse session history, resume or delete sessions
- `/config` - Open configuration file in $EDITOR
- `/model` - View available models
- `/status` - Show current session status
- `/whitelist` - Show command whitelist status
- `/help` - Show help information
- `/exit` - Exit termaite

### Basic Usage

Simply type your task or request:

```
termaite> Find all Python files in this project and count the lines of code

termaite> Create a simple web server that serves files from the current directory

termaite> Set up a git repository and make an initial commit
```

Termaite will:
1. Create a goal statement
2. Develop a granular plan
3. Execute bash commands step by step
4. Adapt the plan based on outputs
5. Determine when the task is complete

## JSON Protocol

Termaite uses a strict JSON protocol for LLM communication:

### Goal Statement
```json
{
    "message": "Creating goal statement...",
    "operation": {
        "create_goal": {
            "statement": "Find all Python files and count total lines of code"
        }
    }
}
```

### Task Status
```json
{
    "message": "Checking task completion...",
    "operation": {
        "determine_task_status": "IN_PROGRESS"
    }
}
```

### Plan Management
```json
{
    "message": "Updating plan...",
    "operation": {
        "manage_plan": [
            {
                "step": 1,
                "action": "INSERT",
                "description": "find . -name '*.py' -type f"
            }
        ]
    }
}
```

### Bash Command
```json
{
    "message": "Executing command...",
    "operation": {
        "invoke_bash_command": {
            "command": "find . -name '*.py' -type f"
        }
    }
}
```

## Security Features

- **Filesystem Protection**: Commands are restricted to the project root
- **Command Whitelisting**: New commands require user approval (y/n/a)
- **TUI Prevention**: Interactive commands are blocked
- **Gremlin Mode**: Optional bypass of safety confirmations (use with caution)
- **Output Sanitization**: Sensitive information is filtered from outputs

## Architecture

Termaite follows a modular architecture:

```
termaite/
├── core/           # Core application logic
├── config/         # Configuration management
├── llm/            # LLM client and JSON protocol
├── commands/       # Command execution and safety
├── utils/          # Utilities (context management, etc.)
└── __main__.py     # Entry point
```

## Development

```bash
# Clone the repository
git clone https://github.com/termaite/termaite.git
cd termaite

# Install in development mode
pip install -e .[dev]

# Run tests
pytest

# Run linting
black termaite/
flake8 termaite/
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: https://docs.termaite.dev
- Issues: https://github.com/termaite/termaite/issues
- Discussions: https://github.com/termaite/termaite/discussions