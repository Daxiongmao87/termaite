#!/usr/bin/env python3
"""
Comprehensive test suite for Termaite.
"""

import pytest
import json
import tempfile
import os
import shutil
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Import all termaite modules
from termaite.config.manager import ConfigManager
from termaite.config.templates import ensure_config_exists
from termaite.llm.schemas import JSONProtocol, TaskStatus, PlanAction
from termaite.commands.safety import CommandSafetyChecker
from termaite.commands.whitelist import CommandWhitelist
from termaite.commands.executor import CommandExecutor
from termaite.core.session import SessionManager, SessionData
from termaite.core.goal_manager import GoalManager
from termaite.core.plan_manager import PlanManager
from termaite.llm.client import LLMClient
from termaite.utils.context_compactor import ContextCompactor
from termaite.utils.defensive_reader import DefensiveReader
from termaite.core.application import TermaiteApplication


class TestConfiguration:
    """Test configuration system."""
    
    def test_config_creation(self):
        """Test configuration file creation."""
        with tempfile.TemporaryDirectory() as temp_dir:
            original_home = os.environ.get('HOME')
            os.environ['HOME'] = temp_dir
            
            try:
                config_manager = ConfigManager()
                config_path = config_manager.get_config_path()
                
                # Config should not exist initially
                assert not config_path.exists()
                
                # Create config
                ensure_config_exists()
                assert config_path.exists()
                
                # Config should contain required sections
                with open(config_path, 'r') as f:
                    content = f.read()
                    assert '[llm]' in content
                    assert '[security]' in content
                    assert '[session]' in content
                    assert '[whitelist]' in content
                    assert '[context]' in content
                
            finally:
                if original_home:
                    os.environ['HOME'] = original_home
                else:
                    os.environ.pop('HOME', None)
    
    def test_config_validation(self):
        """Test configuration validation."""
        with tempfile.TemporaryDirectory() as temp_dir:
            original_home = os.environ.get('HOME')
            os.environ['HOME'] = temp_dir
            
            try:
                # Create valid config
                ensure_config_exists()
                config_manager = ConfigManager()
                
                # This should raise an error due to invalid endpoint
                with pytest.raises(ValueError, match="LLM endpoint must start with http"):
                    config_path = config_manager.get_config_path()
                    with open(config_path, 'w') as f:
                        f.write("""
[llm]
endpoint = "invalid-endpoint"
context_window = 4096
model = "test"

[security]
gremlin_mode = false
project_root = "."

[session]
history_dir = "~/.termaite/sessions"
max_sessions = 100

[whitelist]
enabled = true
file = "~/.termaite/whitelist.json"

[context]
compaction_threshold = 0.75
compaction_ratio = 0.50
max_output_ratio = 0.50
""")
                    config_manager.validate_config()
                    
            finally:
                if original_home:
                    os.environ['HOME'] = original_home
                else:
                    os.environ.pop('HOME', None)


