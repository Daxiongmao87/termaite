# Comprehensive Implementation Plan for Termaite

Based on analysis of the current codebase and requirements in `idea.md`, this document outlines the complete implementation plan covering all features and their interactions.

## 1. Core Architecture Overview

### System Design Philosophy
- **Single-Agent Architecture**: Unlike the previous multi-agent system, this will be a single-agent system with strict JSON protocol
- **Goal-Driven Execution**: Immutable goal statements drive all task execution
- **Plan-Based Workflow**: Granular plans where each step = 1 bash command
- **TUI-First Interface**: Clean terminal user interface with modal interactions
- **Security-First**: Filesystem protection, command whitelisting, and gremlin mode

### Core Components Interaction Flow
```
User Input → TUI Interface → Session Manager → Goal Manager → Plan Manager → JSON Protocol → LLM Client → Command Executor → Output Handler → Context Compactor → Back to TUI
```

### Task Execution Flow (Required 6-Step Sequence)
**When termaite is given a task, it MUST follow this exact sequence:**

1. **Goal Statement Creation**: If no goal statement exists, create one (SYSTEM RESPONSIBILITY: immutable after creation, cleared after task completion)
2. **Plan Creation**: If no plan exists, create one (SYSTEM RESPONSIBILITY: each step = 1 bash command maximum)
3. **Task Status Determination**: Based on last output, determine if goal statement is satisfied (mark as COMPLETE or continue)
4. **Plan Revision**: Based on last output, determine if plan needs revision and update accordingly
5. **Current Step Identification**: Determine which task step the operation is currently on
6. **Command Execution**: Provide the command that will accomplish the current task step

**Critical Requirements:**
- Goal statement is immutable once created
- Each plan step can only contain 1 bash command
- Task status must be evaluated against the goal statement, not subjective completion
- Plan exists beyond session history and is fed into AI system prompt

## 2. Implementation Phases

### Phase 1: Foundation Layer (Core Infrastructure)
**Priority: Critical**

#### 2.1 Project Structure Setup
```
termaite/
├── __init__.py (package initialization)
├── __main__.py (entry point)
├── core/
│   ├── __init__.py
│   ├── application.py (main application controller)
│   ├── session.py (session management)
│   ├── goal_manager.py (immutable goal statements)
│   ├── plan_manager.py (granular plan management)
│   └── json_protocol.py (strict JSON communication)
├── config/
│   ├── __init__.py
│   ├── manager.py (configuration management)
│   └── templates.py (self-explanatory config templates)
├── llm/
│   ├── __init__.py
│   ├── client.py (JSON-only API client)
│   └── schemas.py (JSON validation schemas)
├── commands/
│   ├── __init__.py
│   ├── executor.py (bash command execution)
│   ├── safety.py (filesystem protection)
│   └── whitelist.py (command whitelisting)
├── tui/
│   ├── __init__.py
│   ├── main.py (main TUI interface)
│   ├── modals.py (history/model selection modals)
│   └── builtin_commands.py (built-in command handlers)
└── utils/
    ├── __init__.py
    ├── context_compactor.py (memory management)
    └── defensive_reader.py (large output handling)
```

#### 2.2 Configuration System
- **Self-explanatory config template** with clear instructions
- **Required fields**: LLM endpoint, context window, gremlin mode, model preferences
- **Validation**: Must exist before operation
- **Editor integration**: Opens via `$EDITOR` for `/config` command

#### 2.3 JSON Protocol Foundation
- **Strict JSON-only communication** with LLM
- **Four core schemas**: Goal creation, Task status, Plan management, Bash command
- **Schema validation** for all LLM responses
- **Error handling** for malformed JSON

### Phase 2: Core Functionality (Essential Features)
**Priority: High**

#### 2.4 Session Management System
- **Session persistence** across application restarts
- **Goal statement storage** (immutable once created)
- **Plan storage** (mutable, granular steps)
- **History separation**: User view (complete) vs Agent view (compacted)
- **Session lifecycle**: Create → Execute → Complete → Archive

