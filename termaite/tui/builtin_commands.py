"""
Built-in command handlers for termaite TUI.
"""

import os
from typing import Callable, Any
from ..core.application import TermaiteApplication


class BuiltinCommandHandler:
    """Handler for built-in commands in TUI interface."""
    
    def __init__(self, app: TermaiteApplication):
        self.app = app
    
    def show_help(self, output_func: Callable[[str, str], None]):
        """Show help information."""
        help_text = """
Built-in Commands:
  /new      - Create a new session
  /history  - Browse session history (modal)
  /config   - Edit configuration file
  /model    - Show/select available models (modal)
  /status   - Show current session status
  /whitelist- Show command whitelist status
  /init     - Initialize project and create .TERMAITE.md context file
  /help     - Show this help message
  /exit     - Exit termaite

Usage:
  Simply type your task or request, and termaite will create a goal,
  develop a plan, and execute the necessary commands to complete it.

Navigation:
  - Use arrow keys to navigate modals
  - Press Enter to select items
  - Press ESC or Q to cancel/close modals
  - Press Del to delete items in history modal

Example Tasks:
  "List all Python files in the current directory"
  "Create a README file with project description"
  "Find all TODO comments in the codebase"
  "Check the git status and show recent commits"
"""
        
        for line in help_text.strip().split('\n'):
            output_func(line, "info")
    
    def create_new_session(self, output_func: Callable[[str, str], None]):
        """Create a new session."""
        try:
            # Get user input for session title (would need modal in full implementation)
            # For now, create session with default title
            session = self.app.session_manager.create_new_session()
            output_func(f"Created new session: {session.title}", "success")
            
            # Clear goal and plan for new session
            self.app.goal_manager.clear_goal()
            self.app.plan_manager.clear_plan()
            
        except Exception as e:
            output_func(f"Failed to create new session: {e}", "error")
    
    def edit_config(self, output_func: Callable[[str, str], None]):
        """Edit configuration file."""
        try:
            output_func("Opening configuration file in editor...", "info")
            self.app.config_manager.open_config_in_editor()
            output_func("Configuration file opened. Please restart termaite for changes to take effect.", "warning")
        except Exception as e:
            output_func(f"Failed to open configuration: {e}", "error")
    
    def show_status(self, output_func: Callable[[str, str], None]):
        """Show current session status."""
        try:
            session = self.app.session_manager.get_current_session()
            
            if not session:
                output_func("No active session.", "warning")
                return
            
            output_func("=== Session Status ===", "info")
            output_func(f"Session: {session.title}", "info")
            output_func(f"Created: {session.created_at}", "info")
            output_func(f"Messages: {len(session.messages)}", "info")
            output_func(f"Completed: {'Yes' if session.is_completed else 'No'}", "info")
            
            # Show goal
            if session.goal_statement:
                output_func(f"Goal: {session.goal_statement}", "success")
            else:
                output_func("Goal: Not set", "warning")
            
            # Show plan
            if session.current_plan:
                output_func(f"Plan: {len(session.current_plan)} steps", "info")
                for i, step in enumerate(session.current_plan, 1):
                    status = "✓" if step.get('completed', False) else "○"
                    output_func(f"  {i}. {status} {step['description']}", "info")
            else:
                output_func("Plan: Not created", "warning")
            
            # Show recent messages
            recent_messages = session.messages[-3:] if session.messages else []
            if recent_messages:
                output_func("Recent Messages:", "info")
                for msg in recent_messages:
                    msg_type = msg.message_type or "unknown"
                    content = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
                    output_func(f"  {msg_type}: {content}", "info")
            
        except Exception as e:
            output_func(f"Error showing status: {e}", "error")
    
    def show_whitelist(self, output_func: Callable[[str, str], None]):
        """Show whitelist status."""
        try:
            # Get whitelist status from command executor
            if hasattr(self.app, 'command_executor') and self.app.command_executor:
                status = self.app.command_executor.get_whitelist_status()
                output_func("=== Whitelist Status ===", "info")
                for line in status.split('\n'):
                    if line.strip():
                        output_func(line, "info")
            else:
                output_func("Command executor not available", "warning")
                
        except Exception as e:
            output_func(f"Error showing whitelist: {e}", "error")
    
    def show_models(self, output_func: Callable[[str, str], None]):
        """Show available models (fallback for when modal fails)."""
        try:
            if not hasattr(self.app, 'llm_client') or not self.app.llm_client:
                output_func("LLM client not available", "error")
                return
            
            models = self.app.llm_client.get_available_models()
            current_model = self.app.config_manager.load_config().llm.model
            
            output_func("=== Available Models ===", "info")
            output_func(f"Current model: {current_model}", "success")
            output_func("Available models:", "info")
            
            for model in models:
                marker = "* " if model == current_model else "  "
                output_func(f"{marker}{model}", "info")
                
        except Exception as e:
            output_func(f"Failed to get models: {e}", "error")
    
    def show_history(self, output_func: Callable[[str, str], None]):
        """Show session history (fallback for when modal fails)."""
        try:
            sessions = self.app.session_manager.list_sessions()
            
            if not sessions:
                output_func("No sessions found.", "warning")
                return
            
            output_func("=== Session History ===", "info")
            for i, session in enumerate(sessions, 1):
                status = "✓" if session['is_completed'] else "○"
                output_func(f"{i}. {status} {session['title']} ({session['message_count']} messages)", "info")
                output_func(f"   Created: {session['created_at']}", "info")
                output_func(f"   Updated: {session['last_updated']}", "info")
                output_func("", "info")  # Empty line
            
        except Exception as e:
            output_func(f"Error showing history: {e}", "error")
    
    def show_system_info(self, output_func: Callable[[str, str], None]):
        """Show system information."""
        try:
            config = self.app.config_manager.load_config()
            
            output_func("=== System Information ===", "info")
            output_func(f"LLM Endpoint: {config.llm.endpoint}", "info")
            output_func(f"Model: {config.llm.model}", "info")
            output_func(f"Context Window: {config.llm.context_window}", "info")
            output_func(f"Gremlin Mode: {'Enabled' if config.security.gremlin_mode else 'Disabled'}", "info")
            output_func(f"Project Root: {config.security.project_root}", "info")
            output_func(f"Whitelist Enabled: {'Yes' if config.whitelist.enabled else 'No'}", "info")
            
            # Test connection
            if hasattr(self.app, 'llm_client') and self.app.llm_client:
                connection_status = "Connected" if self.app.llm_client.test_connection() else "Disconnected"
                output_func(f"LLM Connection: {connection_status}", "success" if connection_status == "Connected" else "error")
            
        except Exception as e:
            output_func(f"Error showing system info: {e}", "error")
    
    def show_shortcuts(self, output_func: Callable[[str, str], None]):
        """Show keyboard shortcuts."""
        shortcuts_text = """
Keyboard Shortcuts:
  
  Main Interface:
    ↑/↓         - Navigate command history (future feature)
    Ctrl+C      - Show '/exit' message
    Ctrl+L      - Clear screen (future feature)
    
  Modals:
    ↑/↓         - Navigate items
    Enter       - Select item
    ESC/Q       - Cancel/close modal
    Del         - Delete item (history modal)
    
  Built-in Commands:
    /help       - Show help
    /new        - New session
    /history    - Browse sessions
    /model      - Select model
    /config     - Edit config
    /status     - Show status
    /exit       - Quit
    
  Tips:
    - Start commands with '/' for built-in commands
    - Type regular text for AI task processing
    - Use descriptive task descriptions for better results
    - Check /status to see current goal and plan
"""
        
        for line in shortcuts_text.strip().split('\n'):
            output_func(line, "info")
    
    def show_examples(self, output_func: Callable[[str, str], None]):
        """Show example commands and tasks."""
        examples_text = """
Example Commands:

  Built-in Commands:
    /new                    - Start fresh session
    /history               - Browse previous sessions
    /status                - Check current session state
    /model                 - View/change AI model
    /config               - Edit configuration
    
  Task Examples:
    "List all Python files in this directory"
    "Create a simple README.md file"
    "Find all TODO comments in the code"
    "Check git status and show recent commits"
    "Count lines of code in all .py files"
    "Find files modified in the last 24 hours"
    "Show disk usage of current directory"
    "Create a backup of important files"
    "Search for a specific function in the codebase"
    "Run tests and show results"
    
  Advanced Tasks:
    "Analyze the project structure and create documentation"
    "Find potential security issues in the code"
    "Optimize the database queries in the application"
    "Set up a development environment"
    "Create a deployment script"
    
  Tips:
    - Be specific about what you want to accomplish
    - Mention file types, directories, or constraints
    - Ask for explanations if you want to understand the commands
    - Use descriptive language for better AI understanding
"""
        
        for line in examples_text.strip().split('\n'):
            output_func(line, "info")
    
    def debug_session(self, output_func: Callable[[str, str], None]):
        """Debug current session state."""
        try:
            output_func("=== Debug Information ===", "info")
            
            # Session info
            session = self.app.session_manager.get_current_session()
            if session:
                output_func(f"Session ID: {session.session_id}", "info")
                output_func(f"Session Title: {session.title}", "info")
                output_func(f"Session Created: {session.created_at}", "info")
                output_func(f"Messages Count: {len(session.messages)}", "info")
                output_func(f"Is Completed: {session.is_completed}", "info")
            else:
                output_func("No active session", "warning")
            
            # Goal info
            goal = self.app.goal_manager.get_goal() if hasattr(self.app, 'goal_manager') else None
            output_func(f"Goal: {goal or 'None'}", "info")
            
            # Plan info
            plan = self.app.plan_manager.get_plan() if hasattr(self.app, 'plan_manager') else None
            if plan:
                output_func(f"Plan Steps: {len(plan)}", "info")
                for i, step in enumerate(plan):
                    status = "✓" if step.get('completed', False) else "○"
                    output_func(f"  {i+1}. {status} {step.get('description', 'No description')}", "info")
            else:
                output_func("Plan: None", "info")
            
            # Application state
            output_func(f"App Initialized: {getattr(self.app, 'initialized', 'Unknown')}", "info")
            output_func(f"App Running: {getattr(self.app, 'running', 'Unknown')}", "info")
            
        except Exception as e:
            output_func(f"Error in debug: {e}", "error")
    
    def run_project_init(self, output_func: Callable[[str, str], None]):
        """Run project initialization."""
        try:
            from ..core.project_init import ProjectInitializer
            from ..config.manager import ConfigManager
            
            output_func("🔍 Starting project initialization...", "info")
            
            config_manager = ConfigManager()
            initializer = ProjectInitializer(config_manager)
            success = initializer.initialize_project()
            
            if success:
                output_func("🎉 Project initialization completed!", "success")
                output_func("💡 The .TERMAITE.md file provides context for AI assistance.", "info")
                output_func("📄 Context file will be automatically loaded for better assistance.", "info")
            else:
                output_func("❌ Project initialization failed.", "error")
                
        except Exception as e:
            output_func(f"Error during project initialization: {e}", "error")