"""Basic functionality tests to ensure core imports and classes work."""

import pytest


def test_imports():
    """Test that core modules can be imported."""
    # Test core imports
    from termaite.core.application import (
        TermAIte,
        InteractiveSession,
        create_application,
    )
    from termaite.cli import main, create_parser
    from termaite.utils.logging import Logger
    from termaite import __version__

    # Verify basic functionality
    assert __version__ is not None
    assert callable(create_application)
    assert callable(main)
    assert callable(create_parser)


def test_interactive_session_basic():
    """Test basic InteractiveSession functionality."""
    from termaite.core.application import InteractiveSession

    session = InteractiveSession()
    assert hasattr(session, "add_interaction")
    assert hasattr(session, "get_context_summary")
    assert hasattr(session, "get_stats")

    # Test adding an interaction
    session.add_interaction("test", "response", None, True)
    stats = session.get_stats()
    assert stats["total_interactions"] == 1


def test_logger_basic():
    """Test basic Logger functionality."""
    from termaite.utils.logging import Logger

    logger = Logger()
    assert hasattr(logger, "system")
    assert hasattr(logger, "error")
    assert hasattr(logger, "debug")
    assert hasattr(logger, "set_debug")

    # Test debug setting
    logger.set_debug(True)
    assert logger.debug_enabled is True


def test_constants_import():
    """Test that constants can be imported."""
    from termaite.constants import (
        CLR_RESET,
        CLR_GREEN,
        CLR_RED,
        CONFIG_DIR,
        CONFIG_FILE,
    )

    assert isinstance(CLR_RESET, str)
    assert isinstance(CLR_GREEN, str)
    assert CONFIG_DIR is not None


def test_version_info():
    """Test version information."""
    from termaite import __version__, __author__

    assert isinstance(__version__, str)
    assert len(__version__) > 0
    assert isinstance(__author__, str)


def test_package_structure():
    """Test that package structure is intact."""
    import termaite
    import termaite.core
    import termaite.cli
    import termaite.utils
    import termaite.config
    import termaite.commands
    import termaite.llm

    # Verify modules have expected attributes
    assert hasattr(termaite.core, "application")
    assert hasattr(termaite.utils, "logging")
    assert hasattr(termaite.config, "manager")


if __name__ == "__main__":
    # Allow running this test file directly
    pytest.main([__file__])
