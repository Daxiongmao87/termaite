"""
Chatbox-style TUI interface implementation for termaite.

This module implements a true chatbox interface with proper message distinction
and visual separation between user, agent, and system messages.
"""

import curses
import threading
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


class MessageType(Enum):
    """Message types for visual distinction."""
    USER = "user"
    AGENT = "agent"
    SYSTEM = "system"
    WORKING = "working"


@dataclass
class ChatMessage:
    """Represents a message in the chatbox."""
    content: str
    message_type: MessageType
    timestamp: str
    formatted_lines: List[str] = None


class ChatboxTUI:
    """True chatbox-style TUI interface."""
    
    def __init__(self, stdscr, app):
        self.stdscr = stdscr
        self.app = app
        self.height, self.width = stdscr.getmaxyx()
        
        # Message history
        self.messages: List[ChatMessage] = []
        self.scroll_offset = 0
        
        # Input handling
        self.input_buffer = ""
        self.cursor_pos = 0
        self.command_history = []
        self.history_index = -1
        
        # UI state
        self.running = True
        self.current_modal = None
        self.working_indicator = None
        self.working_thread = None
        
        # Colors
        self.colors_enabled = False
        self._init_colors()
        
        # Layout constants
        self.INPUT_HEIGHT = 3  # Input area height
        self.SEPARATOR_HEIGHT = 1
        self.CHAT_HEIGHT = self.height - self.INPUT_HEIGHT - self.SEPARATOR_HEIGHT
        
    def _init_colors(self):
        """Initialize color pairs."""
        try:
            curses.start_color()
            curses.use_default_colors()
            
            # Define color pairs
            curses.init_pair(1, curses.COLOR_GREEN, -1)   # User messages
            curses.init_pair(2, curses.COLOR_BLUE, -1)    # Agent messages
            curses.init_pair(3, curses.COLOR_YELLOW, -1)  # System messages
            curses.init_pair(4, curses.COLOR_CYAN, -1)    # Working indicator
            curses.init_pair(5, curses.COLOR_RED, -1)     # Error messages
            
            self.colors_enabled = True
        except curses.error:
            self.colors_enabled = False
    
    def _get_color_pair(self, message_type: MessageType) -> int:
        """Get color pair for message type."""
        if not self.colors_enabled:
            return 0
        
        color_map = {
            MessageType.USER: 1,
            MessageType.AGENT: 2,
            MessageType.SYSTEM: 3,
            MessageType.WORKING: 4
        }
        return color_map.get(message_type, 0)
    
    def _get_message_prefix(self, message_type: MessageType) -> str:
        """Get visual prefix for message type."""
        prefix_map = {
            MessageType.USER: "👤 You",
            MessageType.AGENT: "🤖 Agent",
            MessageType.SYSTEM: "⚙️  System",
            MessageType.WORKING: "⏳ Working..."
        }
        return prefix_map.get(message_type, "")
    
    def _format_message(self, message: ChatMessage) -> List[str]:
        """Format a message for display with proper word wrapping."""
        if message.formatted_lines:
            return message.formatted_lines
        
        # Calculate available width (account for prefix and margins)
        prefix = self._get_message_prefix(message.message_type)
        available_width = self.width - 4  # 2 chars margin on each side
        
        lines = []
        
        # Add prefix line
        lines.append(f"  {prefix}")
        
        # Format content with word wrapping
        content_lines = message.content.split('\n')
        for content_line in content_lines:
            if len(content_line) <= available_width:
                lines.append(f"  {content_line}")
            else:
                # Word wrap
                words = content_line.split(' ')
                current_line = "  "
                for word in words:
                    if len(current_line + word + " ") <= available_width:
                        current_line += word + " "
                    else:
                        if current_line.strip():
                            lines.append(current_line.rstrip())
                        current_line = f"  {word} "
                if current_line.strip():
                    lines.append(current_line.rstrip())
        
        # Add separator line
        lines.append("")
        
        message.formatted_lines = lines
        return lines
    
    def add_message(self, content: str, message_type: MessageType):
        """Add a new message to the chatbox."""
        import datetime
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        
        message = ChatMessage(
            content=content,
            message_type=message_type,
            timestamp=timestamp
        )
        
        self.messages.append(message)
        
        # Auto-scroll to bottom
        self._auto_scroll()
        
        # Redraw screen
        self.draw_screen()
    
    def show_working_indicator(self, message: str = "Processing..."):
        """Show animated working indicator."""
        self.working_indicator = message
        
        # Start animation thread
        if self.working_thread is None or not self.working_thread.is_alive():
            self.working_thread = threading.Thread(target=self._animate_working)
            self.working_thread.daemon = True
            self.working_thread.start()
    
    def hide_working_indicator(self):
        """Hide working indicator."""
        self.working_indicator = None
        self.draw_screen()
    
    def _animate_working(self):
        """Animate the working indicator."""
        animation_chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        char_index = 0
        
        while self.working_indicator:
            if self.working_indicator:
                # Update the last message if it's a working message
                if self.messages and self.messages[-1].message_type == MessageType.WORKING:
                    self.messages[-1].content = f"{animation_chars[char_index]} {self.working_indicator}"
                    self.messages[-1].formatted_lines = None  # Reset formatting
                else:
                    # Add new working message
                    self.add_message(f"{animation_chars[char_index]} {self.working_indicator}", MessageType.WORKING)
                
                char_index = (char_index + 1) % len(animation_chars)
                self.draw_screen()
                time.sleep(0.1)
    
    def _auto_scroll(self):
        """Auto-scroll to show latest messages."""
        total_lines = sum(len(self._format_message(msg)) for msg in self.messages)
        if total_lines > self.CHAT_HEIGHT:
            self.scroll_offset = total_lines - self.CHAT_HEIGHT
        else:
            self.scroll_offset = 0
    
    def draw_screen(self):
        """Draw the complete chatbox interface."""
        try:
            self.stdscr.clear()
            
            # Draw chat area
            self._draw_chat_area()
            
            # Draw separator
            self._draw_separator()
            
            # Draw input area
            self._draw_input_area()
            
            # Draw status line
            self._draw_status_line()
            
            # Refresh screen
            self.stdscr.refresh()
            
        except curses.error:
            pass  # Ignore curses errors during drawing
    
    def _draw_chat_area(self):
        """Draw the chat message area."""
        # Collect all formatted lines
        all_lines = []
        for message in self.messages:
            formatted = self._format_message(message)
            all_lines.extend([(line, message.message_type) for line in formatted])
        
        # Apply scroll offset
        visible_lines = all_lines[self.scroll_offset:self.scroll_offset + self.CHAT_HEIGHT]
        
        # Draw visible lines
        for row, (line, msg_type) in enumerate(visible_lines):
            if row < self.CHAT_HEIGHT:
                try:
                    color_pair = self._get_color_pair(msg_type)
                    if self.colors_enabled:
                        self.stdscr.attron(curses.color_pair(color_pair))
                    
                    # Truncate line to fit screen
                    display_line = line[:self.width-1]
                    self.stdscr.addstr(row, 0, display_line)
                    
                    if self.colors_enabled:
                        self.stdscr.attroff(curses.color_pair(color_pair))
                        
                except curses.error:
                    pass
    
    def _draw_separator(self):
        """Draw separator line between chat and input."""
        separator_row = self.CHAT_HEIGHT
        try:
            separator = "─" * (self.width - 1)
            self.stdscr.addstr(separator_row, 0, separator)
        except curses.error:
            pass
    
    def _draw_input_area(self):
        """Draw the input area with prompt."""
        input_row = self.CHAT_HEIGHT + self.SEPARATOR_HEIGHT
        
        try:
            # Clear input area
            for i in range(self.INPUT_HEIGHT):
                self.stdscr.move(input_row + i, 0)
                self.stdscr.clrtoeol()
            
            # Draw prompt
            prompt = "termaite> "
            self.stdscr.addstr(input_row, 0, prompt)
            
            # Draw input text
            input_display = self.input_buffer[:self.width - len(prompt) - 1]
            self.stdscr.addstr(input_row, len(prompt), input_display)
            
            # Position cursor
            cursor_x = len(prompt) + min(self.cursor_pos, len(input_display))
            self.stdscr.move(input_row, cursor_x)
            
        except curses.error:
            pass
    
    def _draw_status_line(self):
        """Draw status line at bottom."""
        status_row = self.height - 1
        
        try:
            self.stdscr.move(status_row, 0)
            self.stdscr.clrtoeol()
            
            # Create status text
            status_parts = []
            
            # Session info
            if hasattr(self.app, 'session_manager'):
                session = self.app.session_manager.get_current_session()
                if session:
                    status_parts.append(f"Session: {session.title}")
            
            # Message count
            status_parts.append(f"Messages: {len(self.messages)}")
            
            # Help text
            status_parts.append("Commands: /help | /exit")
            
            status_text = " | ".join(status_parts)
            
            # Truncate to fit
            if len(status_text) > self.width - 1:
                status_text = status_text[:self.width - 4] + "..."
            
            self.stdscr.addstr(status_row, 0, status_text)
            
        except curses.error:
            pass
    
    def handle_input(self, key: int):
        """Handle user input."""
        if key == curses.KEY_ENTER or key == 10 or key == 13:
            # Enter key - process command
            if self.input_buffer.strip():
                self.process_input(self.input_buffer.strip())
                self.command_history.append(self.input_buffer.strip())
                self.history_index = len(self.command_history)
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
                
        elif key == curses.KEY_UP:
            # Up arrow - command history
            if self.command_history and self.history_index > 0:
                self.history_index -= 1
                self.input_buffer = self.command_history[self.history_index]
                self.cursor_pos = len(self.input_buffer)
                
        elif key == curses.KEY_DOWN:
            # Down arrow - command history
            if self.command_history and self.history_index < len(self.command_history) - 1:
                self.history_index += 1
                self.input_buffer = self.command_history[self.history_index]
                self.cursor_pos = len(self.input_buffer)
            elif self.history_index >= len(self.command_history) - 1:
                self.input_buffer = ""
                self.cursor_pos = 0
                self.history_index = len(self.command_history)
                
        elif key == curses.KEY_HOME:
            # Home key
            self.cursor_pos = 0
            
        elif key == curses.KEY_END:
            # End key
            self.cursor_pos = len(self.input_buffer)
            
        elif key == curses.KEY_PPAGE:
            # Page up - scroll up
            self.scroll_offset = max(0, self.scroll_offset - self.CHAT_HEIGHT // 2)
            
        elif key == curses.KEY_NPAGE:
            # Page down - scroll down
            total_lines = sum(len(self._format_message(msg)) for msg in self.messages)
            max_scroll = max(0, total_lines - self.CHAT_HEIGHT)
            self.scroll_offset = min(max_scroll, self.scroll_offset + self.CHAT_HEIGHT // 2)
            
        elif 32 <= key <= 126:  # Printable characters
            # Insert character
            char = chr(key)
            self.input_buffer = self.input_buffer[:self.cursor_pos] + char + self.input_buffer[self.cursor_pos:]
            self.cursor_pos += 1
        
        # Redraw screen
        self.draw_screen()
    
    def process_input(self, user_input: str):
        """Process user input."""
        # Add user message to chat
        self.add_message(user_input, MessageType.USER)
        
        # Handle built-in commands
        if user_input.startswith('/'):
            self.handle_builtin_command(user_input)
        else:
            # Handle task input
            self.handle_task_input(user_input)
    
    def handle_builtin_command(self, command: str):
        """Handle built-in commands."""
        parts = command.split()
        cmd = parts[0].lower()
        
        if cmd == '/exit':
            self.running = False
            self.add_message("Goodbye!", MessageType.SYSTEM)
            
        elif cmd == '/help':
            help_text = """Built-in Commands:
/new      - Create a new session
/history  - Show session history
/config   - Edit configuration
/model    - Show available models
/init     - Initialize project
/status   - Show current session status
/help     - Show this help message
/exit     - Exit termaite

Simply type your task or request to start working."""
            self.add_message(help_text, MessageType.SYSTEM)
            
        elif cmd == '/new':
            self.add_message("Creating new session...", MessageType.SYSTEM)
            # Implementation would call app methods
            
        else:
            self.add_message(f"Unknown command: {cmd}. Type '/help' for available commands.", MessageType.SYSTEM)
    
    def handle_task_input(self, user_input: str):
        """Handle task input from user. Override this method."""
        # This method should be overridden by the parent TUI class
        self.add_message("Task processing not implemented", MessageType.SYSTEM)
    
    def run(self):
        """Main TUI loop."""
        # Initialize with welcome message
        self.add_message("Welcome to Termaite!", MessageType.SYSTEM)
        self.add_message("Type '/help' for commands or enter a task to get started.", MessageType.SYSTEM)
        
        # Main event loop
        while self.running:
            try:
                key = self.stdscr.getch()
                self.handle_input(key)
            except KeyboardInterrupt:
                self.add_message("Use '/exit' to quit.", MessageType.SYSTEM)
            except Exception as e:
                self.add_message(f"Input error: {e}", MessageType.SYSTEM)