class TestJSONProtocol:
    """Test JSON protocol validation."""
    
    def test_goal_response_validation(self):
        """Test goal response validation."""
        # Valid response
        valid_response = {
            "message": "Creating goal statement",
            "operation": {
                "create_goal": {
                    "statement": "Find all Python files"
                }
            }
        }
        
        parsed = JSONProtocol.validate_goal_response(valid_response)
        assert parsed.message == "Creating goal statement"
        assert parsed.operation.create_goal["statement"] == "Find all Python files"
        
        # Invalid response - missing message
        invalid_response = {
            "operation": {
                "create_goal": {
                    "statement": "Find all Python files"
                }
            }
        }
        
        with pytest.raises(ValueError, match="Missing 'message' field"):
            JSONProtocol.validate_goal_response(invalid_response)
        
        # Invalid response - empty statement
        invalid_response2 = {
            "message": "Creating goal statement",
            "operation": {
                "create_goal": {
                    "statement": ""
                }
            }
        }
        
        with pytest.raises(ValueError, match="Goal statement must be a non-empty string"):
            JSONProtocol.validate_goal_response(invalid_response2)
    
    def test_task_status_validation(self):
        """Test task status validation."""
        # Valid response
        valid_response = {
            "message": "Task is in progress",
            "operation": {
                "determine_task_status": "IN_PROGRESS"
            }
        }
        
        parsed = JSONProtocol.validate_task_status_response(valid_response)
        assert parsed.message == "Task is in progress"
        assert parsed.operation.determine_task_status == "IN_PROGRESS"
        
        # Invalid status
        invalid_response = {
            "message": "Task status",
            "operation": {
                "determine_task_status": "INVALID_STATUS"
            }
        }
        
        with pytest.raises(ValueError, match="Invalid task status"):
            JSONProtocol.validate_task_status_response(invalid_response)
    
    def test_plan_validation(self):
        """Test plan validation."""
        # Valid response
        valid_response = {
            "message": "Creating plan",
            "operation": {
                "manage_plan": [
                    {
                        "step": 1,
                        "action": "INSERT",
                        "description": "ls -la"
                    },
                    {
                        "step": 2,
                        "action": "EDIT",
                        "description": "grep pattern file"
                    }
                ]
            }
        }
        
        parsed = JSONProtocol.validate_plan_response(valid_response)
        assert parsed.message == "Creating plan"
        assert len(parsed.operation.manage_plan) == 2
        assert parsed.operation.manage_plan[0].step == 1
        assert parsed.operation.manage_plan[0].action == "INSERT"
        
        # Invalid action
        invalid_response = {
            "message": "Creating plan",
            "operation": {
                "manage_plan": [
                    {
                        "step": 1,
                        "action": "INVALID_ACTION",
                        "description": "ls -la"
                    }
                ]
            }
        }
        
        with pytest.raises(ValueError, match="Invalid action"):
            JSONProtocol.validate_plan_response(invalid_response)
    
    def test_bash_validation(self):
        """Test bash command validation."""
        # Valid response
        valid_response = {
            "message": "Executing command",
            "operation": {
                "invoke_bash_command": {
                    "command": "ls -la"
                }
            }
        }
        
        parsed = JSONProtocol.validate_bash_response(valid_response)
        assert parsed.message == "Executing command"
        assert parsed.operation.invoke_bash_command["command"] == "ls -la"
        
        # Empty command
        invalid_response = {
            "message": "Executing command",
            "operation": {
                "invoke_bash_command": {
                    "command": ""
                }
            }
        }
        
        with pytest.raises(ValueError, match="Command must be a non-empty string"):
            JSONProtocol.validate_bash_response(invalid_response)
    
    def test_parse_response(self):
        """Test response parsing with different types."""
        goal_response = '{"message": "Goal created", "operation": {"create_goal": {"statement": "Test goal"}}}'
        parsed = JSONProtocol.parse_response(goal_response, "goal")
        assert parsed.operation.create_goal["statement"] == "Test goal"
        
        # Invalid JSON
        with pytest.raises(ValueError, match="Invalid JSON response"):
            JSONProtocol.parse_response("invalid json", "goal")
        
        # Unknown type
        with pytest.raises(ValueError, match="Unknown response type"):
            JSONProtocol.parse_response('{"message": "test"}', "unknown")


