# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Termaite is a Python-based terminal agent that uses bash commands as tool calls. The agent operates through a clean TUI interface and manages task execution through a structured JSON-based communication protocol with LLMs.

## Core Architecture

### JSON Communication Protocol
The LLM must ONLY respond in JSON format using these schemas:

**Goal Statement Creation** (required at task start):
```json
{
    "message": "User-facing message about creating goal",
    "operation": {
        "create_goal": {
            "statement": "Factual goal statement"
        }
    }
}
```

**Task Status Determination**:
```json
{
    "message": "Status assessment message",
    "operation": {
        "determine_task_status": "IN_PROGRESS" // or "COMPLETE"
    }
}
```

**Plan Management**:
```json
{
    "message": "Plan modification explanation",
    "operation": {
        "manage_plan": [
            {
                "step": 1,
                "action": "INSERT", // INSERT, EDIT, DELETE
                "description": "Step description"
            }
        ]
    }
}
```

**Bash Command Execution**:
```json
{
    "message": "Command explanation",
    "operation": {
        "invoke_bash_command": {
            "command": "bash command to execute"
        }
    }
}
```

### Task Execution Flow
1. Create immutable goal statement (system enforced)
2. Create/manage granular plan (each step = 1 bash command)
3. Determine task completion status against goal
4. Update plan based on command output
5. Execute next planned bash command

### System Constraints
- **No TUI commands**: Agent cannot use interactive terminal applications
- **Project root restriction**: Commands must stay within project directory
- **Command whitelist**: New commands require user approval (y/n/a)
- **Gremlin mode**: Bypasses safety confirmations when enabled

## Built-in Commands

- `/new` - Create new session
- `/history` - Browse/resume/delete session history
- `/config` - Edit configuration (LLM endpoint, context window, gremlin mode)
- `/model` - View/select available models
- `/exit` - Exit application

## Memory Management

### Context Window Protection
- **Compaction trigger**: At 75% of context window
- **Compaction method**: Summarize oldest 50% of session to single paragraph
- **Preservation**: Always keep original user prompt
- **Defensive reading**: If command output >50% context window, return error requiring targeted re-execution

### Session History
- **User view**: Complete word-for-word session preservation
- **Agent view**: Compacted version fitting context constraints

## Development Commands

```bash
# Installation
pip install -e .

# Run application
termaite

# Run tests
python -m pytest

# Lint code
python -m flake8 termaite/
python -m black termaite/
```

## Security Features

- **Filesystem protection**: Prevent commands outside project root
- **Command validation**: Parse and validate all bash commands
- **User confirmation**: Whitelist system for new commands
- **Safe defaults**: No TUI or interactive command execution

## Configuration Requirements

Termaite requires valid configuration before operation:
- LLM endpoint URL
- Context window size
- Gremlin mode setting
- Model selection preferences

Configuration template should be self-explanatory with clear instructions for each setting.