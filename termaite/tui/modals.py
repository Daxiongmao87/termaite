"""
Modal interfaces for termaite TUI.
"""

import curses
from typing import List, Dict, Any, Optional
from ..core.application import TermaiteApplication


class BaseModal:
    """Base class for modal interfaces."""
    
    def __init__(self, stdscr, app: TermaiteApplication):
        self.stdscr = stdscr
        self.app = app
        self.height, self.width = stdscr.getmaxyx()
        self.visible = False
        self.selected_index = 0
        self.scroll_offset = 0
        
        # Modal dimensions
        self.modal_height = min(self.height - 4, 20)
        self.modal_width = min(self.width - 4, 80)
        self.modal_y = (self.height - self.modal_height) // 2
        self.modal_x = (self.width - self.modal_width) // 2
        
        # Create modal window
        self.modal_win = curses.newwin(
            self.modal_height,
            self.modal_width,
            self.modal_y,
            self.modal_x
        )
        
        # Skip colors - not supported in this terminal
        self.colors_enabled = False
    
    def show(self):
        """Show the modal."""
        self.visible = True
        self.selected_index = 0
        self.scroll_offset = 0
        self.refresh_data()
        self.draw()
    
    def hide(self):
        """Hide the modal."""
        self.visible = False
        self.modal_win.clear()
        self.modal_win.refresh()
    
    def refresh_data(self):
        """Refresh modal data (override in subclasses)."""
        pass
    
    def draw(self):
        """Draw the modal (override in subclasses)."""
        pass
    
    def handle_input(self, key: int) -> bool:
        """Handle input. Return True if modal should close."""
        if key == 27:  # ESC
            return True
        elif key == ord('q') or key == ord('Q'):
            return True
        elif key == curses.KEY_UP:
            self.move_selection(-1)
        elif key == curses.KEY_DOWN:
            self.move_selection(1)
        elif key == curses.KEY_ENTER or key == 10 or key == 13:
            return self.handle_select()
        
        self.draw()
        return False
    
    def move_selection(self, direction: int):
        """Move selection up or down."""
        # Override in subclasses
        pass
    
    def handle_select(self) -> bool:
        """Handle selection. Return True if modal should close."""
        # Override in subclasses
        return True
    
    def draw_border(self, title: str):
        """Draw modal border with title."""
        self.modal_win.clear()
        self.modal_win.box()
        
        # Draw title
        title_x = (self.modal_width - len(title)) // 2
        self.modal_win.addstr(0, title_x, f" {title} ", 0)
        
        # Draw instructions
        instructions = "↑/↓: Navigate  Enter: Select  ESC/Q: Cancel"
        if len(instructions) < self.modal_width - 2:
            inst_x = (self.modal_width - len(instructions)) // 2
            self.modal_win.addstr(self.modal_height - 1, inst_x, instructions, 0)