#### 2.5 Goal Management System
- **Immutable goal creation** (system-enforced)
- **Goal validation** against user prompt
- **Goal persistence** beyond session history
- **Goal completion detection** (adversarial evaluation)
- **Automatic goal clearing** after task completion

#### 2.6 Plan Management System
- **Granular plan creation** (1 bash command per step)
- **Plan validation** (ensure each step is single command)
- **Dynamic plan modification** based on command output
- **Plan operations**: INSERT, EDIT, DELETE steps
- **Plan persistence** with goal statement

#### 2.7 LLM Client with JSON Protocol
- **OpenAI-compatible API** integration
- **JSON-only response parsing**
- **Schema validation** for all responses
- **Error handling** for invalid responses
- **Model selection** and availability querying

### Phase 3: TUI Interface Layer (User Experience)
**Priority: High**

#### 2.8 Main TUI Interface - Chatbox Style
- **Chatbox-style interface** with input at bottom and conversation display above
- **Input Area**: Fixed at the bottom of the screen for user input
- **Conversation Display**: Rest of screen shows chronological conversation history
- **Message Distinction**: Clear visual separation between:
  - User messages (input/commands)
  - Agent messages (JSON responses formatted for readability)
  - System messages (built-in command results, errors)
- **Real-time Updates**: Show agent processing and command execution live
- **Working Indicator**: Display animated "Working..." placeholder while agent is processing (before output appears)
- **Scrolling Support**: Navigate through conversation history
- **Built-in Command Detection**: Process `/` commands locally

#### 2.9 Built-in Commands Implementation
- **`/new`**: Create new session (clear goal/plan)
- **`/history`**: Modal for session browsing/resume/delete
- **`/config`**: Open config in `$EDITOR`
- **`/model`**: Modal for model selection
- **`/init`**: Run project initialization to create .TERMAITE.md context file
- **`/exit`**: Clean application exit

#### 2.10 Modal Interfaces
- **History browser**: Navigate sessions, enter to resume, delete key to remove
- **Model selector**: Display current model, show available models
- **Interactive selection**: Keyboard navigation
- **Modal management**: Stack-based modal system

### Phase 4: Security and Safety Layer (Protection)
**Priority: High**

#### 2.11 Command Security System
- **Filesystem protection**: Prevent commands outside project root
- **Path validation**: Analyze command paths before execution
- **Command whitelisting**: New commands require user confirmation (y/n/a)
- **Whitelist persistence**: Save "always" selections
- **Gremlin mode**: Bypass confirmations when enabled

#### 2.12 Command Execution Safety
- **No TUI commands**: Block interactive applications
- **Command parsing**: Validate bash commands before execution
- **Output capture**: Secure command output handling
- **Error handling**: Graceful failure management
- **Timeout protection**: Prevent hanging commands

### Phase 5: Memory Management Layer (Performance)
**Priority: Medium-High**

#### 2.13 Context Window Management
- **Token estimation**: Track session history size
- **75% threshold**: Trigger compaction at 75% context window
- **Compaction strategy**: Summarize oldest 50% to single paragraph
- **Original prompt preservation**: Always keep user's initial request
- **Pre-call validation**: Check context before every LLM call

#### 2.14 Defensive Reading System
- **Output size detection**: Check if output exceeds 50% context window
- **Large output handling**: Return error instead of overwhelming output
- **Targeted re-execution**: Guide LLM to use more specific commands
- **Iterative refinement**: Allow multiple targeted queries
- **Memory protection**: Prevent context window overflow

### Phase 6: Project Initialization System (Context Enhancement)
**Priority: Medium-High**

#### 2.15 Project Discovery Engine
- **File system analysis**: Scan directory structure and identify key files
- **Project type detection**: Recognize Python, Node.js, Go, Java, etc. projects
- **Framework identification**: Detect Flask, Django, React, etc. frameworks
- **Build system analysis**: Identify package.json, requirements.txt, go.mod, etc.

