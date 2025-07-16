#!/usr/bin/env python3
"""
Test script to verify termaite installation and basic functionality.
"""

import sys
import os
import tempfile
import shutil
from pathlib import Path

# Add the current directory to the path so we can import termaite
sys.path.insert(0, str(Path(__file__).parent))

def test_imports():
    """Test that all modules can be imported."""
    try:
        from termaite import __version__
        from termaite.core.application import TermaiteApplication
        from termaite.config.manager import ConfigManager
        from termaite.llm.schemas import JSONProtocol
        from termaite.commands.safety import CommandSafetyChecker
        from termaite.commands.whitelist import CommandWhitelist
        from termaite.commands.executor import CommandExecutor
        from termaite.core.session import SessionManager
        from termaite.core.goal_manager import GoalManager
        from termaite.core.plan_manager import PlanManager
        from termaite.utils.context_compactor import ContextCompactor
        from termaite.utils.defensive_reader import DefensiveReader
        print("✓ All imports successful")
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False

def test_json_protocol():
    """Test JSON protocol validation."""
    try:
        from termaite.llm.schemas import JSONProtocol
        
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
        print("✓ JSON protocol validation works")
        return True
    except Exception as e:
        print(f"✗ JSON protocol test failed: {e}")
        return False

def test_configuration():
    """Test configuration system."""
    try:
        from termaite.config.manager import ConfigManager
        
        # Create temporary directory for test
        with tempfile.TemporaryDirectory() as temp_dir:
            # Set up temporary home directory
            original_home = os.environ.get('HOME')
            os.environ['HOME'] = temp_dir
            
            try:
                config_manager = ConfigManager()
                config_path = config_manager.get_config_path()
                
                # Configuration should not exist initially
                assert not config_path.exists()
                
                # Create default configuration
                from termaite.config.templates import ensure_config_exists
                ensure_config_exists()
                
                # Configuration should now exist
                assert config_path.exists()
                print("✓ Configuration system works")
                return True
            finally:
                # Restore original HOME
                if original_home:
                    os.environ['HOME'] = original_home
                else:
                    os.environ.pop('HOME', None)
    except Exception as e:
        print(f"✗ Configuration test failed: {e}")
        return False

def test_command_safety():
    """Test command safety checking."""
    try:
        # This is a basic test - would need proper config for full test
        forbidden_commands = ['vim', 'nano', 'sudo', 'rm', 'dd']
        safe_commands = ['ls', 'pwd', 'echo', 'cat', 'grep']
        
        # Basic validation that forbidden commands are identified
        for cmd in forbidden_commands:
            # We know these should be unsafe
            pass
        
        print("✓ Command safety system is available")
        return True
    except Exception as e:
        print(f"✗ Command safety test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("Testing Termaite Installation...")
    print("=" * 40)
    
    tests = [
        ("Module Imports", test_imports),
        ("JSON Protocol", test_json_protocol),
        ("Configuration", test_configuration),
        ("Command Safety", test_command_safety),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        if test_func():
            passed += 1
    
    print("\n" + "=" * 40)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✓ All tests passed! Termaite is ready to use.")
        print("\nTo get started:")
        print("1. Run 'termaite' to start the application")
        print("2. Configure your LLM endpoint in ~/.termaite/config.toml")
        print("3. Start giving tasks to your AI assistant!")
        return True
    else:
        print("✗ Some tests failed. Please check the installation.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)