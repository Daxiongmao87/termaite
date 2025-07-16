"""
Core functionality tests for Termaite - simpler and more focused.
"""

import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import Mock, patch
from termaite.config.manager import ConfigManager, Config, LLMConfig, SecurityConfig, SessionConfig, WhitelistConfig, ContextConfig
from termaite.llm.schemas import JSONProtocol
from termaite.commands.safety import CommandSafetyChecker


class TestCoreJSONProtocol:
    """Test core JSON protocol functionality."""
    
    def test_goal_response_validation(self):
        """Test goal response validation."""
        valid_response = '''
        {
            "message": "Creating goal statement",
            "operation": {
                "create_goal": {
                    "statement": "Test goal statement"
                }
            }
        }
        '''
        
        parsed = JSONProtocol.parse_response(valid_response, "goal")
        assert parsed.message == "Creating goal statement"
        assert parsed.operation.create_goal["statement"] == "Test goal statement"
    
    def test_task_status_validation(self):
        """Test task status validation."""
        valid_response = '''
        {
            "message": "Task is in progress",
            "operation": {
                "determine_task_status": "IN_PROGRESS"
            }
        }
        '''
        
        parsed = JSONProtocol.parse_response(valid_response, "task_status")
        assert parsed.operation.determine_task_status == "IN_PROGRESS"
        
        # Test invalid status
        invalid_response = '''
        {
            "message": "Test message",
            "operation": {
                "determine_task_status": "INVALID_STATUS"
            }
        }
        '''
        
        with pytest.raises(ValueError, match="Invalid task status"):
            JSONProtocol.parse_response(invalid_response, "task_status")
    
    def test_bash_command_validation(self):
        """Test bash command validation."""
        valid_response = '''
        {
            "message": "Executing command",
            "operation": {
                "invoke_bash_command": {
                    "command": "ls -la"
                }
            }
        }
        '''
        
        parsed = JSONProtocol.parse_response(valid_response, "bash")
        assert parsed.operation.invoke_bash_command["command"] == "ls -la"
    
    def test_invalid_json_handling(self):
        """Test invalid JSON handling."""
        invalid_json = "{ invalid json"
        
        with pytest.raises(ValueError, match="Invalid JSON"):
            JSONProtocol.parse_response(invalid_json, "goal")


class TestCoreSafetyFeatures:
    """Test core safety features."""
    
    @pytest.fixture
    def safety_checker(self):
        """Create safety checker with minimal config."""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = Config(
                llm=LLMConfig(
                    endpoint="http://localhost:11434/v1",
                    context_window=4096,
                    model="test-model"
                ),
                security=SecurityConfig(
                    gremlin_mode=False,
                    project_root=temp_dir
                ),
                session=SessionConfig(
                    history_dir=os.path.join(temp_dir, "sessions"),
                    max_sessions=100
                ),
                whitelist=WhitelistConfig(
                    enabled=True,
                    file=os.path.join(temp_dir, "whitelist.json")
                ),
                context=ContextConfig(
                    compaction_threshold=0.75,
                    compaction_ratio=0.5,
                    max_output_ratio=0.5
                )
            )
            
            config_manager = ConfigManager()
            config_manager._config = config
            
            yield CommandSafetyChecker(config_manager)
    
    def test_safe_commands_allowed(self, safety_checker):
        """Test that safe commands are allowed."""
        safe_commands = [
            "ls -la",
            "find . -name '*.py'",
            "cat file.txt",
            "grep 'pattern' file.txt",
            "pwd",
            "whoami",
        ]
        
        for cmd in safe_commands:
            valid, reason = safety_checker.validate_command(cmd)
            assert valid, f"Safe command rejected: {cmd} - {reason}"
    
    def test_dangerous_commands_blocked(self, safety_checker):
        """Test that dangerous commands are blocked."""
        dangerous_commands = [
            "rm -rf /",
            "sudo ls",
            "vim file.txt",
            "nano file.txt",
            "ls && rm file.txt",
            "echo $(whoami)",
        ]
        
        for cmd in dangerous_commands:
            valid, reason = safety_checker.validate_command(cmd)
            assert not valid, f"Dangerous command allowed: {cmd}"
    
    def test_path_traversal_blocked(self, safety_checker):
        """Test basic path traversal blocking."""
        traversal_commands = [
            "cat ../../../etc/passwd",
            "ls ../../../../",
        ]
        
        for cmd in traversal_commands:
            valid, reason = safety_checker.validate_command(cmd)
            assert not valid, f"Path traversal not blocked: {cmd}"
    
    def test_command_chaining_blocked(self, safety_checker):
        """Test command chaining prevention."""
        chaining_commands = [
            "ls && echo done",
            "cat file.txt || echo failed",
            "ls; rm file.txt",
        ]
        
        for cmd in chaining_commands:
            valid, reason = safety_checker.validate_command(cmd)
            assert not valid, f"Command chaining not blocked: {cmd}"


