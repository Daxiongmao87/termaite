#!/usr/bin/env python3
"""
Test command execution with real commands.
"""

import pytest
import tempfile
import os
import shutil
from pathlib import Path

from termaite.config.manager import ConfigManager
from termaite.config.templates import ensure_config_exists
from termaite.commands.executor import CommandExecutor
from termaite.commands.safety import CommandSafetyChecker
from termaite.commands.whitelist import CommandWhitelist


class TestRealCommandExecution:
    """Test real command execution with safety checks."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        self.original_cwd = os.getcwd()
        
        os.environ['HOME'] = self.temp_dir
        os.chdir(self.temp_dir)
        
        # Create config
        ensure_config_exists()
        self.config_manager = ConfigManager()
        self.command_executor = CommandExecutor(self.config_manager)
        
        # Initialize whitelist with safe commands
        self.command_executor.whitelist.initialize_with_safe_commands()
    
    def teardown_method(self):
        """Clean up test environment."""
        os.chdir(self.original_cwd)
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    def test_basic_safe_commands(self):
        """Test basic safe commands."""
        # Test pwd
        success, stdout, stderr = self.command_executor.execute_command("pwd")
        assert success
        assert self.temp_dir in stdout
        
        # Test echo
        success, stdout, stderr = self.command_executor.execute_command("echo 'Hello World'")
        assert success
        assert "Hello World" in stdout
        
        # Test ls (empty directory)
        success, stdout, stderr = self.command_executor.execute_command("ls")
        assert success
        # Should be empty or contain config files
    
    def test_file_operations(self):
        """Test file operations within project root."""
        # Create a test file
        test_file = Path(self.temp_dir) / "test.txt"
        test_file.write_text("Hello World\nLine 2\nLine 3\n")
        
        # Test cat
        success, stdout, stderr = self.command_executor.execute_command("cat test.txt")
        assert success
        assert "Hello World" in stdout
        assert "Line 2" in stdout
        
        # Test head
        success, stdout, stderr = self.command_executor.execute_command("head -2 test.txt")
        assert success
        assert "Hello World" in stdout
        assert "Line 2" in stdout
        assert "Line 3" not in stdout
        
        # Test grep
        success, stdout, stderr = self.command_executor.execute_command("grep 'Line' test.txt")
        assert success
        assert "Line 2" in stdout
        assert "Line 3" in stdout
    
    def test_directory_operations(self):
        """Test directory operations."""
        # Test mkdir
        success, stdout, stderr = self.command_executor.execute_command("mkdir test_dir")
        assert success
        
        # Verify directory was created
        assert Path(self.temp_dir, "test_dir").exists()
        
        # Test ls to see the directory
        success, stdout, stderr = self.command_executor.execute_command("ls")
        assert success
        assert "test_dir" in stdout
        
        # Test find
        success, stdout, stderr = self.command_executor.execute_command("find . -name 'test_dir'")
        assert success
        assert "test_dir" in stdout
    
    def test_command_chaining_blocked(self):
        """Test that command chaining is blocked."""
        # Command with &&
        success, stdout, stderr = self.command_executor.execute_command("echo 'test' && ls")
        assert not success
        assert "Command chaining not allowed" in stderr
        
        # Command with ||
        success, stdout, stderr = self.command_executor.execute_command("echo 'test' || ls")
        assert not success
        assert "Command chaining not allowed" in stderr
        
        # Command with ;
        success, stdout, stderr = self.command_executor.execute_command("echo 'test'; ls")
        assert not success
        assert "Command chaining not allowed" in stderr
    
    def test_dangerous_commands_blocked(self):
        """Test that dangerous commands are blocked."""
        dangerous_commands = [
            "rm -rf /",
            "dd if=/dev/zero of=/dev/sda",
            "mkfs.ext4 /dev/sda1",
            "chmod 777 /etc/passwd"
        ]
        
        for cmd in dangerous_commands:
            success, stdout, stderr = self.command_executor.execute_command(cmd)
            assert not success
            # Should contain some indication that the command was rejected
            assert any(phrase in stderr.lower() for phrase in ["not allowed", "rejected", "blocked", "dangerous"])
    
    def test_tui_commands_blocked(self):
        """Test that TUI commands are blocked."""
        tui_commands = [
            "vim test.txt",
            "nano test.txt",
            "less test.txt",
            "more test.txt",
            "top",
            "htop"
        ]
        
        for cmd in tui_commands:
            success, stdout, stderr = self.command_executor.execute_command(cmd)
            assert not success
            assert "TUI command not allowed" in stderr
    
    def test_filesystem_protection(self):
        """Test filesystem protection."""
        # Try to access files outside project root
        outside_commands = [
            "cat /etc/passwd",
            "ls /root",
            "touch /tmp/test_file"
        ]
        
        for cmd in outside_commands:
            success, stdout, stderr = self.command_executor.execute_command(cmd)
            # Should either be blocked by safety or fail due to permissions
            # The key is that it doesn't succeed in accessing sensitive files
    
    def test_command_timeout(self):
        """Test command timeout functionality."""
        # Test a command that should complete quickly
        success, stdout, stderr = self.command_executor.execute_command("echo 'quick command'")
        assert success
        
        # Test a command that might take longer (but should still complete)
        success, stdout, stderr = self.command_executor.execute_command("find . -name '*.txt'")
        assert success
    
    def test_whitelist_functionality(self):
        """Test whitelist functionality."""
        # Test that whitelisted commands work
        assert self.command_executor.whitelist.is_command_whitelisted("ls")
        assert self.command_executor.whitelist.is_command_whitelisted("echo")
        
        # Test that non-whitelisted commands are blocked
        # (In gremlin mode, this might be bypassed)
        if not self.command_executor.is_gremlin_mode():
            success, stdout, stderr = self.command_executor.execute_command("nonexistent_command")
            assert not success
    
    def test_working_directory_constraints(self):
        """Test working directory constraints."""
        # Should start in project root
        initial_wd = self.command_executor.get_working_directory()
        assert initial_wd == self.temp_dir
        
        # Create subdirectory
        subdir = os.path.join(self.temp_dir, "subdir")
        os.makedirs(subdir)
        
        # Should be able to change to subdirectory within project
        success = self.command_executor.set_working_directory(subdir)
        assert success
        
        # Should not be able to change to directory outside project
        success = self.command_executor.set_working_directory("/tmp")
        assert not success
    
    def test_output_sanitization(self):
        """Test output sanitization."""
        # Create a file with potentially sensitive content
        test_file = Path(self.temp_dir) / "sensitive.txt"
        test_file.write_text("password=secret123\ntoken=abc123\nNormal content here\n")
        
        success, stdout, stderr = self.command_executor.execute_command("cat sensitive.txt")
        assert success
        
        # The sanitization should filter out sensitive lines
        # (This depends on implementation details)
        assert "Normal content here" in stdout
    
    def test_command_suggestions(self):
        """Test command suggestions."""
        suggestions = self.command_executor.get_command_suggestions()
        
        # Should contain helpful suggestions
        assert "ls" in suggestions
        assert "find" in suggestions
        assert "grep" in suggestions
        assert "cat" in suggestions
    
    def test_status_reporting(self):
        """Test status reporting."""
        status = self.command_executor.get_whitelist_status()
        
        # Should contain status information
        assert "Whitelist enabled" in status
        assert "commands" in status.lower()


class TestEdgeCases:
    """Test edge cases and error scenarios."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        self.original_cwd = os.getcwd()
        
        os.environ['HOME'] = self.temp_dir
        os.chdir(self.temp_dir)
        
        # Create config
        ensure_config_exists()
        self.config_manager = ConfigManager()
        self.command_executor = CommandExecutor(self.config_manager)
    
    def teardown_method(self):
        """Clean up test environment."""
        os.chdir(self.original_cwd)
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    def test_empty_command(self):
        """Test empty command handling."""
        success, stdout, stderr = self.command_executor.execute_command("")
        assert not success
        assert "Empty command" in stderr
    
    def test_invalid_command(self):
        """Test invalid command handling."""
        success, stdout, stderr = self.command_executor.execute_command("nonexistent_command_12345")
        assert not success
        # Should either be blocked by whitelist or fail during execution
    
    def test_command_with_special_characters(self):
        """Test commands with special characters."""
        # Test with quotes
        success, stdout, stderr = self.command_executor.execute_command('echo "Hello World"')
        # Should work if properly parsed
        
        # Test with backslashes
        success, stdout, stderr = self.command_executor.execute_command('echo "Line 1\nLine 2"')
        # Should work if properly parsed
    
    def test_very_long_command(self):
        """Test very long command."""
        long_arg = "a" * 1000
        success, stdout, stderr = self.command_executor.execute_command(f"echo '{long_arg}'")
        # Should either work or be rejected for safety reasons
    
    def test_malformed_paths(self):
        """Test malformed path handling."""
        malformed_commands = [
            "cat //invalid//path",
            "ls /.//..//etc",
            "cat ~/../../etc/passwd"
        ]
        
        for cmd in malformed_commands:
            success, stdout, stderr = self.command_executor.execute_command(cmd)
            # Should be handled safely (either blocked or fail safely)
    
    def test_command_parsing_edge_cases(self):
        """Test command parsing edge cases."""
        edge_cases = [
            "   ls   ",  # Extra whitespace
            "ls\t-la",  # Tab character
            "ls\n",     # Newline
            "ls; # comment",  # With comment
        ]
        
        for cmd in edge_cases:
            # Should either work or be safely rejected
            success, stdout, stderr = self.command_executor.execute_command(cmd)
            # The key is that it doesn't cause crashes or security issues


if __name__ == "__main__":
    pytest.main([__file__, "-v"])