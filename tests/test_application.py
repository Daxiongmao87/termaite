"""Tests for the main application functionality."""

import pytest
from unittest.mock import Mock, patch
from termaite.core.application import TermAIte, InteractiveSession, create_application


class TestInteractiveSession:
    """Test the InteractiveSession class."""

    def test_initialization(self):
        """Test session initialization."""
        session = InteractiveSession()
        assert session.conversation_history == []
        assert session.command_count == 0
        assert session.session_start_time > 0

    def test_add_interaction(self):
        """Test adding interactions to session."""
        session = InteractiveSession()
        session.add_interaction("test prompt", "test response", "ls", True)

        assert len(session.conversation_history) == 1
        interaction = session.conversation_history[0]
        assert interaction["user_prompt"] == "test prompt"
        assert interaction["ai_response"] == "test response"
        assert interaction["command_executed"] == "ls"
        assert interaction["success"] is True

    def test_conversation_history_limit(self):
        """Test that conversation history is limited to 10 entries."""
        session = InteractiveSession()

        # Add 15 interactions
        for i in range(15):
            session.add_interaction(f"prompt {i}", f"response {i}", None, True)

        # Should only keep the last 10
        assert len(session.conversation_history) == 10
        assert session.conversation_history[0]["user_prompt"] == "prompt 5"
        assert session.conversation_history[-1]["user_prompt"] == "prompt 14"

    def test_get_context_summary_empty(self):
        """Test context summary with no history."""
        session = InteractiveSession()
        summary = session.get_context_summary()
        assert "No previous interactions" in summary

    def test_get_context_summary_with_history(self):
        """Test context summary with interaction history."""
        session = InteractiveSession()
        session.add_interaction("first prompt", "first response", "ls", True)
        session.add_interaction("second prompt", "second response", None, False)

        summary = session.get_context_summary()
        assert "Recent conversation context:" in summary
        assert "first prompt" in summary
        assert "second prompt" in summary

    def test_get_stats(self):
        """Test session statistics."""
        session = InteractiveSession()
        session.add_interaction("prompt1", "response1", "ls", True)
        session.add_interaction("prompt2", "response2", None, False)
        session.add_interaction("prompt3", "response3", "pwd", True)

        stats = session.get_stats()
        assert stats["total_interactions"] == 3
        assert stats["successful_interactions"] == 2
        assert stats["commands_executed"] == 2
        assert stats["session_duration"] > 0


class TestTermAIte:
    """Test the main TermAIte application class."""

    @patch("termaite.core.application.create_config_manager")
    @patch("termaite.core.application.create_task_handler")
    @patch("termaite.core.application.create_simple_handler")
    @patch("termaite.core.application.check_dependencies")
    def test_initialization(
        self,
        mock_check_deps,
        mock_simple_handler,
        mock_task_handler,
        mock_config_manager,
    ):
        """Test application initialization."""
        # Setup mocks
        mock_config_manager.return_value.config = {"enable_debug": False}
        mock_config_manager.return_value.get_command_maps.return_value = ({}, {})

        app = TermAIte()

        assert app._interactive_session is None
        mock_check_deps.assert_called_once()
        mock_config_manager.assert_called_once()

    @patch("termaite.core.application.create_config_manager")
    @patch("termaite.core.application.create_task_handler")
    @patch("termaite.core.application.create_simple_handler")
    @patch("termaite.core.application.check_dependencies")
    def test_handle_meta_command_help(
        self,
        mock_check_deps,
        mock_simple_handler,
        mock_task_handler,
        mock_config_manager,
    ):
        """Test /help meta command."""
        # Setup mocks
        mock_config_manager.return_value.config = {"enable_debug": False}
        mock_config_manager.return_value.get_command_maps.return_value = ({}, {})

        app = TermAIte()
        app._interactive_session = InteractiveSession()

        result = app._handle_meta_command("/help")
        assert result is True

    @patch("termaite.core.application.create_config_manager")
    @patch("termaite.core.application.create_task_handler")
    @patch("termaite.core.application.create_simple_handler")
    @patch("termaite.core.application.check_dependencies")
    def test_handle_meta_command_exit(
        self,
        mock_check_deps,
        mock_simple_handler,
        mock_task_handler,
        mock_config_manager,
    ):
        """Test /exit meta command."""
        # Setup mocks
        mock_config_manager.return_value.config = {"enable_debug": False}
        mock_config_manager.return_value.get_command_maps.return_value = ({}, {})

        app = TermAIte()
        app._interactive_session = InteractiveSession()

        result = app._handle_meta_command("/exit")
        assert result is False

    @patch("termaite.core.application.create_config_manager")
    @patch("termaite.core.application.create_task_handler")
    @patch("termaite.core.application.create_simple_handler")
    @patch("termaite.core.application.check_dependencies")
    def test_handle_meta_command_stats(
        self,
        mock_check_deps,
        mock_simple_handler,
        mock_task_handler,
        mock_config_manager,
    ):
        """Test /stats meta command."""
        # Setup mocks
        mock_config_manager.return_value.config = {"enable_debug": False}
        mock_config_manager.return_value.get_command_maps.return_value = ({}, {})

        app = TermAIte()
        app._interactive_session = InteractiveSession()
        app._interactive_session.add_interaction("test", "response", None, True)

        result = app._handle_meta_command("/stats")
        assert result is True

    @patch("termaite.core.application.create_config_manager")
    @patch("termaite.core.application.create_task_handler")
    @patch("termaite.core.application.create_simple_handler")
    @patch("termaite.core.application.check_dependencies")
    def test_handle_meta_command_unknown(
        self,
        mock_check_deps,
        mock_simple_handler,
        mock_task_handler,
        mock_config_manager,
    ):
        """Test unknown meta command."""
        # Setup mocks
        mock_config_manager.return_value.config = {"enable_debug": False}
        mock_config_manager.return_value.get_command_maps.return_value = ({}, {})

        app = TermAIte()
        app._interactive_session = InteractiveSession()

        result = app._handle_meta_command("/unknown")
        assert result is True


class TestApplicationFactory:
    """Test the application factory function."""

    @patch("termaite.core.application.TermAIte")
    def test_create_application(self, mock_termaite):
        """Test application creation function."""
        mock_instance = Mock()
        mock_termaite.return_value = mock_instance

        result = create_application(
            config_dir="/test/config", debug=True, initial_working_directory="/test/dir"
        )

        assert result == mock_instance
        mock_termaite.assert_called_once_with("/test/config", True, "/test/dir")
