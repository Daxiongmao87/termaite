# Project: termaite - The Multi-CLI-Agent Wrapper

## 1. Core Concept

`termaite` is a command-line interface (CLI) wrapper that manages and rotates between multiple third-party CLI AI agents. The primary goal is to provide a unified interface that allows users to leverage multiple smaller subscriptions or free tiers from different AI providers, making the use of AI agents more affordable and flexible.

The wrapper will maintain its own independent, project-specific chat history, removing the reliance on the internal history mechanisms of the wrapped agents.

This is a Node.js application that can be installed with npm.

## 2. Features

### 2.1. Agent Management
- **Agent Rotation:** Intelligently rotate between configured agents based on a user-defined strategy.
  - **Round-Robin:** Cycle through agents sequentially.
  - **Exhaustion:** Use the same agent until it fails (e.g., quota error, timeout), then switch to the next.
  - **Random:** Select a random agent for each turn.
- **Quota Management:** (Future) Smartly skip agents that have reached their usage quota for the current billing period.

### 2.2. Chat History
- **Project-Specific History:** Maintain a separate chat history for each project.

### 2.3. Commands
- **/clear:** A command to permanently delete the chat history for the current project.
- **/compact:** A command to manually trigger a summarization of the oldest 50% of the chat history.
- **Automatic Compaction:** To manage context size, compaction will be triggered automatically whenever the chat history exceeds 75% of the smallest context window defined among the configured agents.
- **/init:** A command that instructs `termaite` to perform an investigation of the current project, generating a comprehensive, high-level summary and guidelines for working within it.
- **/exit:** A command to gracefully exit the `termaite` application.
- **/help:** A command to display a list of available commands and their descriptions.
- **/switch [agent_name]:** A command to manually select a specific agent for the next interaction. After the interaction, the system will revert to the default automated agent rotation mode.
- **/config:** A command that opens the global settings file (`~/.termaite/settings.json`) in the user's default text editor (defined by the `$EDITOR` environment variable).

### 2.4. User Experience (UX)
- **Interface:** The interface will be a modern, chat-like application within the terminal, built with Node.js. It will feature a persistent input field at the bottom and a scrollable chat box at the top, with a border that has a title.
- **Startup Experience:** On first load, the application will display a welcome message consisting of the text "Welcome to" followed by a large, solid-colored ASCII art representation of "TERMAITE". The color will match the color scheme of the UI's title border.

## 3. Command-Line Interface

`termaite` can be launched with the following optional flags to control its initial state and behavior:

- **`-c`, `--continue`**: Automatically loads the chat history from the most recently used project.
- **`-a <agent>`, `--agent <agent>`**: Overrides the default rotation for the first turn, starting with the specified agent name. Defaults to `auto`, which uses the configured rotation strategy.
- **`-r <strategy>`, `--rotation <strategy>`**: Overrides the `rotationStrategy` from `settings.json` for the current session. Accepts `round-robin`, `exhaustion`, or `random`.
- **`-p "prompt"`, `--prompt "prompt"`**: Enables non-interactive mode. The application will execute a single prompt with the chosen agent, print the result to stdout, and then exit. This is useful for scripting.

## 4. Technical Specifications

### 4.1. Configuration (`~/.termaite/settings.json`)
The global settings file is the primary method of configuration. It will contain a user-defined list of agents and global settings for the wrapper.

- **`rotationStrategy` (String):** Defines the agent rotation method. Must be one of `round-robin` (default), `exhaustion`, or `random`.
- **`agents` (Array):** An array of agent objects, where each object must contain:
    - **`name` (String):** A unique, user-friendly name for the agent (e.g., "claude", "gemini-pro").
    - **`command` (String):** The exact bash command required to invoke the agent. The wrapper will pipe the chat history and prompt to this command's stdin.
    - **`contextWindowTokens` (Integer):** The maximum number of tokens the agent's context window supports.
    - **`timeoutSeconds` (Integer, Optional):** The number of seconds to wait for a response before the agent is considered to have timed out. Defaults to a global value if not set.

### 4.2. Chat History Storage
- **Location:** Chat history will be stored in a JSONL (JSON Lines) format.
- **Path:** The history for a project will be saved at `~/.termaite/projects/<project-path-slug>/history.jsonl`. The project path will be parsed into a filesystem-safe slug.

### 4.3. Agent Interaction
- **Unavailability Detection & Resilience:** The wrapper must gracefully handle unresponsive or failing agents.
    - **Adaptive Timeouts:** Each agent command is executed with a configurable timeout. If the process does not complete within this duration, it will be terminated, and the agent will be marked as failed for the current turn.
    - **Temporary Disabling:** If an agent fails consecutively (e.g., 3 times in a row), it will be temporarily removed from the rotation pool for a cool-down period to prevent repeated failures.
- **Prompt Augmentation for Context:** To ensure the chat history remains coherent and useful when passed between different agents, the wrapper will automatically append a meta-instruction to every user prompt. This instruction will request that the agent provide a comprehensive summary of its actions and conclusions upon completing its task. This is critical for maintaining context.
