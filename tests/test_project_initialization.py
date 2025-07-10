"""Tests for project initialization functionality."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil
import os

from termaite.core.application import TermAIte, create_application
from termaite.llm.payload import PayloadBuilder


class TestProjectInitialization:
    """Test the project initialization feature."""

    def setup_method(self):
        """Set up test environment."""
        # Create a temporary directory for testing
        self.test_dir = Path(tempfile.mkdtemp())
        self.termaite_dir = self.test_dir / ".termaite"

    def teardown_method(self):
        """Clean up test environment."""
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir)

    @patch("termaite.core.application.create_config_manager")
    @patch("termaite.core.application.create_task_handler")
    @patch("termaite.core.application.create_simple_handler")
    @patch("termaite.core.application.check_dependencies")
    def test_show_init_tip_if_needed_no_termaite_dir(
        self,
        mock_check_deps,
        mock_simple_handler,
        mock_task_handler,
        mock_config_manager,
    ):
        """Test that init tip is shown when no .termaite directory exists."""
        # Setup mocks
        mock_config_manager.return_value.config = {"enable_debug": False}
        mock_config_manager.return_value.get_command_maps.return_value = ({}, {})

        app = TermAIte(initial_working_directory=str(self.test_dir))

        # The tip should be shown since no .termaite directory exists
        with patch("termaite.utils.logging.logger.system") as mock_logger:
            app._show_init_tip_if_needed()

            # Verify that tip messages were logged
            mock_logger.assert_any_call("💡 Tip: You're in a new project directory!")
            mock_logger.assert_any_call(
                "   Consider running '/init' to let the AI agents investigate"
            )

    @patch("termaite.core.application.create_config_manager")
    @patch("termaite.core.application.create_task_handler")
    @patch("termaite.core.application.create_simple_handler")
    @patch("termaite.core.application.check_dependencies")
    def test_show_init_tip_if_needed_with_termaite_dir(
        self,
        mock_check_deps,
        mock_simple_handler,
        mock_task_handler,
        mock_config_manager,
    ):
        """Test that init tip is NOT shown when .termaite directory exists."""
        # Setup mocks
        mock_config_manager.return_value.config = {"enable_debug": False}
        mock_config_manager.return_value.get_command_maps.return_value = ({}, {})

        # Create .termaite directory
        self.termaite_dir.mkdir()

        app = TermAIte(initial_working_directory=str(self.test_dir))

        # The tip should NOT be shown since .termaite directory exists
        with patch("termaite.utils.logging.logger.system") as mock_logger:
            app._show_init_tip_if_needed()

            # Verify that no tip messages were logged
            tip_calls = [
                call for call in mock_logger.call_args_list if "💡 Tip:" in str(call)
            ]
            assert len(tip_calls) == 0

    @patch("termaite.core.application.create_config_manager")
    @patch("termaite.core.application.create_task_handler")
    @patch("termaite.core.application.create_simple_handler")
    @patch("termaite.core.application.check_dependencies")
    def test_initialize_project_prompts_creates_directory(
        self,
        mock_check_deps,
        mock_simple_handler,
        mock_task_handler,
        mock_config_manager,
    ):
        """Test that initialize_project_prompts creates .termaite directory."""
        # Setup mocks
        mock_config_manager.return_value.config = {
            "enable_debug": False,
            "plan_prompt": "test planner prompt",
            "action_prompt": "test actor prompt",
            "evaluate_prompt": "test evaluator prompt",
        }
        mock_config_manager.return_value.get_command_maps.return_value = ({}, {})

        app = TermAIte(initial_working_directory=str(self.test_dir))

        # Mock the handle_task method to return True
        app.handle_task = Mock(return_value=True)

        # Call initialize_project_prompts
        result = app.initialize_project_prompts()

        # Verify that the .termaite directory was created
        assert self.termaite_dir.exists()
        assert self.termaite_dir.is_dir()
        assert result is True

    def test_create_project_investigation_prompt(self):
        """Test the project investigation prompt creation."""
        with patch("termaite.core.application.create_config_manager") as mock_config:
            mock_config.return_value.config = {"enable_debug": False}
            mock_config.return_value.get_command_maps.return_value = ({}, {})

            app = TermAIte(initial_working_directory=str(self.test_dir))
            prompt = app._create_project_investigation_prompt()

            # Verify prompt contains key elements
            assert "investigate this project directory" in prompt.lower()
            assert str(self.test_dir) in prompt
            assert "directory structure" in prompt.lower()
            assert "file types" in prompt.lower()

    def test_create_agent_customization_prompt(self):
        """Test the agent customization prompt creation."""
        with patch("termaite.core.application.create_config_manager") as mock_config:
            mock_config.return_value.config = {"enable_debug": False}
            mock_config.return_value.get_command_maps.return_value = ({}, {})

            app = TermAIte(initial_working_directory=str(self.test_dir))

            current_prompt = "This is the current planner prompt"
            prompt = app._create_agent_customization_prompt(
                "Planner", current_prompt, "planning phase"
            )

            # Verify prompt contains key elements
            assert "Planner" in prompt
            assert current_prompt in prompt
            assert "PLANNER.md" in prompt
            assert "project-specific role instructions" in prompt


class TestCustomizedPromptLoading:
    """Test the customized prompt loading functionality."""

    def setup_method(self):
        """Set up test environment."""
        self.test_dir = Path(tempfile.mkdtemp())
        self.termaite_dir = self.test_dir / ".termaite"
        self.termaite_dir.mkdir()

    def teardown_method(self):
        """Clean up test environment."""
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir)

    def test_load_customized_prompt_existing_file(self):
        """Test loading a customized prompt from existing file."""
        # Create test config and payload builder
        config = {"plan_prompt": "default prompt"}
        payload_file = self.test_dir / "payload.json"
        payload_file.write_text('{"test": "payload"}')

        builder = PayloadBuilder(config, payload_file, str(self.test_dir))

        # Create a custom planner prompt file
        planner_file = self.termaite_dir / "PLANNER.md"
        custom_prompt = "This is a customized planner prompt for this project"
        planner_file.write_text(custom_prompt)

        # Test loading the customized prompt
        result = builder._load_customized_prompt("plan", self.termaite_dir)
        assert result == custom_prompt

    def test_load_customized_prompt_nonexistent_file(self):
        """Test loading a customized prompt when file doesn't exist."""
        config = {"plan_prompt": "default prompt"}
        payload_file = self.test_dir / "payload.json"
        payload_file.write_text('{"test": "payload"}')

        builder = PayloadBuilder(config, payload_file, str(self.test_dir))

        # Test loading when file doesn't exist
        result = builder._load_customized_prompt("plan", self.termaite_dir)
        assert result is None

    def test_load_customized_prompt_invalid_phase(self):
        """Test loading a customized prompt with invalid phase."""
        config = {"plan_prompt": "default prompt"}
        payload_file = self.test_dir / "payload.json"
        payload_file.write_text('{"test": "payload"}')

        builder = PayloadBuilder(config, payload_file, str(self.test_dir))

        # Test loading with invalid phase
        result = builder._load_customized_prompt("invalid_phase", self.termaite_dir)
        assert result is None

    def test_get_system_prompt_for_phase_with_customized(self):
        """Test that get_system_prompt_for_phase uses customized prompts when available."""
        config = {"plan_prompt": "default plan prompt"}
        payload_file = self.test_dir / "payload.json"
        payload_file.write_text('{"test": "payload"}')

        builder = PayloadBuilder(config, payload_file, str(self.test_dir))

        # Create a custom planner prompt file
        planner_file = self.termaite_dir / "PLANNER.md"
        custom_prompt = "This is a customized planner prompt"
        planner_file.write_text(custom_prompt)

        # Test that the customized prompt is used
        result = builder._get_system_prompt_for_phase("plan")
        assert result == custom_prompt

    def test_get_system_prompt_for_phase_fallback_to_default(self):
        """Test that get_system_prompt_for_phase falls back to default when no custom prompt."""
        config = {"plan_prompt": "default plan prompt"}
        payload_file = self.test_dir / "payload.json"
        payload_file.write_text('{"test": "payload"}')

        builder = PayloadBuilder(config, payload_file, str(self.test_dir))

        # No custom prompt file created
        # Test that the default prompt is used
        result = builder._get_system_prompt_for_phase("plan")
        assert result == "default plan prompt"


