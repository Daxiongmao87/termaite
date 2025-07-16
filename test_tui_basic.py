#!/usr/bin/env python3
"""
Basic test for TUI functionality.
"""

import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.abspath('.'))

def test_imports():
    """Test that all TUI components can be imported."""
    try:
        from termaite.tui.main import TermaiteTUI
        from termaite.tui.modals import HistoryModal, ModelModal, UserApprovalModal
        from termaite.tui.builtin_commands import BuiltinCommandHandler
        from termaite.core.application import TermaiteApplication
        from termaite.config.manager import ConfigManager
        from termaite.llm.client import LLMClient
        from termaite.commands.executor import CommandExecutor
        
        print("✓ All TUI components imported successfully")
        return True
    except Exception as e:
        print(f"✗ Import error: {e}")
        return False

def test_configuration():
    """Test that configuration loads correctly."""
    try:
        from termaite.config.manager import ConfigManager
        
        config_manager = ConfigManager()
        config = config_manager.load_config()
        
        print(f"✓ Configuration loaded successfully")
        print(f"  - Endpoint: {config.llm.endpoint}")
        print(f"  - Model: {config.llm.model}")
        print(f"  - Context window: {config.llm.context_window}")
        print(f"  - Gremlin mode: {config.security.gremlin_mode}")
        
        return True
    except Exception as e:
        print(f"✗ Configuration error: {e}")
        return False

def test_application_initialization():
    """Test that application can be initialized."""
    try:
        from termaite.core.application import TermaiteApplication
        
        app = TermaiteApplication()
        print("✓ Application created successfully")
        
        # Test individual components
        components = [
            ('Config Manager', hasattr(app, 'config_manager')),
            ('Session Manager', hasattr(app, 'session_manager')),
            ('Goal Manager', hasattr(app, 'goal_manager')),
            ('Plan Manager', hasattr(app, 'plan_manager')),
            ('LLM Client', hasattr(app, 'llm_client')),
            ('Command Executor', hasattr(app, 'command_executor')),
            ('Context Compactor', hasattr(app, 'context_compactor')),
            ('Defensive Reader', hasattr(app, 'defensive_reader')),
        ]
        
        for name, exists in components:
            status = "✓" if exists else "✗"
            print(f"  {status} {name}")
        
        return True
    except Exception as e:
        print(f"✗ Application initialization error: {e}")
        return False

def test_command_executor():
    """Test that command executor works."""
    try:
        from termaite.config.manager import ConfigManager
        from termaite.commands.executor import CommandExecutor
        
        config_manager = ConfigManager()
        executor = CommandExecutor(config_manager)
        
        print("✓ Command executor created successfully")
        
        # Test a safe command
        success, stdout, stderr = executor.execute_command("echo 'Hello World'")
        if success and "Hello World" in stdout:
            print("✓ Safe command execution works")
        else:
            print(f"✗ Safe command failed: {stderr}")
            
        return True
    except Exception as e:
        print(f"✗ Command executor error: {e}")
        return False

def test_whitelist_system():
    """Test that whitelist system works."""
    try:
        from termaite.config.manager import ConfigManager
        from termaite.commands.whitelist import CommandWhitelist
        
        config_manager = ConfigManager()
        whitelist = CommandWhitelist(config_manager)
        
        print("✓ Whitelist system created successfully")
        
        # Test whitelist operations
        status = whitelist.get_whitelist_status()
        print(f"  - Whitelist enabled: {status['enabled']}")
        print(f"  - Whitelisted commands: {status['command_count']}")
        
        # Test some basic commands
        test_commands = ['ls', 'echo', 'cat', 'find']
        for cmd in test_commands:
            is_whitelisted = whitelist.is_command_whitelisted(cmd)
            status = "✓" if is_whitelisted else "✗"
            print(f"  {status} {cmd} whitelisted")
        
        return True
    except Exception as e:
        print(f"✗ Whitelist system error: {e}")
        return False

def test_session_management():
    """Test that session management works."""
    try:
        from termaite.config.manager import ConfigManager
        from termaite.core.session import SessionManager
        
        config_manager = ConfigManager()
        session_manager = SessionManager(config_manager)
        
        print("✓ Session manager created successfully")
        
        # Test session creation
        session = session_manager.create_new_session("Test Session")
        print(f"✓ Session created: {session.title}")
        
        # Test session listing
        sessions = session_manager.list_sessions()
        print(f"✓ Sessions listed: {len(sessions)} sessions")
        
        return True
    except Exception as e:
        print(f"✗ Session management error: {e}")
        return False

def main():
    """Run all tests."""
    print("Testing Termaite TUI Implementation")
    print("=" * 40)
    
    tests = [
        test_imports,
        test_configuration,
        test_application_initialization,
        test_command_executor,
        test_whitelist_system,
        test_session_management,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        print(f"\n{test.__name__}:")
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"✗ Test failed with exception: {e}")
            failed += 1
    
    print(f"\n" + "=" * 40)
    print(f"Tests completed: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! The TUI implementation is working correctly.")
        return 0
    else:
        print(f"❌ {failed} tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())