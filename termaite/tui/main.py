"""
Main TUI interface for termaite.
"""

import curses
import threading
from typing import Optional, List, Dict, Any
from ..core.application import TermaiteApplication
from .modals import HistoryModal, ModelModal
from .builtin_commands import BuiltinCommandHandler
from .chatbox import ChatboxTUI, MessageType


class TermaiteTUI:
    """Main TUI interface for termaite using chatbox design."""
    
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.app = TermaiteApplication()
        self.command_handler = BuiltinCommandHandler(self.app)
        self.history_modal = HistoryModal(stdscr, self.app)
        self.model_modal = ModelModal(stdscr, self.app)
        self.approval_modal = None  # Will be initialized after app is ready
        
        # Initialize chatbox interface
        self.chatbox = ChatboxTUI(stdscr, self.app)
        
        # State
        self.running = True
        self.current_modal = None
        
        # Initialize application
        self.initialized = False
        self.init_message = ""
        
    def initialize(self):
        """Initialize the application."""
        try:
            if self.app.initialize():
                self.initialized = True
                
                # Initialize approval modal and override app approval method
                from .modals import UserApprovalModal
                self.approval_modal = UserApprovalModal(self.stdscr, self.app)
                self.app._get_user_approval = self._get_user_approval_tui
                
                self.chatbox.add_message("Termaite initialized successfully", MessageType.SYSTEM)
                
                # Check LLM availability
                if hasattr(self.app, 'llm_client') and self.app.llm_client:
                    if self.app.llm_client.is_available():
                        self.chatbox.add_message("✅ LLM connection available", MessageType.SYSTEM)
                    else:
                        self.chatbox.add_message("⚠️  LLM connection unavailable - some features may be limited", MessageType.SYSTEM)
                
                self.show_welcome()
            else:
                self.initialized = False
                self.init_message = "Failed to initialize. Check your configuration."
                self.chatbox.add_message(self.init_message, MessageType.SYSTEM)
        except Exception as e:
            self.initialized = False
            self.init_message = f"Initialization error: {e}"
            self.chatbox.add_message(self.init_message, MessageType.SYSTEM)
    
    def show_welcome(self):
        """Show welcome message."""
        welcome_msg = """Termaite - Terminal Agent
Type '/help' for help, '/exit' to quit"""
        self.chatbox.add_message(welcome_msg, MessageType.SYSTEM)
        
        # Show current session status
        session = self.app.session_manager.get_current_session()
        if session:
            self.chatbox.add_message(f"Current session: {session.title}", MessageType.SYSTEM)
            if session.goal_statement:
                self.chatbox.add_message(f"Goal: {session.goal_statement}", MessageType.SYSTEM)
    
    def add_output(self, text: str, msg_type: str = "normal"):
        """Add output to the display buffer."""
        # Split long lines properly
        max_width = self.width - 2
        lines = []
        
        for line in text.split('\n'):
            if len(line) <= max_width:
                lines.append((line, msg_type))
            else:
                # Word wrap properly
                words = line.split(' ')
                current_line = ""
                for word in words:
                    if len(current_line + word + " ") <= max_width:
                        current_line += word + " "
                    else:
                        if current_line:
                            lines.append((current_line.rstrip(), msg_type))
                        current_line = word + " "
                if current_line:
                    lines.append((current_line.rstrip(), msg_type))
        
        self.output_lines.extend(lines)
        
        # Keep reasonable history but don't truncate too aggressively
        max_history = 1000
        if len(self.output_lines) > max_history:
            self.output_lines = self.output_lines[-max_history:]
        
        # Force screen redraw
        self.draw_screen()
    
    def get_color_pair(self, msg_type: str) -> int:
        """Get color pair for message type."""
        if not self.colors_enabled:
            return 0
        color_map = {
            "success": 1,
            "error": 2,
            "warning": 3,
            "info": 4,
            "command": 5,
            "normal": 0
        }
        return color_map.get(msg_type, 0)
    
    def draw_screen(self):
        """Draw the main screen with proper regions."""
        # Define screen regions
        output_height = self.height - 3  # Leave space for separator, input, status
        input_row = self.height - 2
        status_row = self.height - 1
        separator_row = self.height - 3
        
        # Calculate scroll position
        total_lines = len(self.output_lines)
        if total_lines > output_height:
            # Show most recent lines
            start_line = total_lines - output_height
            visible_lines = self.output_lines[start_line:]
        else:
            visible_lines = self.output_lines
        
        # Clear only the output area
        for row in range(output_height):
            try:
                self.stdscr.move(row, 0)
                self.stdscr.clrtoeol()
            except curses.error:
                pass
        
        # Draw output lines
        for i, (line, msg_type) in enumerate(visible_lines):
            if i < output_height:
                try:
                    # Truncate line to fit screen width
                    display_line = line[:self.width-1]
                    self.stdscr.addstr(i, 0, display_line)
                except curses.error:
                    pass
        
        # Draw separator line
        try:
            self.stdscr.move(separator_row, 0)
            self.stdscr.clrtoeol()
            separator = "─" * (self.width - 1)
            self.stdscr.addstr(separator_row, 0, separator)
        except curses.error:
            pass
        
        # Draw input area
        try:
            self.stdscr.move(input_row, 0)
            self.stdscr.clrtoeol()
            prompt = "termaite> "
            input_line = prompt + self.input_buffer
            display_input = input_line[:self.width-1]
            self.stdscr.addstr(input_row, 0, display_input)
        except curses.error:
            pass
        
        # Draw status line
        try:
            self.stdscr.move(status_row, 0)
            self.stdscr.clrtoeol()
            
            if not self.initialized:
                status = f"NOT INITIALIZED: {self.init_message}"
            else:
                session = self.app.session_manager.get_current_session() if hasattr(self.app, 'session_manager') else None
                if session:
                    status = f"Session: {session.title}"
                    if hasattr(session, 'goal_statement') and session.goal_statement:
                        status += f" | Goal: {session.goal_statement[:30]}..."
                else:
                    status = "Ready"
            
            self.stdscr.addstr(status_row, 0, status[:self.width-1])
        except curses.error:
            pass
        
        # Position cursor correctly
        try:
            prompt = "termaite> "
            cursor_x = len(prompt) + self.cursor_pos
            if cursor_x < self.width - 1:
                self.stdscr.move(input_row, cursor_x)
            else:
                self.stdscr.move(input_row, self.width - 1)
        except curses.error:
            pass
        
        # Refresh screen
        self.stdscr.refresh()
    
    def handle_input(self, key: int):
        """Handle user input."""
        if self.current_modal:
            # Let modal handle input
            if self.current_modal.handle_input(key):
                self.current_modal = None
            return
        
        if key == curses.KEY_ENTER or key == 10 or key == 13:
            # Enter key - process command
            if self.input_buffer.strip():
                self.process_command(self.input_buffer.strip())
            self.input_buffer = ""
            self.cursor_pos = 0
            
        elif key == curses.KEY_BACKSPACE or key == 127 or key == 8:
            # Backspace
            if self.cursor_pos > 0:
                self.input_buffer = self.input_buffer[:self.cursor_pos-1] + self.input_buffer[self.cursor_pos:]
                self.cursor_pos -= 1
                
        elif key == curses.KEY_LEFT:
            # Left arrow
            if self.cursor_pos > 0:
                self.cursor_pos -= 1
                
        elif key == curses.KEY_RIGHT:
            # Right arrow
            if self.cursor_pos < len(self.input_buffer):
                self.cursor_pos += 1
                
        elif key == curses.KEY_HOME:
            # Home key
            self.cursor_pos = 0
            
        elif key == curses.KEY_END:
            # End key
            self.cursor_pos = len(self.input_buffer)
            
        elif 32 <= key <= 126:  # Printable characters
            # Insert character
            char = chr(key)
            self.input_buffer = self.input_buffer[:self.cursor_pos] + char + self.input_buffer[self.cursor_pos:]
            self.cursor_pos += 1
    
    def process_command(self, command: str):
        """Process a user command."""
        # Show command in output history
        self.add_output(f"termaite> {command}", "command")
        
        if not self.initialized and not command.startswith('/'):
            self.add_output("Application not initialized. Check configuration.", "error")
            return
        
        # Handle built-in commands
        if command.startswith('/'):
            self.handle_builtin_command(command)
        else:
            # Check if LLM is available before processing task
            if hasattr(self.app, 'llm_client') and self.app.llm_client and self.app.llm_client.is_available():
                # Process user task
                self.handle_user_task(command)
            else:
                self.add_output("⚠️  LLM connection unavailable. Please check your configuration and try again.", "warning")
    
    def handle_builtin_command(self, command: str):
        """Handle built-in commands."""
        parts = command.split()
        cmd = parts[0].lower()
        
        if cmd == '/exit':
            self.running = False
            self.add_output("Goodbye!", "info")
            
        elif cmd == '/help':
            self.command_handler.show_help(self.add_output)
            
        elif cmd == '/new':
            self.command_handler.create_new_session(self.add_output)
            
        elif cmd == '/history':
            self.current_modal = self.history_modal
            self.history_modal.show()
            
        elif cmd == '/model':
            self.current_modal = self.model_modal
            self.model_modal.show()
            
        elif cmd == '/config':
            self.command_handler.edit_config(self.add_output)
            
        elif cmd == '/status':
            self.command_handler.show_status(self.add_output)
            
        elif cmd == '/whitelist':
            self.command_handler.show_whitelist(self.add_output)
            
        elif cmd == '/init':
            self.command_handler.run_project_init(self.add_output)
            
        else:
            self.add_output(f"Unknown command: {cmd}", "error")
            self.command_handler.show_help(self.add_output)
    
    def handle_user_task(self, task: str):
        """Handle user task in background thread."""
        def task_runner():
            try:
                self.add_output("Processing task...", "info")
                
                # Ensure we have a session
                if not self.app.session_manager.get_current_session():
                    self.app.session_manager.create_new_session()
                
                # Add user input to session
                self.app.session_manager.add_message("user", task, "user_input")
                
                # Step 1: Create goal if needed
                if not self.app.goal_manager.has_goal():
                    self.add_output("Creating goal statement...", "info")
                    self.app._create_goal(task)
                    goal = self.app.goal_manager.get_goal()
                    self.add_output(f"Goal: {goal}", "success")
                
                # Step 2: Create plan if needed
                if not self.app.plan_manager.has_plan():
                    self.add_output("Creating plan...", "info")
                    self.app._create_plan(task)
                    plan = self.app.plan_manager.get_plan()
                    self.add_output(f"Plan created with {len(plan)} steps", "success")
                
                # Step 3: Execute plan
                self.add_output("Executing plan...", "info")
                self.app._execute_plan()
                
            except Exception as e:
                self.add_output(f"Error processing task: {e}", "error")
        
        # Run in background thread
        thread = threading.Thread(target=task_runner)
        thread.daemon = True
        thread.start()
    
    def _get_user_approval_tui(self, command: str, message: str) -> str:
        """Get user approval using TUI modal."""
        if self.approval_modal:
            return self.approval_modal.show_approval(command, message)
        else:
            # Fallback to text-based approval
            self.add_output(f"Command requires approval: {command}", "warning")
            self.add_output(f"Message: {message}", "info")
            return "no"
    
    def run(self):
        """Main TUI loop using chatbox interface."""
        # Initialize
        self.initialize()
        
        # Connect chatbox to our handlers
        self.chatbox.handle_builtin_command = self.handle_builtin_command
        self.chatbox.handle_task_input = self.handle_task_input
        
        # Run the chatbox
        self.chatbox.run()
    
    def handle_builtin_command(self, command: str):
        """Handle built-in commands through chatbox."""
        parts = command.split()
        cmd = parts[0].lower()
        
        if cmd == '/exit':
            self.running = False
            self.chatbox.running = False
            self.chatbox.add_message("Goodbye!", MessageType.SYSTEM)
            
        elif cmd == '/help':
            self.command_handler.show_help(lambda msg, _: self.chatbox.add_message(msg, MessageType.SYSTEM))
            
        elif cmd == '/new':
            self.command_handler.create_new_session(lambda msg, _: self.chatbox.add_message(msg, MessageType.SYSTEM))
            
        elif cmd == '/history':
            self.current_modal = self.history_modal
            self.history_modal.show()
            
        elif cmd == '/model':
            self.current_modal = self.model_modal
            self.model_modal.show()
            
        elif cmd == '/config':
            self.command_handler.edit_config(lambda msg, _: self.chatbox.add_message(msg, MessageType.SYSTEM))
            
        elif cmd == '/status':
            self.command_handler.show_status(lambda msg, _: self.chatbox.add_message(msg, MessageType.SYSTEM))
            
        elif cmd == '/whitelist':
            self.command_handler.show_whitelist(lambda msg, _: self.chatbox.add_message(msg, MessageType.SYSTEM))
            
        elif cmd == '/init':
            self.command_handler.run_project_init(lambda msg, _: self.chatbox.add_message(msg, MessageType.SYSTEM))
            
        else:
            self.chatbox.add_message(f"Unknown command: {cmd}. Type '/help' for available commands.", MessageType.SYSTEM)
    
    def handle_task_input(self, user_input: str):
        """Handle task input from user."""
        if not self.initialized:
            self.chatbox.add_message("Application not initialized. Check configuration.", MessageType.SYSTEM)
            return
        
        # Check if LLM is available
        if not (hasattr(self.app, 'llm_client') and self.app.llm_client and self.app.llm_client.is_available()):
            self.chatbox.add_message("⚠️  LLM connection unavailable. Please check your configuration and try again.", MessageType.SYSTEM)
            return
        
        # Show working indicator
        self.chatbox.show_working_indicator("Processing task...")
        
        # Process in background thread
        def task_processor():
            try:
                # Ensure we have a session
                if not self.app.session_manager.get_current_session():
                    self.app.session_manager.create_new_session()
                
                # Add user input to session
                self.app.session_manager.add_message("user", user_input, "user_input")
                
                # Override app print functions to use chatbox
                original_print = print
                def chatbox_print(*args, **kwargs):
                    message = " ".join(str(arg) for arg in args)
                    if message.startswith("Step"):
                        self.chatbox.add_message(message, MessageType.AGENT)
                    else:
                        self.chatbox.add_message(message, MessageType.SYSTEM)
                
                import builtins
                builtins.print = chatbox_print
                
                try:
                    # Execute the 6-step sequence
                    self.app._execute_six_step_sequence(user_input)
                finally:
                    # Restore original print
                    builtins.print = original_print
                
                # Hide working indicator
                self.chatbox.hide_working_indicator()
                
            except Exception as e:
                self.chatbox.hide_working_indicator()
                self.chatbox.add_message(f"Error processing task: {e}", MessageType.SYSTEM)
        
        thread = threading.Thread(target=task_processor)
        thread.daemon = True
        thread.start()


def main():
    """Main entry point for TUI."""
    def tui_main(stdscr):
        # Initialize curses mode properly
        try:
            curses.raw()
            curses.noecho()
        except:
            pass
        
        try:
            curses.curs_set(1)
        except:
            pass
        
        stdscr.keypad(True)
        stdscr.nodelay(False)
        stdscr.clear()
        stdscr.refresh()
        
        # Create and run TUI
        tui = TermaiteTUI(stdscr)
        tui.run()
    
    # Initialize curses properly
    stdscr = curses.initscr()
    try:
        tui_main(stdscr)
    finally:
        try:
            curses.noraw()
        except:
            pass
        try:
            stdscr.keypad(False)
        except:
            pass
        try:
            curses.echo()
        except:
            pass
        try:
            curses.endwin()
        except:
            pass


if __name__ == "__main__":
    main()