class TestCLIInitFlag:
    """Test the --init CLI flag functionality."""

    @patch("termaite.cli.create_application")
    def test_cli_init_flag_calls_initialize_project_prompts(self, mock_create_app):
        """Test that --init flag calls initialize_project_prompts."""
        from termaite.cli import main

        # Mock the application
        mock_app = Mock()
        mock_app.initialize_project_prompts.return_value = True
        mock_create_app.return_value = mock_app

        # Test the --init flag
        with pytest.raises(SystemExit) as exc_info:
            main(["--init"])

        # Verify that initialize_project_prompts was called
        mock_app.initialize_project_prompts.assert_called_once()
        assert exc_info.value.code == 0

    @patch("termaite.cli.create_application")
    def test_cli_init_flag_handles_failure(self, mock_create_app):
        """Test that --init flag handles initialization failure."""
        from termaite.cli import main

        # Mock the application to return failure
        mock_app = Mock()
        mock_app.initialize_project_prompts.return_value = False
        mock_create_app.return_value = mock_app

        # Test the --init flag with failure
        with pytest.raises(SystemExit) as exc_info:
            main(["--init"])

        # Verify that initialize_project_prompts was called and failed
        mock_app.initialize_project_prompts.assert_called_once()
        assert exc_info.value.code == 1