#### 2.16 Context File Generation
- **Template-based generation**: Create .TERMAITE.md based on project type
- **Dynamic content**: Include project-specific structure and patterns
- **General guidance**: Provide operational best practices for project type
- **Maintenance instructions**: Guide AI on when to update the context file

#### 2.17 System Prompt Integration
- **Automatic loading**: Load .TERMAITE.md content into system prompt
- **Context positioning**: Append after core instructions but before task-specific prompts
- **Update detection**: Monitor .TERMAITE.md changes and reload context
- **Fallback handling**: Graceful degradation when context file is missing

### Phase 7: Advanced Features (Enhancement)
**Priority: Medium**

#### 2.18 System Prompts Specialization
**CRITICAL REQUIREMENT: EACH STEP OUTLINED IN THE 6-STEP SEQUENCE REQUIRES ITS OWN SYSTEM PROMPT**

This is to isolate and separate roles and responsibilities:

- **Goal Statement System Prompt**: Encourage accurate and testable goal statements to satisfy the user's prompt
- **Task Status System Prompt**: Encourage adversarial and scrutinizing behavior to determine if goal statement is satisfied, with absolutely no excuses
- **Plan Management System Prompt**: If no plan exists, encourage granular and iterative step-by-step planning. If plan exists, verify alignment with command output and make adjustments
- **Bash Command System Prompt**: Encourage use of all **NON-TUI** bash commands. Forbidden to use TUI-based commands that require user interaction

#### 2.19 Operational Command Suggestions
- **Hardcoded command list**: Fundamental bash commands
- **Navigation commands**: `find`, `ls`, `cd`
- **File manipulation**: `sed`, `awk`, `grep`
- **Directory operations**: `mkdir`, `rmdir`
- **System information**: `pwd`, `whoami`, `uname`

## 3. Feature Interaction Matrix

### Core Interactions
1. **User Input** → **TUI Interface** → **Built-in Command Handler** OR **Session Manager**
2. **Session Manager** → **Goal Manager** → **LLM Client** (Goal Creation)
3. **Goal Manager** → **Plan Manager** → **LLM Client** (Plan Creation/Modification)
4. **Plan Manager** → **Command Executor** → **Safety Layer** → **Bash Execution**
5. **Command Output** → **Defensive Reader** → **Context Compactor** → **Session History**
6. **Session History** → **LLM Client** → **JSON Protocol** → **Next Action**

### Safety Integration Points
- **Command Executor** checks **Whitelist** before execution
- **Safety Layer** validates **Filesystem Protection** before commands
- **Gremlin Mode** bypasses **User Confirmation** in **Whitelist**
- **Context Compactor** monitors **Token Limits** before **LLM Calls**

### Data Flow
```
User Task → Goal (Immutable) → Plan (Mutable) → Commands (Validated) → Output (Processed) → History (Compacted) → Next Plan Update
```

## 4. Detailed JSON Protocol Specifications

### 4.1 Goal Statement Schema
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

### 4.2 Task Status Schema
```json
{
    "message": "Based on the current state of the task and the goal statement -- <goal statement> -- we still have to <list key todo items from the plan>",
    "operation": {
        "determine_task_status": "IN_PROGRESS"
    }
}
```

### 4.3 Plan Management Schema
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

### 4.4 Bash Command Schema
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

## 5. System Requirements

### 5.1 Pre-Operation Requirements
- **Valid configuration file** must exist (auto-created on first run if missing)
- **LLM endpoint** must be accessible
- **Context window** must be specified
- **Gremlin mode** setting must be defined
- **Model preferences** must be configured

### 5.2 Project Initialization System (`--init` and `/init`)
- **Project Discovery Engine**: Analyze current directory structure, file types, and project patterns
- **Project Type Detection**: Identify project type (Python, Node.js, Go, etc.) based on files and structure
- **Context File Generation**: Create `.TERMAITE.md` with:
  - Project purpose and description
  - Key features and functionality
  - Project structure overview
  - General operational guidance for detected project type
