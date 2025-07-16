"""
Main entry point for the termaite application.
"""

import sys
import argparse


def main():
    """Main entry point for the termaite application."""
    parser = argparse.ArgumentParser(description="Termaite - Terminal Agent")
    parser.add_argument("--cli", action="store_true", help="Use CLI interface instead of TUI")
    parser.add_argument("--init", action="store_true", help="Initialize configuration")
    args = parser.parse_args()
    
    try:
        if args.init:
            # Run project initialization
            from .core.project_init import ProjectInitializer
            from .config.manager import ConfigManager
            
            config_manager = ConfigManager()
            initializer = ProjectInitializer(config_manager)
            success = initializer.initialize_project()
            
            if success:
                print("\n🎉 Project initialization completed!")
                print("💡 The .TERMAITE.md file provides context for AI assistance.")
                print("🚀 You can now run 'termaite' to start the terminal agent.")
            else:
                print("\n❌ Project initialization failed.")
                sys.exit(1)
        elif args.cli:
            # Use CLI interface
            from .core.application import TermaiteApplication
            app = TermaiteApplication()
            app.run()
        else:
            # Use TUI interface (default)
            from .tui.main import main as tui_main
            tui_main()
            
    except KeyboardInterrupt:
        print("\n\nGoodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()