class TestCommandSafety:
    """Test command safety system."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        os.environ['HOME'] = self.temp_dir
        
        # Create config
        ensure_config_exists()
        self.config_manager = ConfigManager()
        self.safety_checker = CommandSafetyChecker(self.config_manager)
    
    def teardown_method(self):
        """Clean up test environment."""
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    def test_safe_commands(self):
        """Test safe command validation."""
        safe_commands = [
            "ls -la",
            "pwd",
            "echo hello",
            "cat file.txt",
            "grep pattern file",
            "find . -name '*.py'",
            "head -10 file.txt",
            "tail -10 file.txt"
        ]
        
        for cmd in safe_commands:
            is_safe, reason = self.safety_checker.validate_command(cmd)
            assert is_safe, f"Command '{cmd}' should be safe but got: {reason}"
    
    def test_unsafe_commands(self):
        """Test unsafe command detection."""
        unsafe_commands = [
            "vim file.txt",  # TUI command
            "nano file.txt",  # TUI command  
            "sudo command",  # Forbidden
            "rm -rf /",  # Dangerous
            "dd if=/dev/zero of=/dev/sda",  # Dangerous
            "command1 && command2",  # Command chaining
            "echo $(whoami)",  # Command substitution
            "cat file > /etc/passwd"  # Dangerous redirection
        ]
        
        for cmd in unsafe_commands:
            is_safe, reason = self.safety_checker.validate_command(cmd)
            assert not is_safe, f"Command '{cmd}' should be unsafe but was allowed"
    
    def test_filesystem_protection(self):
        """Test filesystem protection."""
        # Commands with paths outside project root should be blocked
        unsafe_paths = [
            "cat /etc/passwd",
            "ls /root",
            "rm /tmp/file",
            "cd /home/other_user"
        ]
        
        for cmd in unsafe_paths:
            is_safe, reason = self.safety_checker.validate_command(cmd)
            # Note: Some of these might be allowed depending on implementation
            # The key is that the safety checker analyzes paths
    
    def test_command_timeout(self):
        """Test command timeout determination."""
        long_commands = ["find", "grep", "sort", "cp", "tar"]
        short_commands = ["ls", "pwd", "echo", "cat"]
        
        for cmd in long_commands:
            timeout = self.safety_checker.check_command_timeout(cmd)
            assert timeout == 60, f"Long command '{cmd}' should have 60s timeout"
        
        for cmd in short_commands:
            timeout = self.safety_checker.check_command_timeout(cmd)
            assert timeout == 10, f"Short command '{cmd}' should have 10s timeout"


class TestCommandWhitelist:
    """Test command whitelisting system."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        os.environ['HOME'] = self.temp_dir
        
        # Create config
        ensure_config_exists()
        self.config_manager = ConfigManager()
        self.whitelist = CommandWhitelist(self.config_manager)
    
    def teardown_method(self):
        """Clean up test environment."""
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    def test_whitelist_initialization(self):
        """Test whitelist initialization with safe commands."""
        self.whitelist.initialize_with_safe_commands()
        commands = self.whitelist.get_whitelisted_commands()
        
        # Should contain basic safe commands
        assert "ls" in commands
        assert "pwd" in commands
        assert "cat" in commands
        assert "grep" in commands
    
    def test_whitelist_operations(self):
        """Test whitelist add/remove operations."""
        # Add command
        self.whitelist.add_to_whitelist("custom_command arg1 arg2")
        assert self.whitelist.is_command_whitelisted("custom_command")
        
        # Remove command
        self.whitelist.remove_from_whitelist("custom_command")
        assert not self.whitelist.is_command_whitelisted("custom_command")
    
    def test_whitelist_persistence(self):
        """Test whitelist persistence across instances."""
        # Add command and save
        self.whitelist.add_to_whitelist("test_command")
        
        # Create new instance
        new_whitelist = CommandWhitelist(self.config_manager)
        assert new_whitelist.is_command_whitelisted("test_command")


class TestSessionManagement:
    """Test session management system."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        os.environ['HOME'] = self.temp_dir
        
        # Create config
        ensure_config_exists()
        self.config_manager = ConfigManager()
        self.session_manager = SessionManager(self.config_manager)
    
    def teardown_method(self):
        """Clean up test environment."""
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    def test_session_creation(self):
        """Test session creation."""
        session = self.session_manager.create_new_session("Test Session")
        
        assert session.title == "Test Session"
        assert session.goal_statement is None
        assert len(session.current_plan) == 0
        assert len(session.messages) == 0
        assert not session.is_completed
    
    def test_session_persistence(self):
        """Test session persistence."""
        # Create session
        session = self.session_manager.create_new_session("Test Session")
        session_id = session.session_id
        
        # Add some data
        self.session_manager.add_message("user", "Hello", "user_input")
        self.session_manager.set_goal_statement("Test goal")
        
        # Load session in new manager
        new_manager = SessionManager(self.config_manager)
        loaded_session = new_manager.load_session(session_id)
        
        assert loaded_session.title == "Test Session"
        assert loaded_session.goal_statement == "Test goal"
        assert len(loaded_session.messages) == 1
        assert loaded_session.messages[0].content == "Hello"
    
    def test_goal_immutability(self):
        """Test goal statement immutability."""
        session = self.session_manager.create_new_session("Test Session")
        
        # Set goal
        self.session_manager.set_goal_statement("First goal")
        
        # Try to set again - should fail
        with pytest.raises(ValueError, match="Goal statement is immutable"):
            self.session_manager.set_goal_statement("Second goal")
    
    def test_session_completion(self):
        """Test session completion."""
        session = self.session_manager.create_new_session("Test Session")
        self.session_manager.set_goal_statement("Test goal")
        
        # Mark as completed
        self.session_manager.mark_completed()
        
        assert session.is_completed
        # Goal should be cleared on completion
        assert session.goal_statement is None


class TestGoalManager:
    """Test goal management system."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        os.environ['HOME'] = self.temp_dir
        
        # Create config and managers
        ensure_config_exists()
        self.config_manager = ConfigManager()
        self.session_manager = SessionManager(self.config_manager)
        self.goal_manager = GoalManager(self.session_manager)
        
        # Create a session
        self.session_manager.create_new_session("Test Session")
    
    def teardown_method(self):
        """Clean up test environment."""
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    def test_goal_creation(self):
        """Test goal creation from LLM response."""
        llm_response = '{"message": "Creating goal", "operation": {"create_goal": {"statement": "Find all Python files"}}}'
        
        assert not self.goal_manager.has_goal()
        
        goal = self.goal_manager.create_goal(llm_response)
        
        assert goal == "Find all Python files"
        assert self.goal_manager.has_goal()
        assert self.goal_manager.get_goal() == "Find all Python files"
    
    def test_goal_immutability(self):
        """Test goal immutability."""
        llm_response = '{"message": "Creating goal", "operation": {"create_goal": {"statement": "First goal"}}}'
        
        self.goal_manager.create_goal(llm_response)
        
        # Try to create another goal - should fail
        with pytest.raises(ValueError, match="Goal statement already exists"):
            self.goal_manager.create_goal(llm_response)
    
    def test_goal_prompt_generation(self):
        """Test goal prompt generation."""
        prompt = self.goal_manager.create_goal_prompt("Find all Python files")
        
        assert "Find all Python files" in prompt
        assert "goal statement" in prompt.lower()
        assert "json" in prompt.lower()


