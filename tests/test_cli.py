"""Tests for CLI functionality."""

import pytest
from unittest.mock import Mock, patch
from termaite.cli import create_parser, main


class TestCLIParser:
    """Test the CLI argument parser."""

    def test_create_parser(self):
        """Test parser creation."""
        parser = create_parser()
        assert parser is not None

    def test_parser_help_option(self):
        """Test that help option works."""
        parser = create_parser()

        # Test that help option raises SystemExit (expected behavior)
        with pytest.raises(SystemExit):
            parser.parse_args(["--help"])

    def test_parser_version_option(self):
        """Test version option."""
        parser = create_parser()

        with pytest.raises(SystemExit):
            parser.parse_args(["--version"])

    def test_parser_task_prompt(self):
        """Test task prompt parsing."""
        parser = create_parser()
        args = parser.parse_args(["hello", "world"])

        assert args.task_prompt == ["hello", "world"]
        assert not args.agentic
        assert not args.debug

    def test_parser_agentic_flag(self):
        """Test agentic mode flag."""
        parser = create_parser()
        args = parser.parse_args(["-a", "test", "prompt"])

        assert args.agentic is True
        assert args.task_prompt == ["test", "prompt"]

    def test_parser_debug_flag(self):
        """Test debug flag."""
        parser = create_parser()
        args = parser.parse_args(["--debug", "test"])

        assert args.debug is True
        assert args.task_prompt == ["test"]

    def test_parser_config_dir(self):
        """Test custom config directory."""
        parser = create_parser()
        args = parser.parse_args(["--config-dir", "/custom/path", "test"])

        assert args.config_dir == "/custom/path"
        assert args.task_prompt == ["test"]


class TestCLIMain:
    """Test the main CLI entry point."""

    @patch("termaite.cli.create_application")
    def test_main_with_task_prompt(self, mock_create_app):
        """Test main function with task prompt."""
        mock_app = Mock()
        mock_app.run_single_task.return_value = True
        mock_create_app.return_value = mock_app

        # Should raise SystemExit(0) for successful task
        with pytest.raises(SystemExit) as exc_info:
            main(["test", "prompt"])
        assert exc_info.value.code == 0

        mock_app.run_single_task.assert_called_once_with(
            "test prompt", agentic_mode=False
        )

    @patch("termaite.cli.create_application")
    def test_main_with_agentic_task(self, mock_create_app):
        """Test main function with agentic mode."""
        mock_app = Mock()
        mock_app.run_single_task.return_value = True
        mock_create_app.return_value = mock_app

        # Should raise SystemExit(0) for successful task
        with pytest.raises(SystemExit) as exc_info:
            main(["-a", "test", "prompt"])
        assert exc_info.value.code == 0

        mock_app.run_single_task.assert_called_once_with(
            "test prompt", agentic_mode=True
        )

    @patch("termaite.cli.create_application")
    def test_main_interactive_mode(self, mock_create_app):
        """Test main function in interactive mode."""
        mock_app = Mock()
        mock_create_app.return_value = mock_app

        main([])  # No task prompt = interactive mode

        mock_app.run_interactive_mode.assert_called_once_with(agentic_mode=False)

    @patch("termaite.cli.create_application")
    def test_main_config_summary(self, mock_create_app):
        """Test main function with config summary."""
        mock_app = Mock()
        mock_create_app.return_value = mock_app

        main(["--config-summary"])

        mock_app.print_config_summary.assert_called_once()

    @patch("termaite.cli.create_application")
    def test_main_config_location(self, mock_create_app):
        """Test main function with config location."""
        mock_app = Mock()
        mock_create_app.return_value = mock_app

        main(["--config-location"])

        mock_app.print_config_location.assert_called_once()

    @patch("termaite.cli.create_application")
    def test_main_with_failed_task(self, mock_create_app):
        """Test main function with failed task."""
        mock_app = Mock()
        mock_app.run_single_task.return_value = False
        mock_create_app.return_value = mock_app

        with pytest.raises(SystemExit) as exc_info:
            main(["test"])

        assert exc_info.value.code == 1

    @patch("termaite.cli.create_application")
    def test_main_initialization_error(self, mock_create_app):
        """Test main function with initialization error."""
        mock_create_app.side_effect = Exception("Test error")

        with pytest.raises(SystemExit) as exc_info:
            main(["test"])

        assert exc_info.value.code == 1
