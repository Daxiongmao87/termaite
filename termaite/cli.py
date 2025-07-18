"""Command-line interface for termaite."""

import argparse
import os
import sys
from typing import List, Optional

from colorama import init as colorama_init

from . import __version__
from .core.application import create_application
from .utils.logging import logger


def create_parser() -> argparse.ArgumentParser:
    """Create the command-line argument parser."""
    from .constants import CONFIG_DIR

    parser = argparse.ArgumentParser(
        description="term.ai.te: LLM-powered shell assistant with Plan-Act-Evaluate multi-agent architecture.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
  termaite "what is the best programming language"  # Simple response mode (default)
  termaite "take me to my home directory"           # Simple response with command
  termaite -a "create a backup of my documents"     # Agentic mode (multi-step)
  termaite --debug "find all large files over 100MB"
  termaite --init                                   # Initialize project-specific prompts
  termaite  # Interactive mode

Configuration:
  Default config directory: {CONFIG_DIR}
  Config files: config.yaml, payload.json, response_path_template.txt
  Use --config-dir to specify a custom location
  Use --edit-config to open config.yaml in your default editor

Operation Modes:
  Simple  - Direct LLM response with optional commands (default)
  Agentic - Plan-Act-Evaluate multi-agent architecture (use -a or -t flag)
  
  normal  - Allowed commands require confirmation, others are blocked
  gremlin - Allowed commands run automatically, others prompt for permission
  goblin  - All commands run without confirmation (USE WITH CAUTION!)
        """,
    )

    parser.add_argument(
        "task_prompt",
        nargs="*",
        help="Initial task description. If empty, enters interactive mode.",
    )

    parser.add_argument(
        "-a",
        "--agentic",
        action="store_true",
        help="Enable agentic mode (Plan-Act-Evaluate multi-agent architecture)",
    )

    parser.add_argument(
        "-t",
        "--task",
        action="store_true",
        help="Enable task mode (alias for agentic mode)",
    )

    parser.add_argument(
        "--version", action="version", version=f"termaite {__version__}"
    )

    parser.add_argument(
        "--debug", action="store_true", help="Enable debug logging output"
    )

    parser.add_argument(
        "--config-dir", type=str, help="Custom configuration directory path"
    )

    parser.add_argument(
        "--config-summary",
        action="store_true",
        help="Show configuration summary and exit",
    )

    parser.add_argument(
        "--config-location",
        action="store_true",
        help="Show configuration file locations and exit",
    )

    parser.add_argument(
        "--edit-config",
        action="store_true",
        help="Open configuration file in system default editor",
    )

    parser.add_argument(
        "--init",
        action="store_true",
        help="Initialize project-specific agent prompts by investigating the current directory",
    )

    return parser


def main(args: Optional[List[str]] = None) -> None:
    """Main entry point for the CLI."""
    # Capture the initial working directory before anything else
    # The Python process may start in the package directory due to editable install
    # Try to get the actual user directory from various sources
    initial_working_directory = (
        os.environ.get("TERMAITE_PWD")  # User can set this explicitly
        or os.environ.get("PWD")  # Shell working directory
        or os.getcwd()  # Fallback to Python's directory
    )

    # Initialize colorama for cross-platform colored output
    colorama_init(autoreset=True)

    # Parse command-line arguments
    parser = create_parser()
    parsed_args = parser.parse_args(args)

    # Initialize the application
    try:
        # Determine if agentic mode is requested
        agentic_mode = parsed_args.agentic or parsed_args.task

        app = create_application(
            config_dir=parsed_args.config_dir,
            debug=parsed_args.debug,
            initial_working_directory=initial_working_directory,
        )
    except SystemExit:
        # Configuration setup was needed - already handled
        return
    except Exception as e:
        logger.error(f"Failed to initialize termaite: {e}")
        sys.exit(1)

    # Handle config summary request
    if parsed_args.config_summary:
        app.print_config_summary()
        return

    # Handle config location request
    if parsed_args.config_location:
        app.print_config_location()
        return

    # Handle config editing request
    if parsed_args.edit_config:
        app.edit_config()
        return

    # Handle project initialization request
    if parsed_args.init:
        success = app.initialize_project_prompts()
        sys.exit(0 if success else 1)

    # Run in command-line or interactive mode
    if parsed_args.task_prompt:
        # Command-line mode: execute the given task
        user_task = " ".join(parsed_args.task_prompt)
        success = app.run_single_task(user_task, agentic_mode=agentic_mode)
        sys.exit(0 if success else 1)
    else:
        # Interactive mode
        app.run_interactive_mode(agentic_mode=agentic_mode)

    logger.system("termaite session ended.")


if __name__ == "__main__":
    main()
