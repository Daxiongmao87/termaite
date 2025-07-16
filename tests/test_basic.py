"""
Basic tests for termaite functionality.
"""

import pytest
import json
from termaite.config.manager import ConfigManager
from termaite.llm.schemas import JSONProtocol
from termaite.commands.safety import CommandSafetyChecker
from termaite.commands.whitelist import CommandWhitelist


class TestJSONProtocol:
    """Test JSON protocol validation."""
    
    def test_valid_goal_response(self):
        """Test valid goal response parsing."""
        response = {
            "message": "Creating goal statement",
            "operation": {
                "create_goal": {
                    "statement": "Find all Python files"
                }
            }
        }
        
        parsed = JSONProtocol.validate_goal_response(response)
        assert parsed.message == "Creating goal statement"
        assert parsed.operation.create_goal["statement"] == "Find all Python files"
    
    def test_invalid_goal_response(self):
        """Test invalid goal response parsing."""
        response = {
            "message": "Creating goal statement"
            # Missing operation
        }
        
        with pytest.raises(ValueError, match="Missing 'operation' field"):
            JSONProtocol.validate_goal_response(response)
    
    def test_valid_bash_response(self):
        """Test valid bash response parsing."""
        response = {
            "message": "Executing command",
            "operation": {
                "invoke_bash_command": {
                    "command": "ls -la"
                }
            }
        }
        
        parsed = JSONProtocol.validate_bash_response(response)
        assert parsed.message == "Executing command"
        assert parsed.operation.invoke_bash_command["command"] == "ls -la"


class TestCommandSafety:
    """Test command safety validation."""
    
    def test_safe_command(self):
        """Test safe command validation."""
        # Note: This would require a proper config, so we'll create a mock
        # In a real test, you'd set up proper configuration
        pass
    
    def test_dangerous_command(self):
        """Test dangerous command rejection."""
        # Note: This would require proper setup
        pass


class TestConfiguration:
    """Test configuration management."""
    
    def test_config_template_creation(self):
        """Test configuration template creation."""
        # Note: This would require proper setup
        pass


def test_application_import():
    """Test that the main application can be imported."""
    from termaite.core.application import TermaiteApplication
    app = TermaiteApplication()
    assert app is not None


def test_main_module_import():
    """Test that the main module can be imported."""
    from termaite.__main__ import main
    assert main is not None


if __name__ == "__main__":
    pytest.main([__file__])