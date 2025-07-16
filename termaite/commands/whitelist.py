"""
Command whitelisting system for termaite.
"""

import json
import shlex
from pathlib import Path
from typing import Set, Dict, Any, Optional
from ..config.manager import ConfigManager


class CommandWhitelist:
    """Manages command whitelist for user approval."""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.config = config_manager.load_config()
        self.whitelist_enabled = self.config.whitelist.enabled
        self.whitelist_file = Path(self.config.whitelist.file).expanduser()
        self.whitelist_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Load existing whitelist
        self.whitelisted_commands: Set[str] = self._load_whitelist()
    
    def _load_whitelist(self) -> Set[str]:
        """Load whitelist from file."""
        if not self.whitelist_file.exists():
            return set()
        
        try:
            with open(self.whitelist_file, 'r') as f:
                data = json.load(f)
                return set(data.get('commands', []))
        except Exception:
            return set()
    
    def _save_whitelist(self) -> None:
        """Save whitelist to file."""
        try:
            data = {
                'commands': list(self.whitelisted_commands),
                'version': '1.0'
            }
            
            with open(self.whitelist_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass  # Silently fail - whitelist is not critical
    
    def _extract_base_command(self, command: str) -> str:
        """Extract base command from full command string."""
        try:
            tokens = shlex.split(command)
            if tokens:
                return tokens[0]
            return ""
        except ValueError:
            return ""
    
    def is_command_whitelisted(self, command: str) -> bool:
        """Check if a command is whitelisted."""
        if not self.whitelist_enabled:
            return True
        
        base_command = self._extract_base_command(command)
        return base_command in self.whitelisted_commands
    
    def request_approval(self, command: str) -> str:
        """Request user approval for a command."""
        if not self.whitelist_enabled:
            return "approved"
        
        base_command = self._extract_base_command(command)
        
        if base_command in self.whitelisted_commands:
            return "approved"
        
        # In a real implementation, this would prompt the user
        # For now, we'll return a placeholder
        return "pending"
    
    def add_to_whitelist(self, command: str) -> None:
        """Add a command to the whitelist."""
        base_command = self._extract_base_command(command)
        if base_command:
            self.whitelisted_commands.add(base_command)
            self._save_whitelist()
    
    def remove_from_whitelist(self, command: str) -> None:
        """Remove a command from the whitelist."""
        base_command = self._extract_base_command(command)
        if base_command in self.whitelisted_commands:
            self.whitelisted_commands.remove(base_command)
            self._save_whitelist()
    
    def get_whitelisted_commands(self) -> Set[str]:
        """Get all whitelisted commands."""
        return self.whitelisted_commands.copy()
    
    def clear_whitelist(self) -> None:
        """Clear the whitelist."""
        self.whitelisted_commands.clear()
        self._save_whitelist()
    
    def get_whitelist_status(self) -> Dict[str, Any]:
        """Get whitelist status information."""
        return {
            'enabled': self.whitelist_enabled,
            'file': str(self.whitelist_file),
            'command_count': len(self.whitelisted_commands),
            'commands': list(self.whitelisted_commands)
        }
    
    def initialize_with_safe_commands(self) -> None:
        """Initialize whitelist with commonly safe commands."""
        safe_commands = {
            'ls', 'pwd', 'whoami', 'date', 'uname', 'cat', 'head', 'tail',
            'grep', 'find', 'wc', 'sort', 'uniq', 'cut', 'echo', 'printf',
            'which', 'file', 'basename', 'dirname', 'realpath', 'stat',
            'df', 'du', 'ps', 'tr', 'sed', 'awk', 'mkdir', 'touch'
        }
        
        self.whitelisted_commands.update(safe_commands)
        self._save_whitelist()


class UserApprovalHandler:
    """Handles user approval for commands."""
    
    def __init__(self, whitelist: CommandWhitelist, gremlin_mode: bool = False):
        self.whitelist = whitelist
        self.gremlin_mode = gremlin_mode
    
    def get_approval(self, command: str) -> str:
        """Get user approval for a command."""
        if self.gremlin_mode:
            return "approved"
        
        if self.whitelist.is_command_whitelisted(command):
            return "approved"
        
        # This would normally show a prompt to the user
        # For now, we'll return a placeholder
        return "pending"
    
    def process_approval_response(self, command: str, response: str) -> bool:
        """Process user approval response."""
        if response.lower() in ['y', 'yes', 'a', 'always']:
            if response.lower() in ['a', 'always']:
                self.whitelist.add_to_whitelist(command)
            return True
        
        return False