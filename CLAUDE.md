# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**term.ai.te** is an LLM-powered shell assistant with a modular **multi-agent architecture** (Plan-Act-Evaluate). It executes natural language requests through AI agents that plan, execute, and evaluate shell commands safely.

## Architecture Overview

### Multi-Agent System
The core system implements a **three-agent architecture**:

1. **Plan Agent** (`termaite/core/task_handler.py:42-44`) - Analyzes user requests and creates execution plans
2. **Action Agent** - Executes individual steps and generates shell commands  
3. **Evaluation Agent** - Assesses results and determines next actions (continue/revise/complete/fail)

### Key Components
- **Application Core** (`termaite/core/application.py`) - Main application orchestration and interactive session management
- **Task Handler** (`termaite/core/task_handler.py`) - Plan-Act-Evaluate loop execution
- **Simple Handler** (`termaite/core/simple_handler.py`) - Direct LLM responses without multi-step planning
- **Configuration Manager** (`termaite/config/manager.py`) - YAML config loading and command permission management
- **Command Execution** (`termaite/commands/`) - Safe command execution with permission systems
- **LLM Integration** (`termaite/llm/`) - API communication and response parsing

## Development Commands

### Development Setup
```bash
# Install in development mode
pip install -e .

# Install development dependencies
pip install -e .[dev]

# Run from source
python -m termaite "your request"
```

### Testing and Quality
```bash
# Run tests
pytest tests/

# Run tests with coverage
pytest --cov=. --cov-report=term-missing

# Code formatting
black termaite/ tests/
isort termaite/ tests/

# Type checking
mypy termaite/
```

### Package Building
```bash
# Build package
python -m build

# Install from local build
pip install dist/termaite-*.whl
```

## Configuration System

### Configuration Files Location
- **Config Directory**: `~/.config/term.ai.te/`
- **Main Config**: `config.yaml` - Operation mode, LLM endpoint, command permissions
- **LLM Payload**: `payload.json` - API request template for LLM communication
- **Response Parsing**: `response_path_template.txt` - jq path for extracting LLM responses

### Project-Specific Customization
The system supports **project-specific agent prompts** in `.termaite/` directory:
- `PLANNER.md` - Enhanced Plan Agent prompt for project context
- `ACTOR.md` - Enhanced Action Agent prompt  
- `EVALUATOR.md` - Enhanced Evaluation Agent prompt

Use `termaite --init` to auto-generate project-specific prompts by analyzing the current directory.

## Code Architecture Patterns

### Modular Design
The codebase follows **strict modularity** after refactoring from a monolithic structure:

```
termaite/
├── core/           # Application orchestration and task handling
├── config/         # Configuration management and templates
├── commands/       # Command execution, permissions, safety
├── llm/           # LLM client, payload building, response parsing
├── agents/        # Agent implementations (Plan/Action/Evaluate)
└── utils/         # Logging, helpers, context management
```

### Safety and Security Architecture
- **Three-tier permission system**: normal/gremlin/goblin operation modes
- **Command whitelisting/blacklisting** with runtime permission management
- **Timeout-based execution** with configurable limits
- **LLM output validation** before command execution
- **Audit logging** of all commands and decisions

### Agent Communication Protocol
Agents communicate through **structured text parsing**:
- **Plan Agent**: Outputs `<checklist>` and `<instruction>` blocks
- **Action Agent**: Outputs ````agent_command``` code blocks  
- **Evaluation Agent**: Outputs `<decision>TAG: message</decision>` with continue/revise/complete/fail decisions

## Development Guidelines

### File Size Constraints
- **CRITICAL**: No Python file should exceed **500 lines**
- **MANDATORY**: Refactoring required at **800 lines**
- The project was recently refactored from a 1300+ line monolith

### Code Quality Standards
- **Type hints required** for all functions and methods
- **Single Responsibility Principle** - each module has focused purpose
- **Comprehensive error handling** with proper logging
- **Docstrings** for all public interfaces
- **Security-first design** - validate all LLM outputs

### Testing Strategy
- **Unit tests** for all business logic components
- **Integration tests** for agent workflows and LLM interactions
- **Mock LLM responses** for predictable testing
- **Command execution safety tests** to prevent dangerous operations

### Configuration Management
- **YAML-based configuration** in `~/.config/term.ai.te/`
- **Template-based setup** with automatic file generation
- **Runtime command permission updates** that persist to config
- **Environment variable support** for sensitive settings

## Common Operations

### Running the Application
```bash
# Interactive mode (default)
termaite

# Single task execution
termaite "list all Python files in the current directory"

# Agentic mode (Plan-Act-Evaluate)
termaite -a "create a backup of my documents folder"

# Simple mode (direct LLM response)
termaite -s "what is the best programming language"

# Debug mode
termaite --debug "find all large files over 100MB"
```

### Configuration Management
```bash
# Show current configuration
termaite --config-summary

# Show config file locations
termaite --config-location

# Edit configuration file
termaite --edit-config

# Initialize project-specific prompts
termaite --init
```

### Interactive Mode Commands
- `/exit`, `/quit` - Exit interactive mode
- `/help` - Show available commands
- `/history` - Show conversation history
- `/stats` - Show session statistics  
- `/clear` - Clear conversation history
- `/init` - Initialize project-specific agent prompts
- `-a <prompt>` - Use agentic mode for this prompt
- `-s <prompt>` - Use simple mode for this prompt

## Security Considerations

### Operation Modes
1. **normal**: Whitelisted commands require confirmation; others are blocked
2. **gremlin**: Whitelisted commands auto-approved; others prompt for permission  
3. **goblin**: All commands auto-approved (**USE WITH EXTREME CAUTION**)

### Command Safety
- **Blacklist validation** - Commands like `rm -rf /` are never allowed
- **Whitelist system** with descriptions for approved commands
- **Runtime permission prompts** for unknown commands in gremlin mode
- **Command timeout enforcement** to prevent hanging operations
- **Working directory isolation** - commands execute in specified directory

### LLM Integration Security
- **Response validation** before command execution
- **Structured output parsing** to prevent injection attacks
- **Error handling** for malformed LLM responses
- **Context size management** to prevent prompt injection

## Key Files to Understand

For architecture understanding:
- `termaite/core/application.py:108-784` - Main application class and interactive session management
- `termaite/core/task_handler.py:71-100` - Plan-Act-Evaluate loop implementation
- `termaite/config/manager.py:34-100` - Configuration loading and command permission management
- `termaite/cli.py:15-103` - Command-line interface and argument parsing

For extending functionality:
- `termaite/llm/` - LLM integration and response parsing
- `termaite/commands/` - Command execution and safety systems
- `termaite/config/templates.py` - Default configuration templates

## Development Notes

### Recent Refactoring
The project was recently refactored from a monolithic 1300+ line file into a modular architecture. All development should follow the new modular patterns.

### Documentation Synchronization  
When making architectural changes, update both:
- `IMPLEMENTATION.md` - Technical implementation details
- `.github/copilot-instructions.md` - AI assistant development guidelines

### Project-Specific Features
The `/init` command enables auto-customization of agent prompts by investigating the current project directory and generating context-aware system prompts stored in `.termaite/`.

This allows the same termaite installation to work effectively across different types of projects (software, documents, research, etc.) by understanding project-specific patterns and conventions.

## Memories

- termaite is nondeterministic. SET TIMEOUTS TO BE LONG IF NECESSARY, 10+ MINUTES, ESPECIALLY FOR AGENTIC (-a) COMMANDS