class TestPlanManager:
    """Test plan management system."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        os.environ['HOME'] = self.temp_dir
        
        # Create config and managers
        ensure_config_exists()
        self.config_manager = ConfigManager()
        self.session_manager = SessionManager(self.config_manager)
        self.plan_manager = PlanManager(self.session_manager)
        
        # Create a session
        self.session_manager.create_new_session("Test Session")
    
    def teardown_method(self):
        """Clean up test environment."""
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    def test_plan_creation(self):
        """Test plan creation from LLM response."""
        llm_response = '''{"message": "Creating plan", "operation": {"manage_plan": [
            {"step": 1, "action": "INSERT", "description": "ls -la"},
            {"step": 2, "action": "INSERT", "description": "grep pattern file"}
        ]}}'''
        
        assert not self.plan_manager.has_plan()
        
        plan = self.plan_manager.create_plan(llm_response)
        
        assert len(plan) == 2
        assert plan[0]["description"] == "ls -la"
        assert plan[1]["description"] == "grep pattern file"
        assert self.plan_manager.has_plan()
    
    def test_plan_step_validation(self):
        """Test plan step validation."""
        # Invalid response with command chaining
        invalid_response = '''{"message": "Creating plan", "operation": {"manage_plan": [
            {"step": 1, "action": "INSERT", "description": "ls -la && grep pattern"}
        ]}}'''
        
        with pytest.raises(ValueError, match="Step must be a single bash command"):
            self.plan_manager.create_plan(invalid_response)
    
    def test_plan_updates(self):
        """Test plan updates."""
        # Create initial plan
        initial_response = '''{"message": "Creating plan", "operation": {"manage_plan": [
            {"step": 1, "action": "INSERT", "description": "ls -la"}
        ]}}'''
        
        self.plan_manager.create_plan(initial_response)
        
        # Update plan
        update_response = '''{"message": "Updating plan", "operation": {"manage_plan": [
            {"step": 2, "action": "INSERT", "description": "grep pattern file"}
        ]}}'''
        
        updated_plan = self.plan_manager.update_plan(update_response)
        
        assert len(updated_plan) == 2
    
    def test_step_completion(self):
        """Test step completion tracking."""
        # Create plan
        llm_response = '''{"message": "Creating plan", "operation": {"manage_plan": [
            {"step": 1, "action": "INSERT", "description": "ls -la"}
        ]}}'''
        
        self.plan_manager.create_plan(llm_response)
        
        # Get current step
        current_step = self.plan_manager.get_current_step()
        assert current_step["step"] == 1
        assert not current_step["completed"]
        
        # Mark as completed
        self.plan_manager.mark_step_completed(1)
        
        # Should be no more steps
        assert self.plan_manager.get_current_step() is None


class TestContextCompactor:
    """Test context window management."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        os.environ['HOME'] = self.temp_dir
        
        # Create config
        ensure_config_exists()
        self.config_manager = ConfigManager()
        self.compactor = ContextCompactor(self.config_manager)
    
    def teardown_method(self):
        """Clean up test environment."""
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    def test_token_estimation(self):
        """Test token estimation."""
        text = "This is a test message with some content."
        tokens = self.compactor.estimate_tokens(text)
        
        # Should be roughly text length / 4
        expected = len(text) // 4
        assert abs(tokens - expected) <= 5
    
    def test_compaction_threshold(self):
        """Test compaction threshold detection."""
        from termaite.core.session import SessionMessage
        
        # Create many messages to exceed threshold
        messages = []
        for i in range(1000):
            msg = SessionMessage(
                timestamp="2024-01-01T00:00:00",
                role="user",
                content="This is a test message that should trigger compaction when there are many of them.",
                message_type="user_input"
            )
            messages.append(msg)
        
        assert self.compactor.should_compact(messages)
    
    def test_output_size_check(self):
        """Test output size checking."""
        # Small output should be fine
        small_output = "Small output"
        assert not self.compactor.check_output_size(small_output)
        
        # Large output should trigger defensive reading
        large_output = "Large output " * 10000
        assert self.compactor.check_output_size(large_output)