class HistoryModal(BaseModal):
    """Modal for browsing session history."""
    
    def __init__(self, stdscr, app: TermaiteApplication):
        super().__init__(stdscr, app)
        self.sessions: List[Dict[str, Any]] = []
        self.max_visible = self.modal_height - 4  # Account for border and instructions
    
    def refresh_data(self):
        """Refresh session history data."""
        self.sessions = self.app.session_manager.list_sessions()
        self.selected_index = 0
        self.scroll_offset = 0
    
    def draw(self):
        """Draw the history modal."""
        self.draw_border("Session History")
        
        if not self.sessions:
            # No sessions
            msg = "No sessions found"
            msg_x = (self.modal_width - len(msg)) // 2
            self.modal_win.addstr(self.modal_height // 2, msg_x, msg)
        else:
            # Draw sessions
            visible_start = self.scroll_offset
            visible_end = min(visible_start + self.max_visible, len(self.sessions))
            
            for i, session in enumerate(self.sessions[visible_start:visible_end]):
                line_y = 2 + i
                
                # Format session info
                status = "✓" if session['is_completed'] else "○"
                title = session['title'][:self.modal_width - 20]  # Truncate if too long
                msg_count = session['message_count']
                
                line = f"{status} {title} ({msg_count} msgs)"
                
                # Highlight selected item
                if visible_start + i == self.selected_index:
                    self.modal_win.addstr(line_y, 2, line[:self.modal_width - 4], curses.A_REVERSE)
                else:
                    self.modal_win.addstr(line_y, 2, line[:self.modal_width - 4])
            
            # Draw scroll indicator
            if len(self.sessions) > self.max_visible:
                scroll_info = f"[{self.selected_index + 1}/{len(self.sessions)}]"
                self.modal_win.addstr(1, self.modal_width - len(scroll_info) - 2, scroll_info)
        
        self.modal_win.refresh()
    
    def move_selection(self, direction: int):
        """Move selection up or down."""
        if not self.sessions:
            return
        
        old_index = self.selected_index
        self.selected_index = max(0, min(len(self.sessions) - 1, self.selected_index + direction))
        
        # Update scroll offset
        if self.selected_index < self.scroll_offset:
            self.scroll_offset = self.selected_index
        elif self.selected_index >= self.scroll_offset + self.max_visible:
            self.scroll_offset = self.selected_index - self.max_visible + 1
    
    def handle_select(self) -> bool:
        """Handle session selection."""
        if not self.sessions or self.selected_index >= len(self.sessions):
            return True
        
        session = self.sessions[self.selected_index]
        session_id = session['session_id']
        
        try:
            self.app.session_manager.load_session(session_id)
            # Modal will close and main interface will show the resumed session
            return True
        except Exception as e:
            # Could show error message in modal, but for now just close
            return True
    
    def handle_input(self, key: int) -> bool:
        """Handle input with delete key support."""
        if key == curses.KEY_DC or key == 127:  # Delete key
            return self.handle_delete()
        else:
            return super().handle_input(key)
    
    def handle_delete(self) -> bool:
        """Handle session deletion."""
        if not self.sessions or self.selected_index >= len(self.sessions):
            return False
        
        session = self.sessions[self.selected_index]
        session_id = session['session_id']
        
        try:
            self.app.session_manager.delete_session(session_id)
            self.refresh_data()
            
            # Adjust selection if needed
            if self.selected_index >= len(self.sessions) and self.sessions:
                self.selected_index = len(self.sessions) - 1
            
            self.draw()
            return False  # Keep modal open
        except Exception:
            return False  # Keep modal open on error


class ModelModal(BaseModal):
    """Modal for model selection."""
    
    def __init__(self, stdscr, app: TermaiteApplication):
        super().__init__(stdscr, app)
        self.models: List[str] = []
        self.current_model = ""
        self.max_visible = self.modal_height - 4
    
    def refresh_data(self):
        """Refresh model data."""
        try:
            self.models = self.app.llm_client.get_available_models()
            self.current_model = self.app.config_manager.load_config().llm.model
            
            # Set selected index to current model
            self.selected_index = 0
            for i, model in enumerate(self.models):
                if model == self.current_model:
                    self.selected_index = i
                    break
        except Exception:
            self.models = []
            self.current_model = "unknown"
        
        self.scroll_offset = 0
    
    def draw(self):
        """Draw the model selection modal."""
        self.draw_border("Model Selection")
        
        # Show current model
        current_line = f"Current: {self.current_model}"
        self.modal_win.addstr(1, 2, current_line[:self.modal_width - 4], 0)
        
        if not self.models:
            # No models available
            msg = "No models available"
            msg_x = (self.modal_width - len(msg)) // 2
            self.modal_win.addstr(self.modal_height // 2, msg_x, msg)
        else:
            # Draw models
            visible_start = self.scroll_offset
            visible_end = min(visible_start + self.max_visible, len(self.models))
            
            for i, model in enumerate(self.models[visible_start:visible_end]):
                line_y = 3 + i
                
                # Format model name
                model_name = model[:self.modal_width - 6]  # Truncate if too long
                
                # Show marker for current model
                if model == self.current_model:
                    line = f"* {model_name}"
                else:
                    line = f"  {model_name}"
                
                # Highlight selected item
                if visible_start + i == self.selected_index:
                    self.modal_win.addstr(line_y, 2, line[:self.modal_width - 4], curses.A_REVERSE)
                else:
                    self.modal_win.addstr(line_y, 2, line[:self.modal_width - 4])
            
            # Draw scroll indicator
            if len(self.models) > self.max_visible:
                scroll_info = f"[{self.selected_index + 1}/{len(self.models)}]"
                self.modal_win.addstr(2, self.modal_width - len(scroll_info) - 2, scroll_info)
        
        self.modal_win.refresh()
    
    def move_selection(self, direction: int):
        """Move selection up or down."""
        if not self.models:
            return
        
        old_index = self.selected_index
        self.selected_index = max(0, min(len(self.models) - 1, self.selected_index + direction))
        
        # Update scroll offset
        if self.selected_index < self.scroll_offset:
            self.scroll_offset = self.selected_index
        elif self.selected_index >= self.scroll_offset + self.max_visible:
            self.scroll_offset = self.selected_index - self.max_visible + 1
    
    def handle_select(self) -> bool:
        """Handle model selection and persist to configuration."""
        if not self.models or self.selected_index >= len(self.models):
            return True
        
        selected_model = self.models[self.selected_index]
        
        # Don't change if selecting the same model
        if selected_model == self.current_model:
            return True
        
        try:
            # Update configuration with selected model
            success = self.update_model_configuration(selected_model)
            if success:
                # Update local tracking
                self.current_model = selected_model
                
                # Reinitialize LLM client with new model
                self.reinitialize_llm_client()
                
                # Refresh display to show the change
                self.refresh_data()
                self.draw()
                
                # Show brief confirmation (optional)
                self.show_confirmation(f"Model changed to: {selected_model}")
                
        except Exception as e:
            # Show error message (optional)
            self.show_error(f"Failed to change model: {str(e)}")
            return False  # Keep modal open on error
        
        return True
    
    def update_model_configuration(self, model_name: str) -> bool:
        """Update the model in configuration file."""
        try:
            # Load current config
            config = self.app.config_manager.load_config()
            
            # Update model
            config.llm.model = model_name
            
            # Save configuration
            self.app.config_manager.save_config(config)
            
            return True
            
        except Exception as e:
            print(f"Error updating model configuration: {e}")
            return False
    
    def reinitialize_llm_client(self):
        """Reinitialize the LLM client with the new model."""
        try:
            # Recreate LLM client with updated config
            from ..llm.client import LLMClient
            self.app.llm_client = LLMClient(self.app.config_manager)
            
        except Exception as e:
            print(f"Error reinitializing LLM client: {e}")
    
    def show_confirmation(self, message: str):
        """Show a brief confirmation message."""
        # Simple confirmation - add message to status line
        try:
            msg_y = self.modal_height - 2
            msg_x = 2
            # Clear the line
            self.modal_win.addstr(msg_y, msg_x, " " * (self.modal_width - 4))
            # Show message
            self.modal_win.addstr(msg_y, msg_x, message[:self.modal_width - 4], curses.A_BOLD)
            self.modal_win.refresh()
            
            # Brief pause to show the message
            import time
            time.sleep(1.0)
            
        except Exception:
            pass  # Ignore display errors
    
    def show_error(self, message: str):
        """Show an error message."""
        try:
            msg_y = self.modal_height - 2
            msg_x = 2
            # Clear the line
            self.modal_win.addstr(msg_y, msg_x, " " * (self.modal_width - 4))
            # Show error message
            self.modal_win.addstr(msg_y, msg_x, message[:self.modal_width - 4], curses.A_REVERSE)
            self.modal_win.refresh()
            
            # Brief pause to show the message
            import time
            time.sleep(2.0)
            
        except Exception:
            pass  # Ignore display errors


class UserApprovalModal(BaseModal):
    """Modal for user approval prompts."""
    
    def __init__(self, stdscr, app: TermaiteApplication):
        super().__init__(stdscr, app)
        self.command = ""
        self.message = ""
        self.options = ["Yes", "No", "Always"]
        self.selected_index = 0
        self.result = None
        
        # Smaller modal for approval
        self.modal_height = 8
        self.modal_width = 60
        self.modal_y = (self.height - self.modal_height) // 2
        self.modal_x = (self.width - self.modal_width) // 2
        
        # Recreate modal window with new dimensions
        self.modal_win = curses.newwin(
            self.modal_height,
            self.modal_width,
            self.modal_y,
            self.modal_x
        )
    
    def show_approval(self, command: str, message: str) -> str:
        """Show approval modal and return user choice."""
        self.command = command
        self.message = message
        self.selected_index = 0
        self.result = None
        
        self.show()
        
        # Modal input loop
        while self.visible and self.result is None:
            self.draw()
            key = self.stdscr.getch()
            if self.handle_input(key):
                break
        
        self.hide()
        return self.result or "no"
    
    def draw(self):
        """Draw the approval modal."""
        self.modal_win.clear()
        self.modal_win.box()
        
        # Title
        title = "Command Approval"
        title_x = (self.modal_width - len(title)) // 2
        self.modal_win.addstr(0, title_x, f" {title} ", 0)
        
        # Message
        msg_lines = self.message.split('\n')
        for i, line in enumerate(msg_lines[:2]):  # Show max 2 lines
            self.modal_win.addstr(2 + i, 2, line[:self.modal_width - 4])
        
        # Command
        cmd_line = f"Command: {self.command}"
        self.modal_win.addstr(4, 2, cmd_line[:self.modal_width - 4], 0)
        
        # Options
        options_line = 5
        for i, option in enumerate(self.options):
            x_pos = 2 + i * 15
            if i == self.selected_index:
                self.modal_win.addstr(options_line, x_pos, f"[{option}]", curses.A_REVERSE)
            else:
                self.modal_win.addstr(options_line, x_pos, f" {option} ")
        
        # Instructions
        instructions = "↑/↓: Navigate  Enter: Select  ESC: Cancel"
        if len(instructions) < self.modal_width - 2:
            inst_x = (self.modal_width - len(instructions)) // 2
            self.modal_win.addstr(self.modal_height - 1, inst_x, instructions, 0)
        
        self.modal_win.refresh()
    
    def move_selection(self, direction: int):
        """Move selection left or right."""
        if direction == -1:  # Left
            self.selected_index = max(0, self.selected_index - 1)
        elif direction == 1:  # Right
            self.selected_index = min(len(self.options) - 1, self.selected_index + 1)
    
    def handle_select(self) -> bool:
        """Handle option selection."""
        if 0 <= self.selected_index < len(self.options):
            option = self.options[self.selected_index]
            self.result = option.lower()
        return True
    
    def handle_input(self, key: int) -> bool:
        """Handle input with left/right navigation."""
        if key == 27:  # ESC
            self.result = "no"
            return True
        elif key == ord('q') or key == ord('Q'):
            self.result = "no"
            return True
        elif key == curses.KEY_LEFT:
            self.move_selection(-1)
        elif key == curses.KEY_RIGHT:
            self.move_selection(1)
        elif key == curses.KEY_UP:
            self.move_selection(-1)
        elif key == curses.KEY_DOWN:
            self.move_selection(1)
        elif key == curses.KEY_ENTER or key == 10 or key == 13:
            return self.handle_select()
        elif key == ord('y') or key == ord('Y'):
            self.result = "yes"
            return True
        elif key == ord('n') or key == ord('N'):
            self.result = "no"
            return True
        elif key == ord('a') or key == ord('A'):
            self.result = "always"
            return True
        
        return False