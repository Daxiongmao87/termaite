"""Project initialization task handler using existing agentic architecture."""

import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..llm.parsers import (
    extract_and_save_generated_files,
    validate_generated_prompt_files,
)
from ..utils.logging import logger
from .task_handler import TaskHandler


class ProjectInitializationTask:
    """Handles project initialization using the existing Plan-Act-Evaluate architecture."""

    def __init__(self, task_handler: TaskHandler, initial_working_directory: str):
        """Initialize project initialization task.

        Args:
            task_handler: Existing task handler with Plan-Act-Evaluate loop
            initial_working_directory: Directory to analyze and initialize
        """
        self.task_handler = task_handler
        self.initial_working_directory = initial_working_directory
        self.termaite_dir = Path(initial_working_directory) / ".termaite"
        self.captured_responses = []

    def execute(self) -> bool:
        """Execute project initialization using two independent agentic tasks.

        Step 1: Independent agentic task to investigate codebase
        Step 2: Independent agentic task to write prompt files using step 1 results

        Returns:
            True if initialization completed successfully, False otherwise
        """
        try:
            # Create .termaite directory
            self.termaite_dir.mkdir(exist_ok=True)
            logger.system(f"Created/verified .termaite directory: {self.termaite_dir}")

            # Add necessary investigation commands temporarily
            self._add_investigation_commands()

            # STEP 1: Independent agentic investigation task with retry until success
            logger.system("🔍 Step 1: Running independent agentic investigation...")
            investigation_attempt = 0
            investigation_summary = None

            while not investigation_summary:
                investigation_attempt += 1
                if investigation_attempt > 1:
                    logger.system(
                        f"🔍 Step 1: Retrying investigation (Attempt {investigation_attempt})..."
                    )

                investigation_task = self._create_investigation_task()
                (
                    investigation_success,
                    investigation_context,
                ) = self.task_handler.handle_task(investigation_task)

                if investigation_success:
                    # Extract investigation summary from task handler results
                    investigation_summary = self._extract_investigation_summary(
                        investigation_context
                    )
                    if investigation_summary:
                        logger.system(
                            f"✅ Step 1: Investigation completed successfully on attempt {investigation_attempt}"
                        )
                        break
                    else:
                        logger.warning(
                            f"⚠️  Step 1: Investigation completed but summary extraction failed (Attempt {investigation_attempt})"
                        )
                else:
                    logger.warning(
                        f"⚠️  Step 1: Investigation failed, retrying... (Attempt {investigation_attempt})"
                    )

                # Brief pause before retry to avoid hammering the LLM
                import time

                time.sleep(1)

            # STEP 2: Independent agentic prompt generation task with retry until success
            logger.system("📝 Step 2: Running independent agentic prompt generation...")
            generation_attempt = 0
            generation_success = False

            while not generation_success:
                generation_attempt += 1
                if generation_attempt > 1:
                    logger.system(
                        f"📝 Step 2: Retrying prompt generation (Attempt {generation_attempt})..."
                    )

                generation_task = self._create_prompt_generation_task(
                    investigation_summary
                )
                generation_success, _ = self.task_handler.handle_task(generation_task)

                if generation_success:
                    logger.system(
                        f"✅ Step 2: Prompt generation completed successfully on attempt {generation_attempt}"
                    )
                    break
                else:
                    logger.warning(
                        f"⚠️  Step 2: Prompt generation failed, retrying... (Attempt {generation_attempt})"
                    )

                # Brief pause before retry to avoid hammering the LLM
                import time

                time.sleep(1)

            # Validate the generated files (agent should have created them)
            termaite_dir = Path(self.initial_working_directory) / ".termaite"
            expected_files = [
                termaite_dir / "PLANNER.md",
                termaite_dir / "ACTOR.md",
                termaite_dir / "EVALUATOR.md",
            ]

            created_files = [str(f) for f in expected_files if f.exists()]

            if created_files:
                valid, issues = validate_generated_prompt_files(created_files)

                if valid:
                    logger.system("✅ Project initialization completed successfully!")
                    logger.system(
                        f"Created {len(created_files)} project-specific prompt files:"
                    )
                    for file_path in created_files:
                        logger.system(f"  - {file_path}")
                    logger.system(
                        "These will be automatically used for future operations in this directory."
                    )
                    return True
                else:
                    logger.warning("⚠️  Project initialization completed with issues:")
                    for issue in issues:
                        logger.warning(f"  - {issue}")
                    logger.system("Files were created but may need manual review.")
                    return True
            else:
                logger.error("❌ No prompt files were created")
                return False

        except Exception as e:
            logger.error(f"Error during project initialization: {e}")
            return False

    def _create_investigation_task(self) -> str:
        """Create Step 1: Independent agentic task to investigate the project."""
        return f"""Quickly investigate the project directory {self.initial_working_directory} to identify its type for customizing AI agent prompts.

FOCUS ONLY ON:
1. List directory contents with 'ls -la {self.initial_working_directory}'
2. Check for key files indicating project type:
   - README.md or README.txt (read first 20 lines)
   - package.json, pyproject.toml, Cargo.toml, or similar (read first 10 lines)
   - Primary source directory structure

GOAL: Quickly determine if this is a Python library, web app, CLI tool, game, or other project type.
TIME LIMIT: Complete investigation in under 1 minute. Be efficient and focused."""

    def _create_prompt_generation_task(self, investigation_summary: str) -> str:
        """Create Step 2: Independent agentic task to generate the three prompt files."""
        return f"""You are a senior software architect. Your task is to create behavioral guidelines for AI agents based on the project **type** identified in the following summary.

**Project Investigation Summary:**
---
{investigation_summary}
---

TASK: Create exactly 3 files with behavioral guidance.

DEFINITION OF DONE: Task complete only when ALL THREE files exist in .termaite/ directory:
- .termaite/PLANNER.md
- .termaite/ACTOR.md  
- .termaite/EVALUATOR.md

STEPS:
1. Identify project type from summary
2. Create all 3 files using: cat > .termaite/FILENAME.md << 'EOF'
3. Each file needs "## Project-Specific [Role] Guidance" header
4. Verify all 3 files exist before considering task complete

CRITICAL: Must create ALL 3 files. Task is not complete until all 3 exist.
"""

    def _extract_investigation_summary(
        self, investigation_context: str
    ) -> Optional[str]:
        """Extract investigation summary from the completed task's context."""
        try:
            if investigation_context:
                # The context itself is the summary we need.
                # We can take the last part of it for conciseness.
                return investigation_context[-4000:]  # Get last 4000 chars as summary
            return None
        except Exception as e:
            logger.error(f"Failed to extract investigation summary: {e}")
            return None

    def _add_investigation_commands(self) -> None:
        """Add investigation commands using the existing permission system."""
        investigation_commands = {
            "ls": "List directory contents and structure",
            "cat": "Display file contents",
            "head": "Show first lines of files",
            "tail": "Show last lines of files",
            "find": "Find files and directories",
            "grep": "Search text in files",
            "file": "Determine file types",
            "wc": "Count lines, words, characters in files",
            "tree": "Display directory tree structure",
            "stat": "Show file/directory statistics",
            "less": "View file contents with paging",
            "more": "View file contents",
            "du": "Check disk usage",
            "pwd": "Show current directory",
        }

        # Use existing permission manager to add commands temporarily
        try:
            if hasattr(self.task_handler.config_manager, "get_command_maps"):
                (
                    current_allowed,
                    current_blacklisted,
                ) = self.task_handler.config_manager.get_command_maps()
            else:
                # Fallback for testing or incomplete setup
                current_allowed, current_blacklisted = {}, {}

            enhanced_allowed = {**current_allowed, **investigation_commands}

            # Update the task handler's components with enhanced commands
            if hasattr(self.task_handler, "payload_builder"):
                self.task_handler.payload_builder.set_command_maps(
                    enhanced_allowed, current_blacklisted
                )
            if hasattr(self.task_handler, "permission_manager"):
                self.task_handler.permission_manager.set_command_maps(
                    enhanced_allowed, current_blacklisted
                )

            logger.debug(
                f"Added investigation commands: {len(investigation_commands)} commands"
            )

        except Exception as e:
            logger.warning(f"Failed to add investigation commands: {e}")

    def _extract_generated_files(self) -> List[str]:
        """Extract and save files from captured LLM responses.

        Returns:
            List of successfully created file paths
        """
        all_created_files = []

        # Process all captured responses
        for response in self.captured_responses:
            try:
                # Extract file content and save to termaite directory
                created_files = extract_and_save_generated_files(
                    response,
                    str(self.initial_working_directory),
                    allowed_extensions=[".md"],  # Only allow markdown files for prompts
                )
                all_created_files.extend(created_files)

            except Exception as e:
                logger.warning(f"Failed to extract files from response: {e}")

        # Remove duplicates while preserving order
        unique_files = []
        seen = set()
        for file_path in all_created_files:
            if file_path not in seen:
                unique_files.append(file_path)
                seen.add(file_path)

        return unique_files


def create_project_initialization_task(
    task_handler: TaskHandler, initial_working_directory: str
) -> ProjectInitializationTask:
    """Create a project initialization task instance.

    Args:
        task_handler: Existing task handler with Plan-Act-Evaluate loop
        initial_working_directory: Directory to analyze and initialize

    Returns:
        ProjectInitializationTask instance
    """
    return ProjectInitializationTask(task_handler, initial_working_directory)