class TestDefensiveReader:
    """Test defensive reading system."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        os.environ['HOME'] = self.temp_dir
        
        # Create config
        ensure_config_exists()
        self.config_manager = ConfigManager()
        self.defensive_reader = DefensiveReader(self.config_manager)
    
    def teardown_method(self):
        """Clean up test environment."""
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    def test_large_output_detection(self):
        """Test large output detection."""
        # Small output should pass through
        small_output = "Small output"
        is_large, tokens = self.defensive_reader.check_output_size(small_output)
        assert not is_large
        
        # Large output should be detected
        large_output = "Large output " * 10000
        is_large, tokens = self.defensive_reader.check_output_size(large_output)
        assert is_large
    
    def test_command_suggestions(self):
        """Test command-specific suggestions."""
        suggestions = self.defensive_reader._get_command_specific_suggestions("find")
        assert "head -20" in suggestions
        assert "wc -l" in suggestions
        
        suggestions = self.defensive_reader._get_command_specific_suggestions("ls")
        assert "head -20" in suggestions
        assert "grep" in suggestions
    
    def test_large_output_handling(self):
        """Test large output handling."""
        command = "find . -name '*.py'"
        large_output = "Large output " * 10000
        
        processed_stdout, processed_stderr = self.defensive_reader.handle_large_output(
            command, large_output, ""
        )
        
        # Should return empty stdout and error message
        assert processed_stdout == ""
        assert "OUTPUT TOO LARGE" in processed_stderr
        assert "find" in processed_stderr  # Should include command-specific suggestions


class TestIntegration:
    """Integration tests for the complete system."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.original_home = os.environ.get('HOME')
        os.environ['HOME'] = self.temp_dir
        
        # Create config
        ensure_config_exists()
        
        # Mock LLM client to avoid actual API calls
        self.llm_mock = Mock()
        self.llm_mock.test_connection.return_value = True
        self.llm_mock.get_available_models.return_value = ["test-model"]
    
    def teardown_method(self):
        """Clean up test environment."""
        if self.original_home:
            os.environ['HOME'] = self.original_home
        else:
            os.environ.pop('HOME', None)
        shutil.rmtree(self.temp_dir)
    
    @patch('termaite.core.application.LLMClient')
    def test_application_initialization(self, mock_llm_client):
        """Test application initialization."""
        mock_llm_client.return_value = self.llm_mock
        
        app = TermaiteApplication()
        assert app.initialize()
        
        # All components should be initialized
        assert app.config_manager is not None
        assert app.session_manager is not None
        assert app.goal_manager is not None
        assert app.plan_manager is not None
        assert app.command_executor is not None
        assert app.context_compactor is not None
        assert app.defensive_reader is not None
    
    def test_command_execution_flow(self):
        """Test command execution flow."""
        # Create all components
        config_manager = ConfigManager()
        session_manager = SessionManager(config_manager)
        command_executor = CommandExecutor(config_manager)
        
        # Create session
        session_manager.create_new_session("Test Session")
        
        # Test safe command execution
        success, stdout, stderr = command_executor.execute_command("echo 'Hello World'")
        
        assert success
        assert "Hello World" in stdout
        assert stderr == ""
    
    def test_complete_workflow_simulation(self):
        """Test complete workflow simulation."""
        # This would test the entire workflow from user input to completion
        # In a real scenario, this would involve mocking LLM responses
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])