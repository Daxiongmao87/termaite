# Termaite 
Termaite is a python-based terminal agent that uses bash commands as tool calls.  It should be installable via pip.  It runs in a simple, yet clean TUI and has the following builtin commands:

- /new - creates a new session
- /history - modal pops up allowing you to browse sesison history, allows you to resume by hitting enter, or delete by hitting the del key
- /config - opens config file via $EDITOR which contains the LLM endpoint (example: http://10.241.0.7:11434/v1), context window, gremlin mode, etc
- /model - modal pops up displaying currently selected model and available models (queried using openai api and the endpoint defined in /config)
- /init - runs project initialization to create .TERMAITE.md context file
- /exit 

## Pre-Operation

Termaite will not be usable without first a valid config.  If one does not exist, it should be automatically created on first run with a self-explanatory template containing all the necessary variable keys and instructions on how/what to fill.  The user should be informed that they need to update the config in order for termaite to work.  There should be an option for Gremlin Mode (gremlin_mode).

## Project Initialization

The `--init` flag (or `/init` TUI command) runs a project initialization process:

1. **Project Discovery**: Analyze the current directory structure, files, and project type
2. **Context Generation**: Create a `.TERMAITE.md` file in the project root containing:
   - Project purpose and description
   - Key features and functionality
   - Project structure overview
   - General operational guidance for this project **type** (not project-specific details)

This `.TERMAITE.md` file is automatically appended to the system prompt for all AI interactions within this project, providing context-aware assistance. The AI agent should update this file when the project structure or purpose changes significantly.

## TUI Interface

The TUI should function as a chatbox-style interface:

- **Input Area**: Fixed at the bottom of the screen for user input
- **Conversation Display**: The rest of the screen shows the conversation history between user and agent
- **Message Flow**: Messages appear chronologically with clear visual distinction between:
  - User messages (user input/commands)
  - Agent messages (JSON responses formatted for readability)
  - System messages (built-in command results, errors, etc.)
- **Built-in Commands**: Commands starting with `/` are processed by the TUI itself:
  - `/new` - Clear conversation and start new session
  - `/history` - Open modal to browse/resume/delete sessions
  - `/config` - Open config file in $EDITOR
  - `/model` - Open modal to view/select available models
  - `/init` - Run project initialization
  - `/exit` - Exit application
- **Scrolling**: Support scrolling through conversation history
- **Real-time Updates**: Show agent processing and command execution in real-time
- **Working Indicator**: Display animated "Working..." placeholder while agent is processing (before output appears)

## Operation

When termaite is given a task, Termaite operates as follows

1. If no goal statement exists, create one (SYSTEM RESPONSIBILITY: this must not be changeable after creation, and must be cleared after task is marked as complete)
2. If no plan exists, create one (SYSTEM RESPONSIBILITY: each step in the plan cannot be more than 1 bash command, and thus must be checked)
3. Determine, based on the last output, if the goal statement is satisfied.  If so, mark task as done, if not, continue.
4. Determine, based on the last output, if any revision to the plan must be made.  If so, update the plan
5. Determine the task step the operation is currently on.
6. Provide the command that will accomplish this task step.

The goal statement and plan exist beyond the session history and are fed into the AI as part of its system prompt so that it is always aware of the goal and plan.

## Schemas
The LLM should be instructed to ONLY RESPOND IN JSON FORMAT!

### Goal Statement
Only happens and MUST happen at the beginning of every task
```
{
    "message": "I need to create a goal statement for this task",
    "operation": {
        "create_goal": {
            "statement": "The project contains x y and z in folders 3 4 and 5"
        }
    }
}
```
### Task Status
```
{
    "message": "Based on the current state of the task and the goal statement -- <goal statement> -- we still have to <list key todo items from the plan>",
    "operation": {
        "determine_task_status": "IN_PROGRESS"
    }
}
```
### Plan Management
```
{
    "message": "Based on the output on the latest command, I need to manage the plan by inserting/editing/deleting etc...",
    "operation": {
        "manage_plan": [
            {
                "step": 1,
                "action": "INSERT",
                "description": "Description of step."
            },
            {
                "step": 2,
                "action": "EDIT",
                "description": "Description of step"
            }
       ]
    }
}
```
### Bash Command
```
{
    "message": "In order to perform X step I need to invoke Y command so that Z happens",
    "operation": {
        "invoke_bash_command": {
            "command": "command to run"
        }
    }
}
```

## System Prompts
**EACH STEP OUTLINED ABOVE REQUIRES ITS OWN SYSTEM PROMPT**
This is to help isolate and separate roles and responsibilities.

### Goal Statement System Prompt
Encourage to provide an accurate and testable goal statement to satisfy the user's prompt.

### Task Status System Prompt
Encourage a adversarial and scrutinizing behavior to determine if the goal statement is satisfied, with absolutely no excuses.

### Plan Management System Prompt
If no plan exists, enourage to create a granular and iterative step-by-step plan to accomplish the goal statement.  If a plan does exist, verify the alignment of the plan's next steps with the output of the previous commands and make adjustments accordingly.  This includes seeking out more information for better strategic decisions to accomplish the goal statement, or to change commands based on new information.

### Bash Command
Encourage to use all **NON-TUI** bash commands.  It is forbidden to use TUI-based commands and goes against the agentic intent of this application, as it is unable to navigate TUIs.  This includes even applications that require user confirmation or any user intervention.  

## Other Features

- Whitelist: Any command (not including the arguments) the agent tries to run that has not been run before the user must confirm: y/n/a (yes, no, always).  Always will add to a whitelist
- Gremlin Mode: Disables user confirmation requirements and can be dangerous as it allows the AI to run any bash command.
- Session History: The session's output should be preserved word-for-word for the user, but the agent would have a different history that uses compation to fit it within its context window
- Compaction: The system needs to estimate the number of tokens AI's version of the session history has, and once exceeding 75% of the context window, the system must do the following: Take the oldest 50% of the session output (no clipping, include all the text of an output even if it extends beyong 50%) and ask the LLM to summarize it to a single paragraph.  Then replace the oldest 50% we just summarized with this new summary.  ALWAYS preserve the user's original prompt.  This needs to be checked before every single LLM endpoint call that affects the session history length.
- Filesystem Protection: The command parser must include a detection mechanism that determines if the AI is attempting to run commands outside of the project folder root (root folder is wherever the termaite app is invoked). This can be done by determining a path string in a command and testing it to see if it does not fall within the project root.
- Hardcoded list of operational commands (This is separate to the whitelist).  These are fundamental commands to suggest to the AI for navigational and manipulation.  Example Ideas:
    - Using the find command to list all directories and/or files
    - Using sed to read parts of a file
    - Using sed to write into a file
    - Using mkdir to make a directory
- Defensive Reading: Context windows are a great limitation to LLMs.  So, we need our system prompt to determine if an output exceeds a certain amount of bytes (if it's anymore than 50% of the context window).  If it does, instead of returning the output, we must instead return an error to inform the LLM that the output is too large and will need to re-invoke the command in a way to get partial output (maybe sed), performing a more targetted search of information it needs, and that it can do this multiple times to hone in.
