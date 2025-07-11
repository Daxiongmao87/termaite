"""Project initialization task handler using existing agentic architecture."""

import re
from typing import Dict, Optional, List, Tuple
from pathlib import Path

from ..utils.logging import logger
from .task_handler import TaskHandler
from ..llm.parsers import extract_and_save_generated_files, validate_generated_prompt_files


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
        """Execute project initialization using agentic architecture.
        
        Returns:
            True if initialization completed successfully, False otherwise
        """
        try:
            # Create .termaite directory
            self.termaite_dir.mkdir(exist_ok=True)
            logger.system(f"Created/verified .termaite directory: {self.termaite_dir}")

            # Add necessary investigation commands temporarily
            self._add_investigation_commands()

            # Create comprehensive project initialization task
            initialization_task = self._create_initialization_task()

            logger.system("🚀 Starting comprehensive project initialization...")
            
            # Use existing agentic architecture with response capture
            success = self._execute_with_response_capture(initialization_task)
            
            if success:
                # Extract and save generated files from captured responses
                created_files = self._extract_generated_files()
                
                if created_files:
                    # Validate the generated files
                    valid, issues = validate_generated_prompt_files(created_files)
                    
                    if valid:
                        logger.system("✅ Project initialization completed successfully!")
                        logger.system(f"Created {len(created_files)} project-specific prompt files:")
                        for file_path in created_files:
                            logger.system(f"  - {file_path}")
                        logger.system("These will be automatically used for future operations in this directory.")
                    else:
                        logger.warning("⚠️  Project initialization completed with issues:")
                        for issue in issues:
                            logger.warning(f"  - {issue}")
                        logger.system("Files were created but may need manual review.")
                else:
                    logger.warning("⚠️  No files were extracted from LLM responses.")
                    logger.system("The initialization task ran but didn't produce expected output files.")
                    success = False
            else:
                logger.error("❌ Project initialization failed")
                
            return success

        except Exception as e:
            logger.error(f"Error during project initialization: {e}")
            return False

    def _create_initialization_task(self) -> str:
        """Create a comprehensive task that leverages Plan-Act-Evaluate for initialization."""
        current_config = self.task_handler.config
        
        planner_prompt = current_config.get("plan_prompt", "")[:200] + "..."
        actor_prompt = current_config.get("action_prompt", "")[:200] + "..."
        evaluator_prompt = current_config.get("evaluate_prompt", "")[:200] + "..."

        return f"""I need you to thoroughly analyze this project and create customized AI agent prompts for it.

TASK OVERVIEW:
Analyze the current project directory ({self.initial_working_directory}) and generate three enhanced agent prompt files in the .termaite/ directory:

1. .termaite/PLANNER.md - Enhanced planning agent prompt
2. .termaite/ACTOR.md - Enhanced action execution agent prompt  
3. .termaite/EVALUATOR.md - Enhanced evaluation agent prompt

STEP-BY-STEP PROCESS:

PHASE 1 - PROJECT ANALYSIS:
- Examine the directory structure and organization
- Identify file types, languages, and technologies used
- Read key configuration files (package.json, requirements.txt, etc.)
- Analyze README files and documentation
- Determine project type (software, documents, research, etc.) and domain
- Identify common patterns, conventions, and best practices
- Note any build tools, testing frameworks, or development workflows

PHASE 2 - GENERATE ENHANCED PROMPTS:
For each agent, create an enhanced version of the base prompt that includes:

PLANNER.md should contain:
```markdown
{planner_prompt}

## Project-Specific Planning Guidance

[Based on your analysis, add specific guidance for this project type including:]
- Domain-specific terminology and concepts this planner should understand
- Common planning patterns for this type of project
- Typical task breakdown strategies for this domain
- Project-specific tools and methodologies to consider
- Best practices for planning in this field
```

ACTOR.md should contain:
```markdown
{actor_prompt}

## Project-Specific Action Guidance

[Based on your analysis, add specific guidance including:]
- Commands and tools commonly used in this project type
- File patterns and locations specific to this domain
- Testing and validation commands for this project type
- Build and deployment patterns if applicable
- Domain-specific workflows and conventions
```

EVALUATOR.md should contain:
```markdown
{evaluator_prompt}

## Project-Specific Evaluation Guidance

[Based on your analysis, add specific guidance including:]
- Success criteria specific to this project type
- Common failure patterns to watch for in this domain
- Quality standards and best practices for this field
- Testing and validation approaches for this project type
- Domain-specific evaluation metrics
```

PHASE 3 - FILE CREATION:
Create the three files with the enhanced prompts. Each file should:
- Start with the original base prompt
- Add a "## Project-Specific [Agent] Guidance" section
- Include concrete, actionable enhancements based on the project analysis
- Be immediately usable to improve agent performance for this project

EXECUTION NOTES:
- Be thorough in your project analysis - examine multiple files and directories
- Make the enhanced prompts specific and actionable, not generic
- Ensure each agent gets domain-relevant improvements
- Create real content, not placeholders or TODO items
- The enhanced prompts should make agents significantly more effective for this project type

Begin by analyzing the project directory structure and key files to understand what type of project this is."""

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
            if hasattr(self.task_handler.config_manager, 'get_command_maps'):
                current_allowed, current_blacklisted = self.task_handler.config_manager.get_command_maps()
            else:
                # Fallback for testing or incomplete setup
                current_allowed, current_blacklisted = {}, {}
                
            enhanced_allowed = {**current_allowed, **investigation_commands}
            
            # Update the task handler's components with enhanced commands
            if hasattr(self.task_handler, 'payload_builder'):
                self.task_handler.payload_builder.set_command_maps(enhanced_allowed, current_blacklisted)
            if hasattr(self.task_handler, 'permission_manager'):
                self.task_handler.permission_manager.set_command_maps(enhanced_allowed, current_blacklisted)
            
            logger.debug(f"Added investigation commands: {len(investigation_commands)} commands")
            
        except Exception as e:
            logger.warning(f"Failed to add investigation commands: {e}")

    def _execute_with_response_capture(self, task: str) -> bool:
        """Execute task using existing architecture while capturing LLM responses.
        
        Args:
            task: Task description to execute
            
        Returns:
            True if task completed successfully, False otherwise
        """
        # Store original LLM client method
        original_send_request = self.task_handler.llm_client.send_request
        
        def capturing_send_request(*args, **kwargs):
            """Wrapper to capture LLM responses."""
            response = original_send_request(*args, **kwargs)
            if response:
                self.captured_responses.append(response)
            return response
        
        try:
            # Temporarily replace the LLM client method
            self.task_handler.llm_client.send_request = capturing_send_request
            
            # Execute the task using the existing Plan-Act-Evaluate architecture
            return self.task_handler.handle_task(task)
            
        finally:
            # Restore original method
            self.task_handler.llm_client.send_request = original_send_request

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
                    allowed_extensions=['.md']  # Only allow markdown files for prompts
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
    task_handler: TaskHandler, 
    initial_working_directory: str
) -> ProjectInitializationTask:
    """Create a project initialization task instance.
    
    Args:
        task_handler: Existing task handler with Plan-Act-Evaluate loop
        initial_working_directory: Directory to analyze and initialize
        
    Returns:
        ProjectInitializationTask instance
    """
    return ProjectInitializationTask(task_handler, initial_working_directory)