"""
Command executor with safety and whitelisting.
"""

import subprocess
import threading
import signal
import os
from pathlib import Path
from typing import Tuple, Optional
from ..config.manager import ConfigManager
from .safety import CommandSafetyChecker
from .whitelist import CommandWhitelist, UserApprovalHandler


class CommandExecutor:
    """Executes bash commands with safety checks and whitelisting."""
    
    def __init__(self, config_manager: ConfigManager, approval_callback=None):
        self.config_manager = config_manager
        self.config = config_manager.load_config()
        self.safety_checker = CommandSafetyChecker(config_manager)
        self.whitelist = CommandWhitelist(config_manager)
        self.approval_handler = UserApprovalHandler(
            self.whitelist, 
            self.config.security.gremlin_mode
        )
        
        # Callback for user approval (used by TUI)
        self.approval_callback = approval_callback
        
        # Set working directory to project root (resolve to absolute path)
        self.working_directory = os.path.abspath(self.config.security.project_root)
        
        # Initialize whitelist with safe commands if empty
        if not self.whitelist.get_whitelisted_commands():
            self.whitelist.initialize_with_safe_commands()
    
    def execute_command(self, command: str) -> Tuple[bool, str, str]:
        """Execute a command with safety checks."""
        # Validate command safety
        is_safe, safety_reason = self.safety_checker.validate_command(command)
        if not is_safe:
            return False, "", f"Command rejected by safety checker: {safety_reason}"
        
        # Check whitelist/approval
        approval_status = self.approval_handler.get_approval(command)
        if approval_status == "pending":
            # Use callback for approval if available
            if self.approval_callback:
                try:
                    base_command = self.whitelist._extract_base_command(command)
                    message = f"Allow execution of command '{base_command}'?"
                    user_response = self.approval_callback(command, message)
                    
                    if user_response.lower() in ['yes', 'y']:
                        approval_status = "approved"
                    elif user_response.lower() in ['always', 'a']:
                        self.whitelist.add_to_whitelist(command)
                        approval_status = "approved"
                    else:
                        return False, "", f"Command not approved by user: {command}"
                except Exception as e:
                    return False, "", f"Error getting user approval: {e}"
            else:
                return False, "", f"Command requires approval: {command}"
        elif approval_status != "approved":
            return False, "", f"Command not approved: {command}"
        
        # Execute the command
        try:
            return self._run_command(command)
        except Exception as e:
            return False, "", f"Command execution failed: {e}"
    
    def _run_command(self, command: str) -> Tuple[bool, str, str]:
        """Run the actual command."""
        timeout = self.safety_checker.check_command_timeout(command)
        
        try:
            # Use subprocess with timeout
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=self.working_directory,
                env=os.environ.copy()
            )
            
            # Sanitize output
            stdout = self.safety_checker.sanitize_output(result.stdout)
            stderr = self.safety_checker.sanitize_output(result.stderr)
            
            success = result.returncode == 0
            return success, stdout, stderr
            
        except subprocess.TimeoutExpired:
            return False, "", f"Command timed out after {timeout} seconds"
        except subprocess.CalledProcessError as e:
            stderr = self.safety_checker.sanitize_output(e.stderr or "")
            return False, "", f"Command failed with return code {e.returncode}: {stderr}"
        except Exception as e:
            return False, "", f"Command execution error: {e}"
    
    def test_command(self, command: str) -> Tuple[bool, str]:
        """Test if a command would be allowed without executing it."""
        # Check safety
        is_safe, safety_reason = self.safety_checker.validate_command(command)
        if not is_safe:
            return False, f"Safety check failed: {safety_reason}"
        
        # Check whitelist
        if not self.whitelist.is_command_whitelisted(command):
            return False, "Command not whitelisted"
        
        return True, "Command would be allowed"
    
    def get_command_suggestions(self) -> str:
        """Get safe command suggestions."""
        suggestions = self.safety_checker.get_safe_command_suggestions()
        return "\n".join(suggestions)
    
    def get_whitelist_status(self) -> str:
        """Get whitelist status information."""
        status = self.whitelist.get_whitelist_status()
        
        lines = [
            f"Whitelist enabled: {status['enabled']}",
            f"Whitelisted commands: {status['command_count']}",
            f"Whitelist file: {status['file']}"
        ]
        
        if status['commands']:
            lines.append("\nWhitelisted commands:")
            for cmd in sorted(status['commands']):
                lines.append(f"  - {cmd}")
        
        return "\n".join(lines)
    
    def approve_command(self, command: str, approval_type: str = "yes") -> bool:
        """Approve a command for execution."""
        return self.approval_handler.process_approval_response(command, approval_type)
    
    def is_gremlin_mode(self) -> bool:
        """Check if gremlin mode is enabled."""
        return self.config.security.gremlin_mode
    
    def set_working_directory(self, directory: str) -> bool:
        """Set the working directory for command execution."""
        try:
            abs_path = os.path.abspath(directory)
            
            # Ensure directory is within project root
            if not self.safety_checker._is_path_within_project_root(Path(abs_path)):
                return False
            
            if os.path.isdir(abs_path):
                self.working_directory = abs_path
                return True
            
            return False
            
        except Exception:
            return False
    
    def get_working_directory(self) -> str:
        """Get the current working directory."""
        return self.working_directory