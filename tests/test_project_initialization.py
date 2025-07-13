"""Tests for project initialization functionality."""

import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

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

    @patch(
        "termaite.core.project_initialization.validate_generated_prompt_files",
        return_value=(True, []),
    )
    @patch(
        "termaite.core.project_initialization.ProjectInitializationTask._add_investigation_commands"
    )
    @patch("termaite.core.application.create_config_manager")
    @patch("termaite.core.application.create_task_handler")
    @patch("termaite.core.application.create_simple_handler")
    @patch("termaite.core.application.check_dependencies")
    def test_initialize_project_prompts_succeeds(
        self,
        mock_check_deps,
        mock_simple_handler,
        mock_task_handler,
        mock_config_manager,
        mock_add_commands,
        mock_validate_files,
    ):
        """Test that initialize_project_prompts succeeds with proper mocking."""
        # Setup mocks
        mock_config_manager.return_value.config = {"enable_debug": False}
        mock_config_manager.return_value.get_command_maps.return_value = ({}, {})

        # Mock the task handler instance
        mock_task_handler_instance = MagicMock()
        mock_task_handler.return_value = mock_task_handler_instance

        # This function will be the side effect for the handle_task calls
        def mock_handle_task(task_prompt_str):
            if "Investigate" in task_prompt_str:
                return (True, "investigation summary")
            # For the generation task, simulate file creation
            else:
                (self.termaite_dir / "PLANNER.md").write_text("Planner content")
                (self.termaite_dir / "ACTOR.md").write_text("Actor content")
                (self.termaite_dir / "EVALUATOR.md").write_text("Evaluator content")
                return (True, "generation context")

        mock_task_handler_instance.handle_task.side_effect = mock_handle_task

        app = TermAIte(initial_working_directory=str(self.test_dir))

        # Call initialize_project_prompts
        result = app.initialize_project_prompts()

        # Verify that the .termaite directory was created and result is True
        assert self.termaite_dir.exists()
        assert self.termaite_dir.is_dir()
        assert (self.termaite_dir / "PLANNER.md").exists()
        assert result is True


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
