"""Main application class for termaite."""

import signal
import shutil
import sys
import os
from typing import Optional, List, Dict, Any
from pathlib import Path
import time

from ..config.manager import create_config_manager
from ..core.task_handler import create_task_handler
from ..core.simple_handler import create_simple_handler
from ..utils.logging import logger
from ..utils.helpers import check_dependencies
from ..constants import CLR_BOLD_RED, CLR_RESET


class InteractiveSession:
    """Manages session state for interactive mode."""

    def __init__(self):
        """Initialize interactive session."""
        self.conversation_history: List[Dict[str, Any]] = []
        self.session_start_time = time.time()
        self.command_count = 0

    def add_interaction(
        self,
        user_prompt: str,
        ai_response: str,
        command_executed: Optional[str] = None,
        success: bool = True,
    ):
        """Add an interaction to the session history.

        Args:
            user_prompt: The user's input
            ai_response: The AI's response summary
            command_executed: Command that was executed (if any)
            success: Whether the interaction was successful
        """
        interaction = {
            "timestamp": time.time(),
            "user_prompt": user_prompt,
            "ai_response": ai_response,
            "command_executed": command_executed,
            "success": success,
        }
        self.conversation_history.append(interaction)

        # Keep only last 10 interactions to avoid memory issues
        if len(self.conversation_history) > 10:
            self.conversation_history.pop(0)

    def get_context_summary(self) -> str:
        """Get a summary of recent interactions for context.

        Returns:
            Formatted context summary
        """
        if not self.conversation_history:
            return "No previous interactions in this session."

        context_lines = ["Recent conversation context:"]
        for i, interaction in enumerate(
            self.conversation_history[-3:], 1
        ):  # Last 3 interactions
            user_prompt = (
                interaction["user_prompt"][:100] + "..."
                if len(interaction["user_prompt"]) > 100
                else interaction["user_prompt"]
            )
            ai_response = (
                interaction["ai_response"][:100] + "..."
                if len(interaction["ai_response"]) > 100
                else interaction["ai_response"]
            )

            context_lines.append(f"{i}. User: {user_prompt}")
            context_lines.append(f"   AI: {ai_response}")
            if interaction["command_executed"]:
                context_lines.append(f"   Command: {interaction['command_executed']}")

        return "\n".join(context_lines)

    def get_stats(self) -> Dict[str, Any]:
        """Get session statistics.

        Returns:
            Session statistics
        """
        session_duration = time.time() - self.session_start_time
        successful_interactions = sum(
            1 for i in self.conversation_history if i["success"]
        )

        return {
            "session_duration": session_duration,
            "total_interactions": len(self.conversation_history),
            "successful_interactions": successful_interactions,
            "commands_executed": sum(
                1 for i in self.conversation_history if i["command_executed"]
            ),
        }