class TestCoreConfigurationFeatures:
    """Test core configuration features."""
    
    def test_config_creation(self):
        """Test configuration object creation."""
        config = Config(
            llm=LLMConfig(
                endpoint="http://localhost:11434/v1",
                context_window=4096,
                model="test-model"
            ),
            security=SecurityConfig(
                gremlin_mode=False,
                project_root="/tmp/test"
            ),
            session=SessionConfig(
                history_dir="/tmp/sessions",
                max_sessions=100
            ),
            whitelist=WhitelistConfig(
                enabled=True,
                file="/tmp/whitelist.json"
            ),
            context=ContextConfig(
                compaction_threshold=0.75,
                compaction_ratio=0.5,
                max_output_ratio=0.5
            )
        )
        
        assert config.llm.endpoint == "http://localhost:11434/v1"
        assert config.llm.context_window == 4096
        assert config.llm.model == "test-model"
        assert config.security.gremlin_mode is False
        assert config.context.compaction_threshold == 0.75
    
    def test_config_manager_initialization(self):
        """Test config manager initialization."""
        config_manager = ConfigManager()
        assert config_manager is not None
        
        # Should be able to create a config manager without errors
        assert hasattr(config_manager, 'load_config')
        assert hasattr(config_manager, 'save_config')


class TestCoreApplicationImports:
    """Test that core application components can be imported."""
    
    def test_main_application_import(self):
        """Test main application import."""
        from termaite.core.application import TermaiteApplication
        app = TermaiteApplication()
        assert app is not None
        assert hasattr(app, 'initialize')
        assert hasattr(app, 'run')
    
    def test_core_managers_import(self):
        """Test core managers import."""
        from termaite.core.goal_manager import GoalManager
        from termaite.core.plan_manager import PlanManager
        from termaite.core.session import SessionManager
        
        # Should be able to import without errors
        assert GoalManager is not None
        assert PlanManager is not None
        assert SessionManager is not None
    
    def test_tui_components_import(self):
        """Test TUI components import."""
        from termaite.tui.chatbox import ChatboxTUI
        from termaite.tui.modals import ModelModal, HistoryModal
        
        # Should be able to import without errors
        assert ChatboxTUI is not None
        assert ModelModal is not None
        assert HistoryModal is not None
    
    def test_llm_components_import(self):
        """Test LLM components import."""
        from termaite.llm.client import LLMClient
        from termaite.llm.schemas import JSONProtocol
        
        # Should be able to import without errors
        assert LLMClient is not None
        assert JSONProtocol is not None
    
    def test_utils_import(self):
        """Test utility components import."""
        from termaite.utils.context_compactor import ContextCompactor
        from termaite.utils.defensive_reader import DefensiveReader
        
        # Should be able to import without errors
        assert ContextCompactor is not None
        assert DefensiveReader is not None


class TestProjectInitializationCore:
    """Test core project initialization functionality."""
    
    def test_project_discovery_import(self):
        """Test project discovery import."""
        from termaite.core.project_init import ProjectDiscovery, ContextGenerator, ProjectInitializer
        
        # Should be able to import without errors
        assert ProjectDiscovery is not None
        assert ContextGenerator is not None
        assert ProjectInitializer is not None
    
    def test_basic_project_detection(self):
        """Test basic project type detection."""
        from termaite.core.project_init import ProjectDiscovery
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a simple Python project
            (Path(temp_dir) / "requirements.txt").write_text("flask==2.0.1")
            (Path(temp_dir) / "app.py").write_text("from flask import Flask")
            
            discovery = ProjectDiscovery(temp_dir)
            project_info = discovery.discover_project()
            
            assert project_info.project_type == "python"
            assert project_info.language == "python"
            assert "requirements.txt" in project_info.key_files


if __name__ == "__main__":
    pytest.main([__file__])