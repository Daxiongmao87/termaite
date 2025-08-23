# Project: termaite - The Multi-CLI-Agent Wrapper

## 1. Core Concept

`termaite` is a command-line interface (CLI) wrapper that manages and rotates between multiple third-party CLI AI agents. The primary goal is to provide a unified interface that allows users to leverage multiple smaller subscriptions or free tiers from different AI providers, making the use of AI agents more affordable and flexible.

The wrapper maintains its own independent, project-specific chat history, removing the reliance on the internal history mechanisms of the wrapped agents.

This is a Node.js application that can be installed with npm.

## 2. Features

### 2.1. Agent Management
- **Agent Rotation:** Intelligently rotate between configured agents based on a user-defined strategy.
  - **Round-Robin:** Cycle through agents sequentially, maintaining state between sessions.
  - **Exhaustion:** Use agents in priority order (list order), only moving to the next agent when the current one fails.
  - **Random:** Select a random agent for each interaction.
- **Failure Handling:** When an agent fails, it enters a cool-down period with exponential backoff (1 minute, then 2 minutes, up to 30 minutes maximum).
- **Timeout Management:** Each agent can have a configurable timeout, with a global timeout override option.

### 2.2. Chat History
- **Project-Specific History:** Maintain a separate chat history for each project stored in JSONL format.
- **Automatic Compaction:** To manage context size, compaction is triggered automatically when the chat history exceeds 75% of the smallest context window defined among the configured agents.
- **Manual Compaction:** Users can manually trigger history compaction with the `/compact` command.
- **History Continuation:** Load chat history from the most recently used project with the `--continue` flag.

### 2.3. Commands
- **/clear:** Permanently delete the chat history for the current project.
- **/compact:** Manually trigger a summarization of the oldest 50% of the chat history.
- **/init:** Instruct `termaite` to investigate the current project, generating a comprehensive, high-level summary and guidelines for working within it.
- **/exit:** Gracefully exit the `termaite` application.
- **/help:** Display a list of available commands and their descriptions.
- **/switch [agent_name]:** Temporarily switch to a specific agent for the next interaction.
- **/config:** Open the global settings file (`~/.termaite/settings.json`) in the user's default text editor (defined by the `$EDITOR` environment variable).

### 2.4. User Experience (UX)
- **Interface:** The interface is a modern, chat-like application within the terminal, built with Node.js using the `blessed` library. It features a persistent input field at the bottom and a scrollable chat box at the top, with a double-line border and a gradient-colored title.
- **Startup Experience:** On first load, the application displays a welcome message with "Welcome to" followed by a large, multi-colored ASCII art representation of "TERMAITE". The colors are: TERM = red, AI = white, TE = blue.
- **Visual Feedback:** A pipe animation is displayed during agent processing to provide visual feedback.
- **Scrolling:** The chat box supports mouse wheel scrolling, PageUp/PageDown navigation, and has a software scrollbar.

## 3. Command-Line Interface

`termaite` can be launched with the following optional flags to control its initial state and behavior:

- **`-c`, `--continue`**: Automatically loads the chat history from the most recently used project.
- **`-a <agent>`, `--agent <agent>`**: Overrides the default rotation for the first turn, starting with the specified agent name. Defaults to none, which uses the configured rotation strategy.
- **`-r <strategy>`, `--rotation <strategy>`**: Overrides the `rotationStrategy` from `settings.json` for the current session. Accepts `round-robin`, `exhaustion`, or `random`.
- **`-p "prompt"`, `--prompt "prompt"`**: Enables non-interactive mode. The application will execute a single prompt with the chosen agent, print the result to stdout, and then exit. This is useful for scripting.

## 4. Technical Specifications

### 4.1. Configuration (`~/.termaite/settings.json`)
The global settings file is the primary method of configuration. It contains a user-defined list of agents and global settings for the wrapper.

- **`rotationStrategy` (String):** Defines the agent rotation method. Must be one of `round-robin`, `exhaustion` (default), or `random`.
- **`globalTimeoutSeconds` (Integer, Optional):** Global timeout override that overrides all individual agent timeouts. Use `null` to disable global override, `0` for no timeout.
- **`agents` (Array):** An array of agent objects, where each object must contain:
    - **`name` (String):** A unique, user-friendly name for the agent (e.g., "claude", "gemini").
    - **`command` (String):** The exact bash command required to invoke the agent. The wrapper will pipe the chat history and prompt to this command's stdin.
    - **`contextWindowTokens` (Integer):** The maximum number of tokens the agent's context window supports.
    - **`timeoutSeconds` (Integer, Optional):** The number of seconds to wait for a response before the agent is considered to have timed out. Defaults to 300 seconds if not set.

### 4.2. Chat History Storage
- **Format:** Chat history is stored in JSONL (JSON Lines) format.
- **Path:** The history for a project is saved at `~/.termaite/projects/<project-path-slug>/history.jsonl`. The project path is parsed into a filesystem-safe slug by replacing slashes with dashes.
- **Structure:** Each line in the history file is a JSON object with `sender` (user, agent, system), `text`, and `timestamp` fields.

### 4.3. Agent Interaction
- **Unavailability Detection & Resilience:** The wrapper gracefully handles unresponsive or failing agents.
    - **Adaptive Timeouts:** Each agent command is executed with a configurable timeout. If the process does not complete within this duration, it will be terminated, and the agent will be marked as failed for the current turn.
    - **Cool-down Periods:** Failed agents enter a cool-down period with exponential backoff. The cool-down starts at 1 minute and doubles with each consecutive failure, up to a maximum of 30 minutes.
    - **Automatic Retries:** When an agent fails, termaite automatically tries the next available agent.
- **Prompt Augmentation for Context:** To ensure the chat history remains coherent and useful when passed between different agents, the wrapper automatically augments prompts with:
    - Previous conversation context (last 10 messages)
    - The current user request
    - A meta-instruction requesting a comprehensive summary of actions and conclusions
- **Token Estimation:** A simple token estimation algorithm is used (1 token ≈ 4 characters) for determining when history compaction is needed.

### 4.4. Session State Persistence
- **Rotation State:** The current agent index for round-robin rotation is persisted in `~/.termaite/state.json` to maintain rotation state between sessions.

### 4.5. Supported Agents
The application includes configuration examples for:
- Claude
- Gemini
- Qwen
- Cursor
- Local models via llxprt