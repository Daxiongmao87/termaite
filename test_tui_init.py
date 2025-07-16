#!/usr/bin/env python3
"""
Test the TUI /init command.
"""

import os
import sys
from pathlib import Path

# Add the project root to the path
sys.path.insert(0, os.path.abspath('.'))

def test_tui_init_command():
    """Test the TUI /init command."""
    from termaite.tui.builtin_commands import BuiltinCommandHandler
    from termaite.core.application import TermaiteApplication
    
    print("Testing TUI /init command...")
    
    # Create application and command handler
    app = TermaiteApplication()
    handler = BuiltinCommandHandler(app)
    
    # Capture output
    output_messages = []
    def capture_output(message, msg_type):
        output_messages.append((message, msg_type))
    
    # Remove existing .TERMAITE.md if it exists
    termaite_file = Path('.TERMAITE.md')
    if termaite_file.exists():
        termaite_file.unlink()
    
    # Run the init command
    handler.run_project_init(capture_output)
    
    # Check results
    success = False
    for message, msg_type in output_messages:
        print(f"[{msg_type.upper()}] {message}")
        if "completed!" in message and msg_type == "success":
            success = True
    
    if success:
        print("✅ TUI /init command succeeded")
        
        # Check if file was created
        if termaite_file.exists():
            print("✅ .TERMAITE.md file created by TUI command")
            
            # Check file content
            content = termaite_file.read_text()
            if "Term.Ai.Te Project" in content:
                print("✅ File contains expected project name")
            else:
                print("❌ File doesn't contain expected project name")
                
        else:
            print("❌ .TERMAITE.md file was not created")
    else:
        print("❌ TUI /init command failed")
        
    return success

def main():
    """Run TUI init test."""
    print("Testing Termaite TUI /init Command")
    print("=" * 40)
    
    try:
        if test_tui_init_command():
            print("\n🎉 TUI /init command test passed!")
            return 0
        else:
            print("\n❌ TUI /init command test failed.")
            return 1
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())