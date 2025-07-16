"""
Main application controller for termaite.
"""

import sys
import os
from typing import Optional
from ..config.manager import ConfigManager
from ..core.session import SessionManager
from ..core.goal_manager import GoalManager
from ..core.plan_manager import PlanManager
from ..llm.client import LLMClient
from ..commands.executor import CommandExecutor
from ..llm.schemas import JSONProtocol, TaskStatus
from ..utils.context_compactor import ContextCompactor
from ..utils.defensive_reader import DefensiveReader


class TermaiteApplication:
    """Main application controller for termaite."""
    
    def __init__(self):
        self.config_manager = ConfigManager()
        self.session_manager = None
        self.goal_manager = None
        self.plan_manager = None
        self.llm_client = None
        self.command_executor = None
        self.context_compactor = None
        self.defensive_reader = None
        self.running = False
        self.last_command_output = ""  # Track last command output for plan revision
    
    def initialize(self) -> bool:
        """Initialize the application."""
        try:
            # Load and validate configuration
            self.config_manager.validate_config()
            
            # Initialize components
            self.session_manager = SessionManager(self.config_manager)
            self.goal_manager = GoalManager(self.session_manager)
            self.plan_manager = PlanManager(self.session_manager)
            self.llm_client = LLMClient(self.config_manager)
            self.command_executor = CommandExecutor(self.config_manager, self._get_user_approval)
            self.context_compactor = ContextCompactor(self.config_manager)
            self.defensive_reader = DefensiveReader(self.config_manager)
            
            # LLM connection will be tested lazily when needed
            # Don't block startup on LLM availability
            
            return True
            
        except Exception as e:
            print(f"Initialization failed: {e}")
            return False
    
    def run(self) -> None:
        """Run the main application loop."""
        print("Termaite - Terminal Agent")
        print("Type '/help' for help, '/exit' to quit")
        
        if not self.initialize():
            print("Failed to initialize. Please check your configuration.")
            return
        
        # Check LLM availability without blocking
        if hasattr(self, 'llm_client') and self.llm_client:
            if self.llm_client.is_available():
                print("✅ LLM connection available")
            else:
                print("⚠️  LLM connection unavailable - some features may be limited")
        
        self.running = True
        
        while self.running:
            try:
                user_input = input("\ntermaite> ").strip()
                
                if not user_input:
                    continue
                
                # Handle built-in commands
                if user_input.startswith('/'):
                    self._handle_builtin_command(user_input)
                else:
                    # Check if LLM is available before processing task
                    if hasattr(self, 'llm_client') and self.llm_client and self.llm_client.is_available():
                        # Process user task
                        self._process_user_task(user_input)
                    else:
                        print("⚠️  LLM connection unavailable. Please check your configuration and try again.")
                    
            except KeyboardInterrupt:
                print("\nUse '/exit' to quit")
            except EOFError:
                break
            except Exception as e:
                print(f"Error: {e}")
    
    def _handle_builtin_command(self, command: str) -> None:
        """Handle built-in commands."""
        parts = command.split()
        cmd = parts[0].lower()
        
        if cmd == '/exit':
            print("Goodbye!")
            self.running = False
        
        elif cmd == '/help':
            self._show_help()
        
        elif cmd == '/new':
            self._create_new_session()
        
        elif cmd == '/history':
            self._show_history()
        
        elif cmd == '/config':
            self._edit_config()
        
        elif cmd == '/model':
            self._show_models()
        
        elif cmd == '/status':
            self._show_status()
        
        elif cmd == '/whitelist':
            self._show_whitelist()
        
        else:
            print(f"Unknown command: {cmd}")
            self._show_help()
    
    def _show_help(self) -> None:
        """Show help information."""
        help_text = """
Built-in Commands:
  /new      - Create a new session
  /history  - Show session history
  /config   - Edit configuration
  /model    - Show available models
  /status   - Show current session status
  /whitelist- Show command whitelist status
  /help     - Show this help message
  /exit     - Exit termaite

Usage:
  Simply type your task or request, and termaite will create a goal,
  develop a plan, and execute the necessary commands to complete it.
"""
        print(help_text)
    
    def _create_new_session(self) -> None:
        """Create a new session."""
        title = input("Session title (optional): ").strip()
        session = self.session_manager.create_new_session(title or None)
        print(f"Created new session: {session.title}")
    
    def _show_history(self) -> None:
        """Show session history."""
        sessions = self.session_manager.list_sessions()
        
        if not sessions:
            print("No sessions found.")
            return
        
        print("\nSession History:")
        for i, session in enumerate(sessions, 1):
            status = "✓" if session['is_completed'] else "○"
            print(f"{i}. {status} {session['title']} ({session['message_count']} messages)")
            print(f"   Created: {session['created_at']}")
            print(f"   Updated: {session['last_updated']}")
        
        # Simple session selection
        try:
            choice = input("\nEnter session number to resume (or press Enter): ").strip()
            if choice:
                idx = int(choice) - 1
                if 0 <= idx < len(sessions):
                    session_id = sessions[idx]['session_id']
                    self.session_manager.load_session(session_id)
                    print(f"Resumed session: {sessions[idx]['title']}")
                else:
                    print("Invalid session number.")
        except ValueError:
            print("Invalid input.")
    
    def _edit_config(self) -> None:
        """Edit configuration."""
        try:
            self.config_manager.open_config_in_editor()
            print("Configuration updated. Please restart termaite for changes to take effect.")
        except Exception as e:
            print(f"Failed to open configuration: {e}")
    
    def _show_models(self) -> None:
        """Show available models."""
        try:
            models = self.llm_client.get_available_models()
            current_model = self.config_manager.load_config().llm.model
            
            print(f"\nCurrent model: {current_model}")
            print("\nAvailable models:")
            for model in models:
                marker = "* " if model == current_model else "  "
                print(f"{marker}{model}")
        except Exception as e:
            print(f"Failed to get models: {e}")
    
    def _show_status(self) -> None:
        """Show current session status."""
        session = self.session_manager.get_current_session()
        
        if not session:
            print("No active session.")
            return
        
        print(f"\nSession: {session.title}")
        print(f"Created: {session.created_at}")
        print(f"Messages: {len(session.messages)}")
        print(f"Completed: {session.is_completed}")
        
        if session.goal_statement:
            print(f"Goal: {session.goal_statement}")
        
        if session.current_plan:
            print(f"\nPlan: {len(session.current_plan)} steps")
            for step in session.current_plan:
                status = "✓" if step.get('completed', False) else "○"
                print(f"  {status} {step['description']}")
    
    def _show_whitelist(self) -> None:
        """Show whitelist status."""
        status = self.command_executor.get_whitelist_status()
        print(f"\n{status}")
    
    def _process_user_task(self, user_input: str) -> None:
        """Process a user task through the complete 6-step workflow."""
        try:
            # Ensure we have a session
            if not self.session_manager.get_current_session():
                self.session_manager.create_new_session()
            
            # Add user input to session
            self.session_manager.add_message("user", user_input, "user_input")
            
            # Execute the required 6-step sequence
            self._execute_six_step_sequence(user_input)
            
        except Exception as e:
            print(f"Error processing task: {e}")
    
    def _execute_six_step_sequence(self, user_input: str) -> None:
        """Execute the required 6-step sequence as specified in idea.md."""
        max_iterations = 50  # Prevent infinite loops
        iteration = 0
        
        while iteration < max_iterations:
            iteration += 1
            
            # Apply context compaction before LLM calls if needed
            session = self.session_manager.get_current_session()
            if session and self.context_compactor.should_compact(session.messages):
                print("Context compaction triggered - summarizing oldest messages...")
                try:
                    compacted_messages = self.context_compactor.compact_messages(session.messages, self.llm_client)
                    session.messages = compacted_messages
                    self.session_manager.save_current_session()
                    print("Context compaction completed successfully")
                except Exception as e:
                    print(f"Context compaction failed: {e}")
            
            # Step 1: If no goal statement exists, create one
            if not self.goal_manager.has_goal():
                self._step_1_create_goal(user_input)
            
            # Step 2: If no plan exists, create one
            if not self.plan_manager.has_plan():
                self._step_2_create_plan(user_input)
            
            # Step 3: Determine if goal statement is satisfied
            task_status = self._step_3_determine_task_status()
            if task_status == TaskStatus.COMPLETE.value:
                print("Task completed successfully!")
                self.session_manager.mark_completed()
                self.goal_manager.clear_goal()  # Clear goal after completion
                break
            
            # Step 4: Determine if plan needs revision
            self._step_4_determine_plan_revision()
            
            # Step 5: Determine the current task step
            current_step = self._step_5_determine_current_step()
            if not current_step:
                print("No more steps in plan.")
                break
            
            # Step 6: Provide the command to accomplish this step
            command_output = self._step_6_execute_command(current_step)
            
            # Store the command output for next iteration
            self.last_command_output = command_output
        
        if iteration >= max_iterations:
            print("Maximum iterations reached. Task may not be complete.")
    
    def _check_and_compact_context(self) -> None:
        """Check if context compaction is needed before LLM calls."""
        session = self.session_manager.get_current_session()
        if session and self.context_compactor.should_compact(session.messages):
            try:
                compacted_messages = self.context_compactor.compact_messages(session.messages, self.llm_client)
                session.messages = compacted_messages
                self.session_manager.save_current_session()
                print("Context compacted to stay within limits")
            except Exception as e:
                print(f"Context compaction failed: {e}")
    
    def _step_1_create_goal(self, user_input: str) -> None:
        """Step 1: Create goal statement with dedicated system prompt."""
        print("Step 1: Creating goal statement...")
        
        try:
            # Check context compaction before LLM call
            self._check_and_compact_context()
            
            # Use goal-specific system prompt
            llm_response = self.llm_client.create_goal_with_system_prompt(user_input)
            goal_statement = self.goal_manager.create_goal(llm_response)
            
            print(f"Goal created: {goal_statement}")
            
        except Exception as e:
            print(f"Failed to create goal: {e}")
            raise
    
    def _step_2_create_plan(self, context: str = "") -> None:
        """Step 2: Create plan with dedicated system prompt."""
        print("Step 2: Creating plan...")
        
        try:
            # Check context compaction before LLM call
            self._check_and_compact_context()
            
            goal_statement = self.goal_manager.get_goal()
            # Use plan-specific system prompt
            llm_response = self.llm_client.create_plan_with_system_prompt(goal_statement, context)
            plan = self.plan_manager.create_plan(llm_response)
            
            print(f"Plan created with {len(plan)} steps")
            
        except Exception as e:
            print(f"Failed to create plan: {e}")
            raise
    
    def _execute_plan(self) -> None:
        """Execute the current plan."""
        max_iterations = 50  # Prevent infinite loops
        iteration = 0
        
        while iteration < max_iterations:
            iteration += 1
            
            # Check if task is complete
            if self._check_task_completion():
                print("Task completed successfully!")
                self.session_manager.mark_completed()
                break
            
            # Get next step
            current_step = self.plan_manager.get_current_step()
            if not current_step:
                print("No more steps in plan.")
                break
            
            print(f"Executing step {current_step['step']}: {current_step['description']}")
            
            # Get command from LLM
            try:
                llm_response = self.llm_client.get_bash_command(current_step)
                parsed_response = JSONProtocol.parse_response(llm_response, "bash")
                command = parsed_response.operation.invoke_bash_command["command"]
                
                print(f"Command: {command}")
                
                # Execute command
                success, stdout, stderr = self.command_executor.execute_command(command)
                
                if success:
                    # Apply defensive reading to handle large outputs
                    processed_stdout, processed_stderr = self.defensive_reader.handle_large_output(command, stdout, stderr)
                    
                    if processed_stderr and "OUTPUT TOO LARGE" in processed_stderr:
                        print(f"Output too large: {processed_stderr}")
                        # Add error to session and continue
                        self.session_manager.add_message("system", processed_stderr, "defensive_reading_error")
                    else:
                        print(f"Output: {processed_stdout}")
                        if processed_stderr:
                            print(f"Stderr: {processed_stderr}")
                        
                        # Mark step as completed
                        self.plan_manager.mark_step_completed(current_step['step'])
                        
                        # Add to session history
                        self.session_manager.add_message("assistant", parsed_response.message, "command_execution")
                        self.session_manager.add_message("system", f"Command: {command}", "command_output")
                        self.session_manager.add_message("system", f"Output: {processed_stdout}", "command_output")
                        
                        # Update plan if needed based on output
                        self._update_plan_if_needed(processed_stdout + processed_stderr)
                    
                else:
                    print(f"Command failed: {stderr}")
                    
                    # Add error to session
                    self.session_manager.add_message("system", f"Command failed: {stderr}", "command_error")
                    
                    # Update plan to handle the error
                    self._update_plan_if_needed(f"Error: {stderr}")
                
            except Exception as e:
                print(f"Error executing step: {e}")
                break
        
        if iteration >= max_iterations:
            print("Maximum iterations reached. Task may not be complete.")
    
    def _step_3_determine_task_status(self) -> str:
        """Step 3: Determine if goal statement is satisfied with dedicated system prompt."""
        print("Step 3: Determining task status...")
        
        try:
            goal_statement = self.goal_manager.get_goal()
            if not goal_statement:
                return TaskStatus.IN_PROGRESS.value
            
            # Check context compaction before LLM call
            self._check_and_compact_context()
            
            # Get recent context
            recent_messages = self.session_manager.get_user_view_history()[-5:]
            context = "\n".join([msg.content for msg in recent_messages])
            
            # Use task-status-specific system prompt with adversarial evaluation
            llm_response = self.llm_client.determine_task_status_with_system_prompt(goal_statement, context)
            parsed_response = JSONProtocol.parse_response(llm_response, "task_status")
            
            status = parsed_response.operation.determine_task_status
            print(f"Task status: {status}")
            
            return status
            
        except Exception as e:
            print(f"Error checking task completion: {e}")
            return TaskStatus.IN_PROGRESS.value
    
    def _step_4_determine_plan_revision(self) -> None:
        """Step 4: Determine if plan needs revision with dedicated system prompt."""
        print("Step 4: Checking if plan needs revision...")
        
        try:
            # Check context compaction before LLM call
            self._check_and_compact_context()
            
            goal_statement = self.goal_manager.get_goal()
            current_plan = self.plan_manager.get_plan()
            
            # Get last command output for context
            last_output = getattr(self, 'last_command_output', '')
            
            # Use plan-management-specific system prompt
            llm_response = self.llm_client.manage_plan_with_system_prompt(goal_statement, current_plan, last_output)
            self.plan_manager.update_plan(llm_response)
            
        except Exception as e:
            print(f"Error updating plan: {e}")
            # Continue execution even if plan update fails
    
    def _step_5_determine_current_step(self):
        """Step 5: Determine the current task step."""
        print("Step 5: Determining current step...")
        
        try:
            current_step = self.plan_manager.get_current_step()
            if current_step:
                print(f"Current step: {current_step['step']} - {current_step['description']}")
            return current_step
        except Exception as e:
            print(f"Error determining current step: {e}")
            return None
    
    def _step_6_execute_command(self, current_step) -> str:
        """Step 6: Execute command to accomplish current step with dedicated system prompt."""
        print(f"Step 6: Executing command for step {current_step['step']}...")
        
        try:
            # Check context compaction before LLM call
            self._check_and_compact_context()
            
            # Use bash-command-specific system prompt
            llm_response = self.llm_client.get_bash_command_with_system_prompt(current_step)
            parsed_response = JSONProtocol.parse_response(llm_response, "bash")
            command = parsed_response.operation.invoke_bash_command["command"]
            
            print(f"Command: {command}")
            
            # Execute command
            success, stdout, stderr = self.command_executor.execute_command(command)
            
            if success:
                # Apply defensive reading to handle large outputs
                processed_stdout, processed_stderr = self.defensive_reader.handle_large_output(command, stdout, stderr)
                
                if processed_stderr and "OUTPUT TOO LARGE" in processed_stderr:
                    print(f"Output too large: {processed_stderr}")
                    # Add error to session and continue
                    self.session_manager.add_message("system", processed_stderr, "defensive_reading_error")
                    return processed_stderr
                else:
                    print(f"Output: {processed_stdout}")
                    if processed_stderr:
                        print(f"Stderr: {processed_stderr}")
                    
                    # Mark step as completed
                    self.plan_manager.mark_step_completed(current_step['step'])
                    
                    # Add to session history
                    self.session_manager.add_message("assistant", parsed_response.message, "command_execution")
                    self.session_manager.add_message("system", f"Command: {command}", "command_output")
                    self.session_manager.add_message("system", f"Output: {processed_stdout}", "command_output")
                    
                    return processed_stdout + processed_stderr
                
            else:
                print(f"Command failed: {stderr}")
                
                # Add error to session
                self.session_manager.add_message("system", f"Command failed: {stderr}", "command_error")
                
                return f"Error: {stderr}"
                
        except Exception as e:
            print(f"Error executing step: {e}")
            return f"Error: {e}"
    
    def _get_user_approval(self, command: str, message: str) -> str:
        """Get user approval for command execution."""
        # This is a placeholder - in CLI mode, just ask via input
        # In TUI mode, this would be overridden to use the modal
        try:
            print(f"\n{message}")
            print(f"Command: {command}")
            response = input("Approve? (y/n/a for always): ").strip().lower()
            return response
        except Exception:
            return "no"