class TermAIte:
    """Main application class for term.ai.te."""

    def __init__(
        self,
        config_dir: Optional[str] = None,
        debug: bool = False,
        initial_working_directory: Optional[str] = None,
    ):
        """Initialize the termaite application.

        Args:
            config_dir: Custom configuration directory path
            debug: Enable debug logging
            initial_working_directory: The working directory where the application was started
        """
        # Store the initial working directory
        self.initial_working_directory = initial_working_directory or os.getcwd()

        # Set up logging first
        logger.set_debug(debug)

        # Initialize configuration manager
        config_path = Path(config_dir) if config_dir else None
        self.config_manager = create_config_manager(config_path)

        # Get configuration
        self.config = self.config_manager.config

        # Update debug setting from config if not explicitly set
        if not debug and self.config.get("enable_debug", False):
            logger.set_debug(True)

        # Check dependencies
        check_dependencies()

        # Initialize task handler and simple handler with initial working directory
        self.task_handler = create_task_handler(
            self.config, self.config_manager, self.initial_working_directory
        )
        self.simple_handler = create_simple_handler(
            self.config, self.config_manager, self.initial_working_directory
        )

        # Set up signal handlers
        self._setup_signal_handlers()

        # Initialize interactive session (only used in interactive mode)
        self._interactive_session: Optional[InteractiveSession] = None

        logger.debug("Application initialization complete")

    def handle_task(self, prompt: str, agentic_mode: bool = False) -> bool:
        """Handle a user task using either simple or agentic mode.

        Args:
            prompt: The user's task request
            agentic_mode: If True, use Plan-Act-Evaluate loop; if False, use simple response

        Returns:
            True if task completed successfully, False otherwise
        """
        try:
            if agentic_mode:
                return self.task_handler.handle_task(prompt)
            else:
                return self.simple_handler.handle_simple_request(prompt)
        except KeyboardInterrupt:
            logger.system("Task interrupted by user")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during task handling: {e}")
            return False

    def run_interactive_mode(self, agentic_mode: bool = False) -> None:
        """Run the application in interactive mode.

        Args:
            agentic_mode: Default mode for interactive session
        """
        # Initialize interactive session
        self._interactive_session = InteractiveSession()

        mode_name = "agentic" if agentic_mode else "simple"
        logger.system(
            f"Starting interactive mode ({mode_name}). Type '/exit', '/quit', or use Ctrl+C to stop."
        )
        logger.system(
            "Commands: -a <prompt> for agentic mode, -s <prompt> for simple mode"
        )
        logger.system(
            "Meta commands: /exit, /quit, /help, /history, /stats, /clear, /init"
        )

        # Show tip about /init if no .termaite folder exists
        self._show_init_tip_if_needed()

        try:
            while True:
                try:
                    # Get user input
                    user_input = input(f"\n{CLR_BOLD_RED}termaite>{CLR_RESET} ").strip()

                    # Handle meta commands
                    if user_input.startswith("/"):
                        if self._handle_meta_command(user_input):
                            continue
                        else:
                            # /exit command - break out of loop
                            break

                    # Check for legacy exit commands
                    if user_input.lower() in ["exit", "quit", "q"]:
                        logger.system("Goodbye!")
                        break

                    # Skip empty input
                    if not user_input:
                        continue

                    # Parse mode flags
                    current_agentic_mode = agentic_mode
                    prompt = user_input

                    if user_input.startswith("-a "):
                        current_agentic_mode = True
                        prompt = user_input[3:].strip()
                    elif user_input.startswith("-s "):
                        current_agentic_mode = False
                        prompt = user_input[3:].strip()

                    if not prompt:
                        logger.warning("Empty prompt after mode flag")
                        continue

                    # Add context from previous interactions if available
                    if self._interactive_session.conversation_history:
                        context_summary = (
                            self._interactive_session.get_context_summary()
                        )
                        enhanced_prompt = (
                            f"Context from previous interactions:\\n{context_summary}\\n\\n"
                            f"Current request: {prompt}"
                        )
                    else:
                        enhanced_prompt = prompt

                    # Handle the task
                    success = self._handle_task_with_session_tracking(
                        enhanced_prompt, prompt, agentic_mode=current_agentic_mode
                    )

                    if not success:
                        logger.warning("Task did not complete successfully")

                except KeyboardInterrupt:
                    logger.system(
                        "\nOperation cancelled. Use '/exit' or '/quit' to stop gracefully"
                    )
                    continue
                except EOFError:
                    logger.system("\nGoodbye!")
                    break
                except Exception as e:
                    logger.error(f"Error processing request: {e}")
                    logger.system("Session continues. Use '/exit' to quit.")
                    continue

        except Exception as e:
            logger.error(f"Fatal error in interactive mode: {e}")
            logger.system("Interactive session ended due to error.")
            return

        # Clean up session
        if self._interactive_session:
            stats = self._interactive_session.get_stats()
            logger.system(
                f"Session ended. Duration: {stats['session_duration']:.1f}s, "
                f"Interactions: {stats['total_interactions']}"
            )
            self._interactive_session = None

    def run_single_task(self, task: str, agentic_mode: bool = False) -> bool:
        """Run a single task and exit.

        Args:
            task: Task to execute
            agentic_mode: Whether to use agentic or simple mode

        Returns:
            True if task completed successfully, False otherwise
        """
        return self.handle_task(task, agentic_mode=agentic_mode)

    def _setup_signal_handlers(self) -> None:
        """Set up signal handlers for graceful shutdown."""

        def signal_handler(sig, frame):
            logger.system(f"Received signal {sig}, shutting down gracefully...")
            sys.exit(0)

        # Handle common termination signals
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Handle SIGHUP on Unix systems
        if hasattr(signal, "SIGHUP"):
            signal.signal(signal.SIGHUP, signal_handler)

    def get_config_summary(self) -> dict:
        """Get a summary of the current configuration.

        Returns:
            Dictionary with configuration summary
        """
        return {
            "endpoint": self.config.get("endpoint", "Not set"),
            "operation_mode": self.config.get("operation_mode", "normal"),
            "command_timeout": self.config.get("command_timeout", 30),
            "enable_debug": self.config.get("enable_debug", False),
            "allow_clarifying_questions": self.config.get(
                "allow_clarifying_questions", True
            ),
            "allowed_commands_count": len(self.config_manager.allowed_commands),
            "blacklisted_commands_count": len(self.config_manager.blacklisted_commands),
        }

    def print_config_summary(self) -> None:
        """Print a summary of the current configuration."""
        summary = self.get_config_summary()

        logger.system("Configuration Summary:")
        for key, value in summary.items():
            logger.system(f"  {key}: {value}")

    def print_config_location(self) -> None:
        """Print the configuration file locations."""
        logger.system("Configuration File Locations:")
        logger.system(f"  Config directory: {self.config_manager.config_dir}")
        logger.system(f"  Config file: {self.config_manager.config_file}")
        logger.system(f"  Payload file: {self.config_manager.payload_file}")
        logger.system(f"  Response template: {self.config_manager.response_path_file}")

        # Check if files exist
        files_status = []
        for name, path in [
            ("Config", self.config_manager.config_file),
            ("Payload", self.config_manager.payload_file),
            ("Response template", self.config_manager.response_path_file),
        ]:
            status = "✓ exists" if path.exists() else "✗ missing"
            files_status.append(f"  {name}: {status}")

        logger.system("File Status:")
        for status in files_status:
            logger.system(status)

    def _handle_meta_command(self, command: str) -> bool:
        """Handle meta commands in interactive mode.

        Args:
            command: The meta command to handle

        Returns:
            True to continue interactive loop, False to exit
        """
        if not self._interactive_session:
            return True

        command = command.lower()

        if command in ["/exit", "/quit"]:
            logger.system("Goodbye!")
            return False

        elif command == "/help":
            logger.system("Available commands:")
            logger.system("  /exit, /quit - Exit the interactive mode")
            logger.system("  /help - Show this help message")
            logger.system("  /history - Show conversation history")
            logger.system("  /stats - Show session statistics")
            logger.system("  /clear - Clear conversation history")
            logger.system("  /init - Initialize project-specific agent prompts")
            logger.system("  -a <prompt> - Use agentic mode for this prompt")
            logger.system("  -s <prompt> - Use simple mode for this prompt")
            return True

        elif command == "/history":
            if not self._interactive_session.conversation_history:
                logger.system("No conversation history in this session.")
            else:
                logger.system("Conversation History:")
                for i, interaction in enumerate(
                    self._interactive_session.conversation_history, 1
                ):
                    timestamp = time.strftime(
                        "%H:%M:%S", time.localtime(interaction["timestamp"])
                    )
                    user_text = (
                        interaction["user_prompt"][:100] + "..."
                        if len(interaction["user_prompt"]) > 100
                        else interaction["user_prompt"]
                    )
                    ai_text = (
                        interaction["ai_response"][:100] + "..."
                        if len(interaction["ai_response"]) > 100
                        else interaction["ai_response"]
                    )
                    logger.system(f"{i}. [{timestamp}] User: {user_text}")
                    logger.system(f"   AI: {ai_text}")
                    if interaction["command_executed"]:
                        logger.system(f"   Command: {interaction['command_executed']}")
            return True

        elif command == "/stats":
            stats = self._interactive_session.get_stats()
            logger.system("Session Statistics:")
            logger.system(f"  Duration: {stats['session_duration']:.1f} seconds")
            logger.system(f"  Total interactions: {stats['total_interactions']}")
            logger.system(
                f"  Successful interactions: {stats['successful_interactions']}"
            )
            logger.system(f"  Commands executed: {stats['commands_executed']}")
            return True

        elif command == "/clear":
            self._interactive_session.conversation_history.clear()
            logger.system("Conversation history cleared.")
            return True

        elif command == "/init":
            logger.system("Starting project initialization...")
            success = self.initialize_project_prompts()
            if success:
                logger.system("Project initialization completed successfully!")
            else:
                logger.error("Project initialization failed.")
            return True

        else:
            logger.warning(
                f"Unknown meta command: {command}. Use '/help' for available commands."
            )
            return True

    def _handle_task_with_session_tracking(
        self, enhanced_prompt: str, original_prompt: str, agentic_mode: bool = False
    ) -> bool:
        """Handle a task and track it in the interactive session.

        Args:
            enhanced_prompt: The prompt with context added
            original_prompt: The original user prompt
            agentic_mode: Whether to use agentic mode

        Returns:
            True if task completed successfully, False otherwise
        """
        try:
            # Handle the task
            success = self.handle_task(enhanced_prompt, agentic_mode=agentic_mode)

            # Extract a summary of the AI response for session tracking
            # This is a simple implementation - in a real system you'd want to capture the actual AI response
            ai_response_summary = (
                "Task completed successfully" if success else "Task failed"
            )

            # Track the interaction
            if self._interactive_session:
                self._interactive_session.add_interaction(
                    user_prompt=original_prompt,
                    ai_response=ai_response_summary,
                    command_executed=None,  # Would need to be captured from the actual execution
                    success=success,
                )

            return success

        except Exception as e:
            logger.error(f"Error handling task: {e}")
            if self._interactive_session:
                self._interactive_session.add_interaction(
                    user_prompt=original_prompt,
                    ai_response=f"Error: {str(e)}",
                    command_executed=None,
                    success=False,
                )
            return False

    def edit_config(self) -> None:
        """Open the configuration file in the system's default editor."""
        import subprocess
        import os

        config_file = self.config_manager.config_file

        # Check if config file exists
        if not config_file.exists():
            logger.error(f"Configuration file not found: {config_file}")
            logger.system("Run termaite once to generate config templates first.")
            return

        # Determine the editor to use
        editor = os.environ.get("EDITOR") or os.environ.get("VISUAL")

        if not editor:
            # Try common editors as fallbacks
            for candidate in ["nano", "vim", "vi", "gedit", "kate", "code"]:
                if shutil.which(candidate):
                    editor = candidate
                    break

        if not editor:
            logger.error("No suitable editor found.")
            logger.error("Set the EDITOR environment variable or install nano/vim/vi.")
            logger.system(f"Config file location: {config_file}")
            return

        logger.system(f"Opening {config_file} with {editor}")

        try:
            # Open the editor
            subprocess.run([editor, str(config_file)], check=True)
            logger.system("Config file editor closed.")
        except subprocess.CalledProcessError as e:
            logger.error(f"Editor exited with error code {e.returncode}")
        except FileNotFoundError:
            logger.error(f"Editor '{editor}' not found")
        except KeyboardInterrupt:
            logger.system("Editor interrupted by user")
        except Exception as e:
            logger.error(f"Error opening editor: {e}")

    def initialize_project_prompts(self) -> bool:
        """Initialize project-specific agent prompts by investigating the current directory.

        This method will:
        1. Use an agent to investigate the current project thoroughly
        2. Generate customized prompts for Planner, Actor, and Evaluator agents
        3. Save these prompts to .termaite/ folder for future use

        Returns:
            True if initialization completed successfully, False otherwise
        """
        try:
            # Create .termaite directory if it doesn't exist
            termaite_dir = Path(self.initial_working_directory) / ".termaite"
            termaite_dir.mkdir(exist_ok=True)
            logger.system(f"Created/verified .termaite directory: {termaite_dir}")

            # Step 1: Investigate the project
            logger.system("🔍 Step 1: Investigating project directory...")
            project_investigation_prompt = self._create_project_investigation_prompt()

            # Use agentic mode to investigate the project
            investigation_success = self.handle_task(
                project_investigation_prompt, agentic_mode=True
            )
            if not investigation_success:
                logger.error("Failed to investigate project directory")
                return False

            # For now, we'll need to capture the investigation results from the LLM
            # This is a limitation we'll work around by asking for a summary

            # Step 2: Generate Planner prompt
            logger.system("📋 Step 2: Generating Planner prompt...")
            planner_prompt = self._create_agent_customization_prompt(
                "Planner", self.config.get("plan_prompt", ""), "planning phase"
            )

            planner_success = self.handle_task(planner_prompt, agentic_mode=True)
            if not planner_success:
                logger.error("Failed to generate Planner prompt")
                return False

            # Step 3: Generate Actor prompt
            logger.system("⚡ Step 3: Generating Actor prompt...")
            actor_prompt = self._create_agent_customization_prompt(
                "Actor", self.config.get("action_prompt", ""), "action execution phase"
            )

            actor_success = self.handle_task(actor_prompt, agentic_mode=True)
            if not actor_success:
                logger.error("Failed to generate Actor prompt")
                return False

            # Step 4: Generate Evaluator prompt
            logger.system("📊 Step 4: Generating Evaluator prompt...")
            evaluator_prompt = self._create_agent_customization_prompt(
                "Evaluator", self.config.get("evaluate_prompt", ""), "evaluation phase"
            )

            evaluator_success = self.handle_task(evaluator_prompt, agentic_mode=True)
            if not evaluator_success:
                logger.error("Failed to generate Evaluator prompt")
                return False

            logger.system("✅ Project initialization completed successfully!")
            logger.system(
                f"Project-specific prompts have been saved to: {termaite_dir}"
            )
            logger.system(
                "These will be automatically used for future operations in this directory."
            )

            return True

        except Exception as e:
            logger.error(f"Error during project initialization: {e}")
            return False

    def _create_project_investigation_prompt(self) -> str:
        """Create a prompt for investigating the current project."""
        return f"""I need you to investigate this project directory thoroughly to understand what type of project this is.

Please examine the current directory structure, file types, content samples, configuration files, documentation, and any other relevant information to determine:

1. What type of project this is (e.g., software project, novel/book, research paper, business documents, game, website, etc.)
2. What domain or field it relates to
3. What the primary goals and purposes of this project appear to be
4. What tools, technologies, or methodologies are being used
5. What patterns and conventions are followed

Please be thorough in your investigation. Look at:
- Directory structure and organization
- File extensions and types present
- README files or documentation
- Configuration files
- Sample content from key files
- Any build files, package files, or project metadata
- Version control information if present

Start by listing the contents of the current directory, then dive deeper into the most relevant subdirectories and files to understand the project's nature and purpose.

Current directory: {self.initial_working_directory}

Be comprehensive but practical in your investigation - we want to understand this project well enough to customize AI agents to work effectively within its context."""

    def _create_agent_customization_prompt(
        self, agent_name: str, current_prompt: str, phase_description: str
    ) -> str:
        """Create a prompt for customizing a specific agent's system prompt."""
        return f"""Based on your investigation of this project, I need you to enhance the {agent_name} agent's system prompt to be specifically tailored for this type of project.

Current {agent_name} system prompt:
---
{current_prompt}
---

Your task is to append project-specific role instructions to this prompt that will help the {agent_name} agent understand:

1. The specific domain/field this project operates in
2. Common patterns, conventions, and best practices for this type of project
3. Relevant tools, technologies, or methodologies specific to this project type
4. Domain-specific terminology and concepts the agent should be aware of
5. Common tasks and workflows specific to this project type
6. Any special considerations or constraints for working with this type of project

Please provide the enhanced prompt with the additional role instructions appended. The enhanced prompt should:
- Keep all the original functionality and formatting requirements
- Add specific domain knowledge relevant to this project type
- Include guidance on project-specific best practices
- Help the agent make more informed decisions for this particular domain

Write the enhanced prompt and save it to .termaite/{agent_name.upper()}.md

The enhanced prompt should make the {agent_name} agent much more effective when working on {phase_description} tasks for this specific type of project."""

    def _show_init_tip_if_needed(self) -> None:
        """Show a tip about the /init command if no .termaite folder exists."""
        termaite_dir = Path(self.initial_working_directory) / ".termaite"

        if not termaite_dir.exists():
            logger.system("")
            logger.system("💡 Tip: You're in a new project directory!")
            logger.system(
                "   Consider running '/init' to let the AI agents investigate"
            )
            logger.system(
                "   this project and customize themselves for better performance."
            )
            logger.system(
                "   This creates project-specific agent prompts in .termaite/"
            )
            logger.system("")


def create_application(
    config_dir: Optional[str] = None,
    debug: bool = False,
    initial_working_directory: Optional[str] = None,
) -> TermAIte:
    """Create and initialize a TermAIte application instance.

    Args:
        config_dir: Custom configuration directory path
        debug: Enable debug logging
        initial_working_directory: The working directory where the application was started

    Returns:
        Initialized TermAIte instance
    """
    return TermAIte(config_dir, debug, initial_working_directory)