- **System Prompt Integration**: Automatically append .TERMAITE.md content to all AI interactions
- **Context Maintenance**: AI should update .TERMAITE.md when project changes significantly

### 5.3 Configuration Template Structure
```yaml
# Termaite Configuration
# Fill out all required fields before first use

llm:
  endpoint: "http://localhost:11434/v1"  # OpenAI-compatible endpoint
  context_window: 4096                   # Maximum context tokens
  model: "llama3"                       # Preferred model name

security:
  gremlin_mode: false                   # Bypass command confirmations
  project_root: "."                     # Commands restricted to this path
  
session:
  history_dir: "~/.termaite/sessions"   # Session storage location
  max_sessions: 100                     # Maximum stored sessions

whitelist:
  enabled: true                         # Enable command whitelisting
  file: "~/.termaite/whitelist.json"    # Whitelist storage
```

## 6. Implementation Order

### Week 1: Foundation
1. Project structure setup
2. Configuration system with templates
3. JSON protocol schemas and validation
4. Basic session management framework

### Week 2: Core Logic
1. Goal management system (immutable goals)
2. Plan management system (granular plans)
3. LLM client with JSON validation
4. Command execution basics with safety

### Week 3: Interface
1. TUI interface foundation
2. Built-in commands implementation
3. Modal interfaces (history/model selection)
4. User interaction flow

### Week 4: Security
1. Command whitelisting system
2. Filesystem protection mechanisms
3. Safety validations and parsing
4. Gremlin mode implementation

### Week 5: Memory Management
1. Context window tracking and estimation
2. Compaction system implementation
3. Defensive reading for large outputs
4. Performance optimization

### Week 6: Project Initialization System
1. Project discovery and type detection
2. Context file generation engine
3. System prompt integration
4. Template system for different project types

### Week 7: Polish & Testing
1. Comprehensive error handling
2. Edge case coverage
3. Documentation completion
4. Testing and validation

## 7. Success Criteria

### Functional Requirements
- ✅ TUI interface with clean, responsive display
- ✅ All built-in commands working (/new, /history, /config, /model, /init, /exit)
- ✅ JSON-only LLM communication with schema validation
- ✅ Immutable goal statements with system enforcement
- ✅ Granular plan management (1 command per step)
- ✅ Secure command execution with whitelisting
- ✅ Context window management with compaction
- ✅ Session persistence across restarts
- ✅ Modal interfaces for history and model selection
- ✅ Defensive reading for large outputs
- ✅ Filesystem protection from malicious commands
- 🔄 Project initialization system with .TERMAITE.md generation
- 🔄 Automatic context loading and system prompt integration
- 🔄 Project type detection and template-based context generation

### Non-Functional Requirements
- ✅ Pip installable package with proper entry point
- ✅ Configuration-driven operation with validation
- ✅ Memory efficient operation within context limits
- ✅ Fast response times for user interactions
- ✅ Secure by default with optional gremlin mode
- ✅ User-friendly interface with clear feedback
- ✅ Robust error handling and recovery
- ✅ Comprehensive logging and debugging support

## 8. Technical Specifications

### 8.1 Dependencies
- **Core**: Python 3.8+, asyncio for async operations
- **TUI**: curses or rich for terminal interface
- **HTTP**: requests or httpx for LLM API calls
- **JSON**: pydantic for schema validation
- **Config**: PyYAML for configuration management
- **Storage**: sqlite3 for session persistence

### 8.2 Performance Targets
- **Startup time**: < 1 second
- **Command execution**: < 100ms latency
- **Memory usage**: < 50MB baseline
- **Context compaction**: < 500ms for large sessions
- **Modal responsiveness**: < 50ms for UI interactions

### 8.3 Security Constraints
- **No network access** except configured LLM endpoint
- **No file access** outside project root
- **No TUI command execution**
- **Command validation** before execution
- **User confirmation** for new commands (unless gremlin mode)

This implementation plan provides a comprehensive roadmap for building all features specified in `idea.md` with clear phases, detailed specifications, and measurable success criteria.